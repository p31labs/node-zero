/**
 * IVMRenderer.ts — Three.js IVM visualization orchestrator
 * Accepts Graph from types/graph; manual orbit controls; raycasting.
 * Matches spaceship-earth.jsx reference: scale*15, barycentric positioning.
 */
import * as THREE from 'three';
import type { Graph } from '../types/graph';
import { JitterbugFrame } from './JitterbugFrame';
import { GeodesicShell } from './GeodesicShell';

const AXIS_COLORS: Record<string, string> = {
  A: '#ff6b6b', B: '#4ecdc4', C: '#ffe66d', D: '#a29bfe',
};
const STATE_COLORS: Record<string, string> = {
  active: '#2dffa0', pending: '#ffd93d', blocked: '#ff5252', complete: '#6a7a8a',
};

interface Orbit {
  theta: number;
  phi: number;
  distance: number;
  target: THREE.Vector3;
  dragging: boolean;
  lastX: number;
  lastY: number;
}

export class IVMRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pivot: THREE.Group;
  private clock: THREE.Clock;

  // Subsystems
  private jitterbug: JitterbugFrame;
  private shell: GeodesicShell;
  private instancedNodes!: THREE.InstancedMesh;
  private colorAttr!: Float32Array;
  private edgeLines!: THREE.LineSegments;
  private edgePositions!: Float32Array;
  private edgeColors!: Float32Array;
  private edgePairs: [number, number][] = [];

  // State
  private graph: Graph | null = null;
  private nodePositions: [number, number, number][] = [];
  private selectedId: string | null = null;
  private hoveredIdx: number | null = null;
  private running = false;
  private animFrameId = 0;
  private time = 0;

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  // FPS
  private frameCount = 0;
  private fpsAccum = 0;
  private fps = 60;

  private orbit: Orbit;

  // Display toggles (controlled from React)
  showShell = true;
  showVE = true;
  showEdges = true;
  cogLoad = 75;

  // Callbacks
  onNodeHover: ((nodeId: string | null) => void) | null = null;
  onNodeClick: ((nodeId: string | null) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.clock = new THREE.Clock(false);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060810);
    this.scene.fog = new THREE.FogExp2(0x060810, 0.06);

    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);

    this.orbit = {
      theta: 0.5,
      phi: 0.8,
      distance: 5.5,
      target: new THREE.Vector3(0, 0, 0),
      dragging: false,
      lastX: 0,
      lastY: 0,
    };
    this.updateCameraFromOrbit();

    // Lighting — matches reference
    this.scene.add(new THREE.AmbientLight(0x223344, 0.6));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.7);
    d1.position.set(4, 6, 3);
    this.scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x4ecdc4, 0.3);
    d2.position.set(-3, -2, -4);
    this.scene.add(d2);
    const pt = new THREE.PointLight(0x2dffa0, 0.4, 15);
    pt.position.set(0, 0, 0);
    this.scene.add(pt);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    (this.renderer as any).sortObjects = true;

    // Pivot group for orbit rotation
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    // Subsystems
    this.jitterbug = new JitterbugFrame();
    this.shell = new GeodesicShell(3.2, 2);
    this.pivot.add(this.jitterbug.group);
    this.pivot.add(this.shell.mesh);

    this.initNodes();
    this.initEdges();
    this.bindEvents();
  }

  private initNodes(): void {
    // InstancedMesh for up to 200 node spheres
    const geo = new THREE.SphereGeometry(0.06, 12, 8);
    const mat = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: 0.9,
      shininess: 60,
      specular: new THREE.Color(0x222233),
    });
    this.instancedNodes = new THREE.InstancedMesh(geo, mat, 200);
    this.instancedNodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Pre-allocate instanceColor (r128 fix)
    this.colorAttr = new Float32Array(200 * 3);
    this.colorAttr.fill(1.0);
    this.instancedNodes.instanceColor = new THREE.InstancedBufferAttribute(this.colorAttr, 3);
    this.instancedNodes.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.instancedNodes.count = 0;

    this.pivot.add(this.instancedNodes);
  }

  private initEdges(): void {
    const maxEdges = 500;
    this.edgePositions = new Float32Array(maxEdges * 6);
    this.edgeColors = new Float32Array(maxEdges * 6);

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.edgePositions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(this.edgeColors, 3);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.2,
    });
    this.edgeLines = new THREE.LineSegments(geo, mat);
    this.pivot.add(this.edgeLines);
  }

  setGraph(graph: Graph): void {
    this.graph = graph;
    this.nodePositions = graph.nodes.map((n) => [n.x ?? 0, n.y ?? 0, n.z ?? 0]);
    this.instancedNodes.count = Math.min(graph.nodes.length, 200);

    // Build edge pairs
    this.edgePairs = [];
    const idToIdx = new Map<string, number>();
    graph.nodes.forEach((n, i) => idToIdx.set(n.id, i));
    const edgeSet = new Set<string>();
    for (const edge of graph.edges) {
      const si = idToIdx.get(edge.source);
      const ti = idToIdx.get(edge.target);
      if (si !== undefined && ti !== undefined) {
        const key = `${Math.min(si, ti)}_${Math.max(si, ti)}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          this.edgePairs.push([si, ti]);
        }
      }
    }

    // Set initial colors
    graph.nodes.forEach((node, i) => {
      if (i >= 200) return;
      const c = new THREE.Color(AXIS_COLORS[node.axis ?? 'A'] ?? '#a29bfe');
      this.colorAttr[i * 3] = c.r;
      this.colorAttr[i * 3 + 1] = c.g;
      this.colorAttr[i * 3 + 2] = c.b;
    });

    // Force material update for instanceColor
    (this.instancedNodes.material as THREE.Material).needsUpdate = true;
  }

  setSensoryProfile(profile: { motionScale: number; glowIntensity: number }): void {
    this.jitterbug.setSensoryProfile({ motionScale: profile.motionScale });
    const g = profile.glowIntensity;
    this.shell.setOpacity(g <= 0.33 ? 0.08 : g <= 0.66 ? 0.12 : 0.18);
  }

  setBreathingState(phase: 'in' | 'hold' | 'out' | 'idle'): void {
    if (phase === 'idle') this.jitterbug.setIdle();
    else this.jitterbug.setBreathing(phase);
  }

  setTension(t: number): void { this.jitterbug.setTension(t); }

  setDeepLock(locked: boolean): void {
    this.jitterbug.setLocked(locked);
    this.shell.setOpacity(locked ? 0.04 : 0.18);
  }

  setSelectedNode(nodeId: string | null): void { this.selectedId = nodeId; }

  setFilteredIndices(indices: boolean[]): void {
    this._filteredIndices = indices;
  }
  private _filteredIndices: boolean[] = [];

  getFps(): number { return this.fps; }
  getJitterbugT(): number { return this.jitterbug.getT(); }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.tick();
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('click', this.onClick);
    this.jitterbug.dispose();
    this.shell.dispose();
    this.instancedNodes.geometry.dispose();
    (this.instancedNodes.material as THREE.Material).dispose();
    this.edgeLines.geometry.dispose();
    (this.edgeLines.material as THREE.Material).dispose();
    this.renderer.dispose();
  }

  private tick = (): void => {
    if (!this.running) return;
    this.animFrameId = requestAnimationFrame(this.tick);

    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    this.frameCount++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 1.0) {
      this.fps = Math.round(this.frameCount / this.fpsAccum);
      this.frameCount = 0;
      this.fpsAccum = 0;
    }

    // Update jitterbug
    this.jitterbug.update(dt);

    // Update visibility
    this.shell.mesh.visible = this.showShell;
    this.jitterbug.group.visible = this.showVE;
    this.edgeLines.visible = this.showEdges;

    // Shell opacity tied to cognitive load
    const loadFactor = this.cogLoad / 100;
    this.shell.setOpacity(0.08 + 0.2 * loadFactor);

    // Update node instances — matches reference scale*15 pattern
    if (this.graph) {
      this.updateNodes(loadFactor);
      this.updateEdges();
    }

    // Orbit rotation on pivot
    this.pivot.rotation.x = this.orbit.phi - Math.PI / 2;
    this.pivot.rotation.y = this.orbit.theta;
    this.camera.position.set(0, 0, this.orbit.distance);
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  };

  private updateNodes(loadFactor: number): void {
    if (!this.graph) return;
    const nodes = this.graph.nodes;
    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const selectedIdx = this.selectedId
      ? nodes.findIndex((n) => n.id === this.selectedId)
      : -1;
    const selectedNode = selectedIdx >= 0 ? nodes[selectedIdx] : null;

    for (let i = 0; i < Math.min(nodes.length, 200); i++) {
      const node = nodes[i];
      const p = this.nodePositions[i];
      const visible = this._filteredIndices.length === 0 || this._filteredIndices[i];
      const isSelected = i === selectedIdx;
      const isHovered = i === this.hoveredIdx;
      const isConnected = selectedNode !== null &&
        (selectedNode.connections?.includes(parseInt(node.id)) ||
         node.connections?.includes(parseInt(selectedNode.id)));

      // Scale: base from bary dominance + state modifiers
      const bary = node.bary ?? [0.25, 0.25, 0.25, 0.25];
      let scale = visible ? 0.06 + 0.04 * Math.max(...bary) : 0;
      if (isSelected) scale *= 2.5;
      else if (isHovered) scale *= 2;
      else if (isConnected) scale *= 1.6;

      // Subtle breathing
      const breathe = 1 + 0.08 * Math.sin(this.time * 2 + i * 0.3);
      scale *= breathe;

      // Cognitive load: fade distant nodes
      if (loadFactor < 0.3 && !isSelected && !isConnected) {
        scale *= loadFactor / 0.3;
      }

      pos.set(p[0], p[1], p[2]);
      dummy.compose(pos, quat, new THREE.Vector3(scale * 15, scale * 15, scale * 15));
      this.instancedNodes.setMatrixAt(i, dummy);

      // Color
      let color: THREE.Color;
      if (!visible) {
        color = new THREE.Color(0x111111);
      } else if (isSelected) {
        color = new THREE.Color(0xffffff);
      } else if (isConnected) {
        color = new THREE.Color(AXIS_COLORS[node.axis ?? 'A']).lerp(new THREE.Color(0xffffff), 0.4);
      } else {
        const stateColor = new THREE.Color(STATE_COLORS[node.state ?? 'active']);
        const axisColor = new THREE.Color(AXIS_COLORS[node.axis ?? 'A']);
        color = axisColor.lerp(stateColor, 0.3);
      }
      this.colorAttr[i * 3] = color.r;
      this.colorAttr[i * 3 + 1] = color.g;
      this.colorAttr[i * 3 + 2] = color.b;
    }

    this.instancedNodes.instanceMatrix.needsUpdate = true;
    if (this.instancedNodes.instanceColor) {
      this.instancedNodes.instanceColor.needsUpdate = true;
    }
  }

  private updateEdges(): void {
    if (!this.graph) return;
    const nodes = this.graph.nodes;
    const selectedIdx = this.selectedId
      ? nodes.findIndex((n) => n.id === this.selectedId)
      : -1;

    for (let ei = 0; ei < this.edgePairs.length && ei < 500; ei++) {
      const [a, b] = this.edgePairs[ei];
      const pa = this.nodePositions[a];
      const pb = this.nodePositions[b];
      const va = this._filteredIndices.length === 0 || this._filteredIndices[a];
      const vb = this._filteredIndices.length === 0 || this._filteredIndices[b];
      const isHighlighted = selectedIdx === a || selectedIdx === b;

      if (va && vb && pa && pb) {
        this.edgePositions[ei * 6] = pa[0];
        this.edgePositions[ei * 6 + 1] = pa[1];
        this.edgePositions[ei * 6 + 2] = pa[2];
        this.edgePositions[ei * 6 + 3] = pb[0];
        this.edgePositions[ei * 6 + 4] = pb[1];
        this.edgePositions[ei * 6 + 5] = pb[2];
      } else {
        for (let k = 0; k < 6; k++) this.edgePositions[ei * 6 + k] = 0;
      }

      const c = isHighlighted ? new THREE.Color(0x4ecdc4) : new THREE.Color(0x1a3040);
      const alpha = isHighlighted ? 0.7 : 0.15;
      this.edgeColors[ei * 6] = c.r * alpha;
      this.edgeColors[ei * 6 + 1] = c.g * alpha;
      this.edgeColors[ei * 6 + 2] = c.b * alpha;
      this.edgeColors[ei * 6 + 3] = c.r * alpha;
      this.edgeColors[ei * 6 + 4] = c.g * alpha;
      this.edgeColors[ei * 6 + 5] = c.b * alpha;
    }

    (this.edgeLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.edgeLines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.edgeLines.geometry.setDrawRange(0, Math.min(this.edgePairs.length, 500) * 2);
  }

  // ── Camera ──────────────────────────────────────────────────────────────

  private updateCameraFromOrbit(): void {
    this.camera.position.set(0, 0, this.orbit.distance);
    this.camera.lookAt(0, 0, 0);
  }

  // ── Events ──────────────────────────────────────────────────────────────

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('click', this.onClick);
  }

  private onResize = (): void => {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.orbit.dragging = true;
    this.orbit.lastX = e.clientX;
    this.orbit.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.orbit.dragging) {
      const dx = e.clientX - this.orbit.lastX;
      const dy = e.clientY - this.orbit.lastY;
      this.orbit.lastX = e.clientX;
      this.orbit.lastY = e.clientY;
      this.orbit.theta += dx * 0.005;
      this.orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbit.phi - dy * 0.005));
    }

    // Raycast for hover
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.instancedNodes);
    if (hits.length > 0) {
      const idx = hits[0].instanceId;
      if (idx !== undefined) {
        const vis = this._filteredIndices.length === 0 || this._filteredIndices[idx];
        if (vis) {
          this.hoveredIdx = idx;
          this.canvas.style.cursor = 'pointer';
          if (this.onNodeHover && this.graph) {
            this.onNodeHover(this.graph.nodes[idx]?.id ?? null);
          }
        } else {
          this.hoveredIdx = null;
          this.canvas.style.cursor = 'grab';
          if (this.onNodeHover) this.onNodeHover(null);
        }
      }
    } else {
      if (this.hoveredIdx !== null) {
        this.hoveredIdx = null;
        this.canvas.style.cursor = 'grab';
        if (this.onNodeHover) this.onNodeHover(null);
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.orbit.dragging = false;
    this.canvas.releasePointerCapture(e.pointerId);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.orbit.distance = Math.max(2.5, Math.min(12, this.orbit.distance + e.deltaY * 0.005));
  };

  private onClick = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hits = this.raycaster.intersectObject(this.instancedNodes);
    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      const idx = hits[0].instanceId;
      const vis = this._filteredIndices.length === 0 || this._filteredIndices[idx];
      if (vis && this.graph) {
        const nodeId = this.graph.nodes[idx]?.id ?? null;
        if (this.onNodeClick) {
          this.onNodeClick(this.selectedId === nodeId ? null : nodeId);
        }
      }
    } else {
      if (this.onNodeClick) this.onNodeClick(null);
    }
  };
}
