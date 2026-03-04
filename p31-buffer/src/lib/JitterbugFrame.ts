/**
 * JitterbugFrame.ts — Fuller's Jitterbug transformation
 * Cuboctahedron (t=1) ↔ Octahedron (t=0)
 * Breathing range: 0.75–0.95 (never fully collapsed or expanded)
 */
import * as THREE from 'three';

// Cuboctahedron vertices: permutations of (±1, ±1, 0)
const CUBOCT: [number, number, number][] = [
  [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
  [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
  [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
];

// Octahedron vertices (collapse targets for each cuboct vertex)
const OCT: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

// Map: cuboctahedron vertex → nearest octahedron vertex
const COLLAPSE_MAP = [0, 0, 1, 1, 4, 5, 4, 5, 2, 2, 3, 3];

// 24 edges of the cuboctahedron
const EDGES: [number, number][] = [
  [0, 4], [0, 5], [0, 8], [0, 9],
  [1, 4], [1, 5], [1, 10], [1, 11],
  [2, 6], [2, 7], [2, 8], [2, 9],
  [3, 6], [3, 7], [3, 10], [3, 11],
  [4, 8], [4, 10], [5, 9], [5, 11],
  [6, 8], [6, 10], [7, 9], [7, 11],
];

const SCALE = 0.7;

export class JitterbugFrame {
  readonly group: THREE.LineSegments;
  private posBuffer: Float32Array;
  private verts: [number, number, number][] = [];

  // Animation state
  private t = 0.85;
  private targetT = 0.85;
  private idlePhase = 0;
  private mode: 'idle' | 'breathing' | 'locked' | 'manual' = 'idle';
  private breathSpeed = 0.5; // radians/sec

  constructor() {
    // 24 edges × 2 endpoints × 3 floats
    this.posBuffer = new Float32Array(24 * 2 * 3);
    this.verts = this.computeVerts(this.t);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.posBuffer, 3));

    const mat = new THREE.LineBasicMaterial({
      color: 0x2dffa0,
      transparent: true,
      opacity: 0.35,
    });

    this.group = new THREE.LineSegments(geo, mat);
    this.writeBuffer();
  }

  private computeVerts(t: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const [cx, cy, cz] = CUBOCT[i];
      const oi = COLLAPSE_MAP[i];
      const [ox, oy, oz] = OCT[oi];
      out.push([
        (ox + t * (cx - ox)) * SCALE,
        (oy + t * (cy - oy)) * SCALE,
        (oz + t * (cz - oz)) * SCALE,
      ]);
    }
    return out;
  }

  private writeBuffer(): void {
    let off = 0;
    for (const [a, b] of EDGES) {
      const va = this.verts[a];
      const vb = this.verts[b];
      this.posBuffer[off++] = va[0];
      this.posBuffer[off++] = va[1];
      this.posBuffer[off++] = va[2];
      this.posBuffer[off++] = vb[0];
      this.posBuffer[off++] = vb[1];
      this.posBuffer[off++] = vb[2];
    }
    const attr = this.group.geometry.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  /** Get the current position of vertex i (0–11) */
  getVertex(i: number): [number, number, number] {
    return this.verts[i];
  }

  /** Get all 12 current vertex positions */
  getAllVertices(): [number, number, number][] {
    return this.verts;
  }

  /** Current jitterbug parameter */
  getT(): number {
    return this.t;
  }

  /** Set breathing mode: inhale expands, exhale contracts */
  setBreathing(phase: 'in' | 'hold' | 'out'): void {
    this.mode = 'breathing';
    if (phase === 'in') this.targetT = 0.95;
    else if (phase === 'out') this.targetT = 0.70;
    // hold: keep current
  }

  /** Idle breathing (gentle oscillation) */
  setIdle(): void {
    this.mode = 'idle';
  }

  /** Deep lock: contract to near-octahedron */
  setLocked(locked: boolean): void {
    if (locked) {
      this.mode = 'locked';
      this.targetT = 0.4;
    } else {
      this.mode = 'idle';
    }
  }

  /** Samson tension → jitterbug contraction (0–1 maps to 0.95–0.55) */
  setTension(tension: number): void {
    if (this.mode === 'idle') {
      // Tension adjusts the center of the idle oscillation
      const center = 0.85 - tension * 0.3;
      this.targetT = center;
    }
  }

  /** Sensory profile adjusts opacity and animation speed */
  setSensoryProfile(profile: 'low' | 'medium' | 'high'): void {
    const mat = this.group.material as THREE.LineBasicMaterial;
    if (profile === 'high') {
      mat.opacity = 0.2;
      this.breathSpeed = 0.3;
    } else if (profile === 'medium') {
      mat.opacity = 0.3;
      this.breathSpeed = 0.5;
    } else {
      mat.opacity = 0.4;
      this.breathSpeed = 0.6;
    }
  }

  /** Advance animation. Call once per frame with delta in seconds. */
  update(dt: number): void {
    if (this.mode === 'idle') {
      this.idlePhase += dt * this.breathSpeed;
      this.targetT = 0.825 + 0.075 * Math.sin(this.idlePhase);
    }

    // Smooth lerp toward target
    const speed = this.mode === 'locked' ? 1.0 : 2.0;
    this.t += (this.targetT - this.t) * Math.min(1.0, speed * dt);
    this.t = Math.max(0.3, Math.min(1.0, this.t));

    this.verts = this.computeVerts(this.t);
    this.writeBuffer();
  }

  dispose(): void {
    this.group.geometry.dispose();
    (this.group.material as THREE.Material).dispose();
  }
}
