import * as THREE from 'three';

// Cuboctahedron: 12 vertices at all permutations of (±1, ±1, 0)
const CUBOCT: [number, number, number][] = [
  [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
  [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
  [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
];

// Octahedron: 6 vertices at ±√2 on each axis (matched edge length)
const S = Math.SQRT2;
const OCT: [number, number, number][] = [
  [S, 0, 0], [-S, 0, 0], [0, S, 0], [0, -S, 0], [0, 0, S], [0, 0, -S],
];

// Which octahedron vertex each cuboctahedron vertex collapses toward
// Each oct vertex receives exactly 2 cuboct vertices
const COLLAPSE = [0, 0, 1, 1, 4, 5, 4, 5, 2, 2, 3, 3];

// 24 edges of the cuboctahedron (pairs at distance √2)
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
  readonly wireframe: THREE.LineSegments;

  private posBuf: Float32Array;
  private verts: [number, number, number][];

  private t = 0.85;
  private targetT = 0.85;
  private idlePhase = 0;
  private idleCenter = 0.825;
  private idleRange = 0.075;

  private breathMode: 'idle' | 'active' = 'idle';
  private breathTarget = 0.85;

  constructor() {
    this.posBuf = new Float32Array(EDGES.length * 2 * 3);
    this.verts = CUBOCT.map(v => [...v] as [number, number, number]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.posBuf, 3));

    const mat = new THREE.LineBasicMaterial({
      color: 0x00E878,
      opacity: 0.35,
      transparent: true,
    });

    this.wireframe = new THREE.LineSegments(geo, mat);
    this.rebuild();
  }

  // --- Public ---

  setOpacity(o: number) {
    (this.wireframe.material as THREE.LineBasicMaterial).opacity = o;
  }

  setBreathTarget(t: number) {
    this.breathMode = 'active';
    this.breathTarget = Math.max(0.3, Math.min(1.0, t));
  }

  setIdleBreathing() {
    this.breathMode = 'idle';
  }

  setIdleCenter(center: number) {
    this.idleCenter = Math.max(0.4, Math.min(0.9, center));
    this.idleRange = Math.max(0.02, 0.075 * (1.0 - (0.9 - this.idleCenter) / 0.5));
  }

  getVertex(i: number): [number, number, number] {
    return this.verts[i];
  }

  getAllVertices(): [number, number, number][] {
    return this.verts;
  }

  getCurrentT(): number {
    return this.t;
  }

  update(dt: number) {
    if (this.breathMode === 'idle') {
      this.idlePhase += dt * 0.5;
      this.targetT = this.idleCenter + this.idleRange * Math.sin(this.idlePhase);
    } else {
      this.targetT = this.breathTarget;
    }

    this.t += (this.targetT - this.t) * Math.min(1.0, 2.0 * dt);
    this.rebuild();
  }

  dispose() {
    this.wireframe.geometry.dispose();
    (this.wireframe.material as THREE.Material).dispose();
  }

  // --- Private ---

  private rebuild() {
    for (let i = 0; i < 12; i++) {
      const [cx, cy, cz] = CUBOCT[i];
      const [ox, oy, oz] = OCT[COLLAPSE[i]];
      this.verts[i] = [
        (ox + this.t * (cx - ox)) * SCALE,
        (oy + this.t * (cy - oy)) * SCALE,
        (oz + this.t * (cz - oz)) * SCALE,
      ];
    }

    let off = 0;
    for (const [a, b] of EDGES) {
      const [ax, ay, az] = this.verts[a];
      const [bx, by, bz] = this.verts[b];
      this.posBuf[off++] = ax; this.posBuf[off++] = ay; this.posBuf[off++] = az;
      this.posBuf[off++] = bx; this.posBuf[off++] = by; this.posBuf[off++] = bz;
    }

    (this.wireframe.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
