/**
 * IVMRenderer.ts — Three.js r128 IVM visualization orchestrator
 *
 * Full API surface consumed by SpaceshipEarth.tsx:
 *   constructor(canvas) → setSensoryProfile() → setGraph() → start()
 *   setBreathingState() / setTension() / setDeepLock()
 *   getFps() / getJitterbugT()
 *   dispose()
 */
import * as THREE from 'three';
import type { GraphEdge } from '../types/graph';
import { JitterbugFrame } from './JitterbugFrame';
import { GeodesicShell } from './GeodesicShell';
import { NodeInstances } from './NodeInstances';
import { DataEdges } from './DataEdges';

/* ── Public types ────────────────────────────────────── */

export interface GraphNodeData {
  id: string;
  label: string;
  axis: string;
  x: number; // bary[0]
  y: number; // bary[1]
  z: number; // bary[2]
  radius: number;
  voltage: number;
}

export interface Graph {
  nodes: GraphNodeData[];
  edges: GraphEdge[];
}

/* ── Orbit state (manual — no import path issues) ───── */

interface Orbit {
  theta: number;   // horizontal angle
  phi: number;     // vertical angle
  distance: number;
  target: THREE.Vector3;
  dragging: boolean;
  lastX: number;
  lastY: number;
}

/* ── Renderer class ──────────────────────────────────── */

export class IVMRenderer {
  // Three.js core
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;

  // IVM components
  private jitterbug: JitterbugFrame;
  private shell: GeodesicShell;
  private nodes: NodeInstances;
  private edges: DataEdges;

  // State
  private graph: Graph | null = null;
  private nodeIdToIndex: Map<string, number> = new Map();
  private selectedId: string | null = null;
  private running = false;
  private animFrameId = 0;
  private sensoryProfile: 'low' | 'medium' | 'high' = 'low';

  // FPS tracking
  private frameCount = 0;
  private fpsAccum = 0;
  private fps = 60;

  // Orbit camera
  private orbit: Orbit;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.clock = new THREE.Clock(false); // don't auto-start

    // ── Scene ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060810);
    this.scene.fog = new THREE.FogExp2(0x060810, 0.06);

    // ── Camera ──
    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);

    // ── Orbit state ──
    this.orbit = {
      theta: 0.3,
      phi: 0.8,
      distance: 5.5,
      target: new THREE.Vector3(0, 0, 0),
      dragging: false,
      lastX: 0,
      lastY: 0,
    };
    this.updateCameraFromOrbit();

    // ── Lights ──
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(4, 6, 3);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x4ecdc4, 0.3);
    fill.position.set(-3, -2, -4);
    this.scene.add(fill);

    const center = new THREE.PointLight(0x2dffa0, 0.4, 15);
    center.position.set(0, 0, 0);
    this.scene.add(center);

    // ── Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // ── IVM components ──
    this.jitterbug = new JitterbugFrame();
    this.shell = new GeodesicShell(3.2, 2);
    this.nodes = new NodeInstances(200);
    this.edges = new DataEdges(400);

    this.scene.add(this.jitterbug.group);
    this.scene.add(this.shell.mesh);
    this.scene.add(this.nodes.mesh);
    this.scene.add(this.edges.lines);

    // ── Event listeners ──
    this.bindEvents();
  }

  /* ── Public API ────────────────────────────────────── */

  setSensoryProfile(profile: 'low' | 'medium' | 'high'): void {
    this.sensoryProfile = profile;
    this.jitterbug.setSensoryProfile(profile);

    // Adjust shell opacity
    if (profile === 'high') {
      this.shell.setOpacity(0.08);
    } else if (profile === 'medium') {
      this.shell.setOpacity(0.12);
    } else {
      this.shell.setOpacity(0.18);
    }
  }

  setGraph(graph: Graph): void {
    this.graph = graph;

    // Build id→index map
    this.nodeIdToIndex.clear();
    graph.nodes.forEach((n, i) => this.nodeIdToIndex.set(n.id, i));

    // Assign nodes to jitterbug vertices
    this.nodes.assignNodes(
      graph.nodes,
      this.jitterbug.getAllVertices(),
    );

    // Set edges
    this.edges.setEdges(graph.edges.map(e => ({
      source: e.source,
      target: e.target,
      type: e.type,
      weight: e.weight,
    })));
  }

  setBreathingState(breathing: boolean, phase: 'in' | 'hold' | 'out'): void {
    if (breathing) {
      this.jitterbug.setBreathing(phase);
    } else {
      this.jitterbug.setIdle();
    }
  }

  setTension(tension: number): void {
    this.jitterbug.setTension(tension);
  }

  setDeepLock(locked: boolean): void {
    this.jitterbug.setLocked(locked);

    // Dim the shell during deep lock
    if (locked) {
      this.shell.setOpacity(0.04);
    } else {
      this.setSensoryProfile(this.sensoryProfile);
    }
  }

  getFps(): number {
    return this.fps;
  }

  getJitterbugT(): number {
    return this.jitterbug.getT();
  }

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

    this.jitterbug.dispose();
    this.shell.dispose();
    this.nodes.dispose();
    this.edges.dispose();
    this.renderer.dispose();
  }

  /* ── Animation loop ───────────────────────────────── */

  private tick = (): void => {
    if (!this.running) return;
    this.animFrameId = requestAnimationFrame(this.tick);

    const dt = Math.min(this.clock.getDelta(), 0.1); // cap at 100ms

    // FPS
    this.frameCount++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 1.0) {
      this.fps = Math.round(this.frameCount / this.fpsAccum);
      this.frameCount = 0;
      this.fpsAccum = 0;
    }

    // Update jitterbug
    this.jitterbug.update(dt);
    const verts = this.jitterbug.getAllVertices();

    // Update nodes
    const time = performance.now() / 1000;
    this.nodes.update(verts, this.selectedId, time);

    // Update edges
    this.edges.update(
      this.nodeIdToIndex,
      (idx) => this.nodes.getNodePosition(idx, verts),
      this.selectedId,
    );

    // Gentle scene rotation
    this.scene.rotation.y += dt * 0.03;

    this.renderer.render(this.scene, this.camera);
  };

  /* ── Orbit camera ─────────────────────────────────── */

  private updateCameraFromOrbit(): void {
    const { theta, phi, distance, target } = this.orbit;
    this.camera.position.set(
      target.x + distance * Math.sin(phi) * Math.sin(theta),
      target.y + distance * Math.cos(phi),
      target.z + distance * Math.sin(phi) * Math.cos(theta),
    );
    this.camera.lookAt(target);
  }

  /* ── Event handlers ───────────────────────────────── */

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private onResize = (): void => {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.orbit.dragging = true;
    this.orbit.lastX = e.clientX;
    this.orbit.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.orbit.dragging) return;
    const dx = e.clientX - this.orbit.lastX;
    const dy = e.clientY - this.orbit.lastY;
    this.orbit.lastX = e.clientX;
    this.orbit.lastY = e.clientY;

    this.orbit.theta -= dx * 0.005;
    this.orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbit.phi + dy * 0.005));
    this.updateCameraFromOrbit();
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.orbit.dragging = false;
    this.canvas.releasePointerCapture(e.pointerId);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.orbit.distance = Math.max(2, Math.min(15, this.orbit.distance + e.deltaY * 0.005));
    this.updateCameraFromOrbit();
  };
}
