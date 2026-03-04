import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { JitterbugFrame } from './JitterbugFrame';
import { GeodesicShell } from './GeodesicShell';

// Axis colors: A=green, B=blue, C=gold, D=orange
const AXIS_COLORS = [
  new THREE.Color(0x44ff44),
  new THREE.Color(0x4488ff),
  new THREE.Color(0xffcc00),
  new THREE.Color(0xff8844),
];

const MAX_PER_AXIS = 20;
const MAX_EDGES = 200;

// IVM tetrahedron vertices for barycentric → 3D
const TV = [
  new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(0.7),
  new THREE.Vector3(1, -1, -1).normalize().multiplyScalar(0.7),
  new THREE.Vector3(-1, 1, -1).normalize().multiplyScalar(0.7),
  new THREE.Vector3(-1, -1, 1).normalize().multiplyScalar(0.7),
];

export interface GraphNode {
  id: string;
  label: string;
  axis?: string;
  x: number;
  y: number;
  z: number;
  radius?: number;
  voltage?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface Assignment {
  nodeId: string;
  vertex: number;
  offset: THREE.Vector3;
  axisIdx: number;
  radius: number;
  voltage: number;
}

export class IVMRenderer {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private jitterbug: JitterbugFrame;
  private shell: GeodesicShell;

  private sphereGeo!: THREE.IcosahedronGeometry;
  private axisMeshes: THREE.InstancedMesh[] = [];

  private edgeSegs!: THREE.LineSegments;
  private edgePosBuf!: Float32Array;
  private edgeColBuf!: Float32Array;

  private assignments: Assignment[] = [];
  private graphEdges: GraphEdge[] = [];

  private animId = 0;
  private clock = new THREE.Clock();
  private disposed = false;
  private animSpeed = 1.0;

  // FPS counter
  private frames = 0;
  private fpsTime = 0;
  private fps = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initScene();
    this.jitterbug = new JitterbugFrame();
    this.shell = new GeodesicShell();
    this.scene.add(this.jitterbug.wireframe);
    this.scene.add(this.shell.mesh);
    this.initNodes();
    this.initEdges(MAX_EDGES);
  }

  // ─── Public API ─────────────────────────────────

  setGraph(graph: Graph) {
    if (!graph || !graph.nodes) {
      console.warn('[IVM] setGraph called with invalid graph');
      return;
    }
    console.log('[IVM] setGraph:', graph.nodes.length, 'nodes', graph.edges?.length ?? 0, 'edges');

    this.assignments = this.assignNodes(graph.nodes);
    this.graphEdges = graph.edges || [];
    this.initEdges(Math.max(MAX_EDGES, this.graphEdges.length));
    this.shell.pulse(0.3);
  }

  setBreathingState(active: boolean, phase: 'in' | 'hold' | 'out') {
    if (active) {
      const targets: Record<string, number> = { in: 1.0, hold: 0.85, out: 0.6 };
      this.jitterbug.setBreathTarget(targets[phase]);
    } else {
      this.jitterbug.setIdleBreathing();
    }
  }

  setSensoryProfile(profile: 'low' | 'medium' | 'high') {
    const cfg = {
      low: { speed: 1.0, glow: 0.3, shell: 0.06, wire: 0.35 },
      medium: { speed: 0.7, glow: 0.15, shell: 0.04, wire: 0.25 },
      high: { speed: 0.4, glow: 0.05, shell: 0.02, wire: 0.15 },
    }[profile];

    this.animSpeed = cfg.speed;
    this.jitterbug.setOpacity(cfg.wire);
    this.shell.setOpacity(cfg.shell);
    for (const m of this.axisMeshes) {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = cfg.glow;
    }
  }

  setTension(tension: number) {
    this.jitterbug.setIdleCenter(0.85 - tension * 0.30);
  }

  setDeepLock(active: boolean) {
    if (active) {
      this.jitterbug.setOpacity(0.1);
      this.shell.setOpacity(0.02);
      this.jitterbug.setIdleCenter(0.88);
      this.animSpeed = 0.2;
      for (const m of this.axisMeshes) {
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05;
      }
      (this.edgeSegs.material as THREE.LineBasicMaterial).opacity = 0.05;
    } else {
      this.animSpeed = 1.0;
      this.jitterbug.setOpacity(0.35);
      this.shell.setOpacity(0.06);
      for (const m of this.axisMeshes) {
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
      }
      (this.edgeSegs.material as THREE.LineBasicMaterial).opacity = 0.2;
    }
  }

  getFps(): number { return this.fps; }
  getJitterbugT(): number { return this.jitterbug.getCurrentT(); }

  start() {
    this.clock.start();
    this.animate();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
    this.controls.dispose();
    this.jitterbug.dispose();
    this.shell.dispose();
    this.sphereGeo.dispose();
    for (const m of this.axisMeshes) (m.material as THREE.Material).dispose();
    this.edgeSegs.geometry.dispose();
    (this.edgeSegs.material as THREE.Material).dispose();
    this.renderer.dispose();
  }

  // ─── Init ───────────────────────────────────────

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);
    this.scene.fog = new THREE.FogExp2(0x050510, 0.12);

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    this.camera.position.set(0, 1.2, 3.0);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(2, 3, 1);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x00E878, 0.15);
    fill.position.set(-2, 1, -1);
    this.scene.add(fill);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);

    // Orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 8.0;
    this.controls.target.set(0, 0, 0);

    // Resize handler
    const onResize = () => {
      const rw = this.canvas.clientWidth;
      const rh = this.canvas.clientHeight;
      this.camera.aspect = rw / rh;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(rw, rh);
    };
    window.addEventListener('resize', onResize);
  }

  private initNodes() {
    this.sphereGeo = new THREE.IcosahedronGeometry(1, 2);

    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: AXIS_COLORS[i],
        emissiveIntensity: 0.3,
        metalness: 0.15,
        roughness: 0.7,
      });
      const mesh = new THREE.InstancedMesh(this.sphereGeo, mat, MAX_PER_AXIS);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      // Per-instance colors
      const colors = new Float32Array(MAX_PER_AXIS * 3);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
      (mesh.instanceColor as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);

      mesh.count = 0;
      this.axisMeshes.push(mesh);
      this.scene.add(mesh);
    }
  }

  private initEdges(count: number) {
    if (this.edgeSegs) {
      this.scene.remove(this.edgeSegs);
      this.edgeSegs.geometry.dispose();
      (this.edgeSegs.material as THREE.Material).dispose();
    }

    this.edgePosBuf = new Float32Array(count * 6);
    this.edgeColBuf = new Float32Array(count * 6);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.edgePosBuf, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.edgeColBuf, 3));
    geo.setDrawRange(0, 0);

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      opacity: 0.2,
      transparent: true,
    });

    this.edgeSegs = new THREE.LineSegments(geo, mat);
    this.scene.add(this.edgeSegs);
  }

  // ─── Animation ──────────────────────────────────

  private animate = () => {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.animate);

    const dt = this.clock.getDelta() * this.animSpeed;

    this.jitterbug.update(dt);
    this.shell.update(dt);
    this.updateNodes();
    this.updateEdges();
    this.controls.update();

    // FPS
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1.0) {
      this.fps = Math.round(this.frames / this.fpsTime);
      this.frames = 0;
      this.fpsTime = 0;
    }

    this.renderer.render(this.scene, this.camera);
  };

  // ─── Node Logic ─────────────────────────────────

  private assignNodes(nodes: GraphNode[]): Assignment[] {
    const out: Assignment[] = [];
    const counts = new Array(12).fill(0);

    for (const n of nodes) {
      const pos = this.bary(n.x, n.y, n.z);

      // Find closest jitterbug vertex
      let best = 0;
      let bestD = Infinity;
      for (let v = 0; v < 12; v++) {
        const [vx, vy, vz] = this.jitterbug.getVertex(v);
        const dx = pos.x - vx, dy = pos.y - vy, dz = pos.z - vz;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) { bestD = d; best = v; }
      }

      // Offset to prevent overlap
      const c = counts[best];
      const offset = new THREE.Vector3();
      if (c > 0) {
        const a = c * 2.399; // Golden angle
        offset.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0);
      }
      counts[best]++;

      const axisChar = (n.axis ?? 'a').toLowerCase();
      const axisIdx = { a: 0, b: 1, c: 2, d: 3 }[axisChar] ?? 0;

      out.push({
        nodeId: n.id,
        vertex: best,
        offset,
        axisIdx,
        radius: Math.max(0.02, Math.min(0.15, n.radius ?? 0.06)),
        voltage: n.voltage ?? 0,
      });
    }

    return out;
  }

  private updateNodes() {
    if (this.assignments.length === 0) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (const m of this.axisMeshes) m.count = 0;

    for (const a of this.assignments) {
      const [vx, vy, vz] = this.jitterbug.getVertex(a.vertex);
      dummy.position.set(vx + a.offset.x, vy + a.offset.y, vz + a.offset.z);

      const vScale = 1.0 + (a.voltage / 10) * 0.3;
      dummy.scale.setScalar(a.radius * vScale);
      dummy.updateMatrix();

      const mesh = this.axisMeshes[a.axisIdx];
      if (mesh.count < MAX_PER_AXIS) {
        mesh.setMatrixAt(mesh.count, dummy.matrix);

        // Color: axis base brightened by voltage
        const bright = 0.6 + (a.voltage / 10) * 0.4;
        color.copy(AXIS_COLORS[a.axisIdx]).multiplyScalar(bright);
        mesh.setColorAt!(mesh.count, color);

        mesh.count++;
      }
    }

    for (const m of this.axisMeshes) {
      if (m.count > 0) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) (m.instanceColor as THREE.BufferAttribute).needsUpdate = true;
      }
    }
  }

  private updateEdges() {
    if (this.graphEdges.length === 0) return;

    const posMap = new Map<string, [number, number, number]>();
    const voltMap = new Map<string, number>();
    for (const a of this.assignments) {
      const [vx, vy, vz] = this.jitterbug.getVertex(a.vertex);
      posMap.set(a.nodeId, [vx + a.offset.x, vy + a.offset.y, vz + a.offset.z]);
      voltMap.set(a.nodeId, a.voltage);
    }

    const tc = new THREE.Color();
    let po = 0, co = 0, ec = 0;

    for (const e of this.graphEdges) {
      const s = posMap.get(e.source);
      const t = posMap.get(e.target);
      if (!s || !t) continue;

      this.edgePosBuf[po++] = s[0]; this.edgePosBuf[po++] = s[1]; this.edgePosBuf[po++] = s[2];
      this.edgePosBuf[po++] = t[0]; this.edgePosBuf[po++] = t[1]; this.edgePosBuf[po++] = t[2];

      this.vToColor(voltMap.get(e.source) ?? 0, tc);
      this.edgeColBuf[co++] = tc.r; this.edgeColBuf[co++] = tc.g; this.edgeColBuf[co++] = tc.b;
      this.vToColor(voltMap.get(e.target) ?? 0, tc);
      this.edgeColBuf[co++] = tc.r; this.edgeColBuf[co++] = tc.g; this.edgeColBuf[co++] = tc.b;

      ec++;
    }

    (this.edgeSegs.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.edgeSegs.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.edgeSegs.geometry.setDrawRange(0, ec * 2);
  }

  // ─── Helpers ────────────────────────────────────

  private bary(bx: number, by: number, bz: number): THREE.Vector3 {
    const bw = Math.max(0, 1 - bx - by - bz);
    return new THREE.Vector3(
      TV[0].x * bx + TV[1].x * by + TV[2].x * bz + TV[3].x * bw,
      TV[0].y * bx + TV[1].y * by + TV[2].y * bz + TV[3].y * bw,
      TV[0].z * bx + TV[1].z * by + TV[2].z * bz + TV[3].z * bw,
    );
  }

  /** Green → Gold → Orange → Red */
  private vToColor(v: number, out: THREE.Color): THREE.Color {
    const t = Math.min(1.0, v / 10);
    if (t < 0.33) {
      const s = t / 0.33;
      out.setRGB(s, 0.91 - s * 0.11, 0.47 - s * 0.47);
    } else if (t < 0.66) {
      const s = (t - 0.33) / 0.33;
      out.setRGB(1.0, 0.80 - s * 0.25, 0.0);
    } else {
      const s = (t - 0.66) / 0.34;
      out.setRGB(1.0, 0.55 - s * 0.55, 0.0);
    }
    return out;
  }
}
