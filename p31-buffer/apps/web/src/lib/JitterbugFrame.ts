/**
 * JitterbugFrame.ts — Fuller's Jitterbug transformation
 * Correct parametric form: s(θ) = 2·cos(θ − π/3)
 * θ = 0       → Octahedron (contracted)
 * θ ≈ 0.3649  → Icosahedron (transition)
 * θ = π/3     → Cuboctahedron / VE (expanded)
 *
 * Face-group parity rotation via quaternions (Synergetics §460).
 * Matches the reference jitterbug.jsx exactly.
 */
import * as THREE from 'three';

const PI = Math.PI;
const THETA_VE = PI / 3;          // ~1.0472 — cuboctahedron
const THETA_ICOSA = 0.3649;       // icosahedron transition
const SCALE = 0.7;                // scene scale factor

// Octahedron base vertices (unit)
const OCT_VERTS: THREE.Vector3[] = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

// 8 triangular faces [v0, v1, v2] indices into OCT_VERTS
const FACES: [number, number, number][] = [
  [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
  [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5],
];

// Pre-computed cuboctahedron edges (24 edges connecting the 12 unique VE vertices)
// These are indices into the flat 24-vertex array (8 faces × 3 verts)
// We compute edges dynamically from inter- and intra-face connections.

/** Parity group: sign of centroid component product */
function faceGroup(fi: number): 0 | 1 {
  const [ai, bi, ci] = FACES[fi];
  const cx = OCT_VERTS[ai].x + OCT_VERTS[bi].x + OCT_VERTS[ci].x;
  const cy = OCT_VERTS[ai].y + OCT_VERTS[bi].y + OCT_VERTS[ci].y;
  const cz = OCT_VERTS[ai].z + OCT_VERTS[bi].z + OCT_VERTS[ci].z;
  return Math.sign(cx * cy * cz) >= 0 ? 0 : 1;
}

// Pre-allocated temps
const _centroid = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _rel = new THREE.Vector3();
const _scaled = new THREE.Vector3();

/**
 * Compute all 8×3 = 24 face vertices for a given theta.
 * Returns array of 8 face groups, each with 3 Vector3.
 */
function computeJitterbugFaceVerts(theta: number): THREE.Vector3[][] {
  const s = 2 * Math.cos(theta - PI / 3);
  const allFaceVerts: THREE.Vector3[][] = [];

  for (let fi = 0; fi < 8; fi++) {
    const [ai, bi, ci] = FACES[fi];
    const va = OCT_VERTS[ai];
    const vb = OCT_VERTS[bi];
    const vc = OCT_VERTS[ci];

    // Face centroid
    _centroid.set(
      (va.x + vb.x + vc.x) / 3,
      (va.y + vb.y + vc.y) / 3,
      (va.z + vb.z + vc.z) / 3,
    );
    _normal.copy(_centroid).normalize();

    // Parity rotation: group 0 rotates +θ, group 1 rotates -θ
    const group = faceGroup(fi);
    const angle = group === 0 ? theta : -theta;
    _quat.setFromAxisAngle(_normal, angle);

    const faceVerts: THREE.Vector3[] = [];
    for (const v of [va, vb, vc]) {
      _rel.copy(v).sub(_centroid);
      _rel.applyQuaternion(_quat);
      _scaled.copy(_centroid).multiplyScalar(s);
      faceVerts.push(
        new THREE.Vector3(
          (_rel.x + _scaled.x) * SCALE,
          (_rel.y + _scaled.y) * SCALE,
          (_rel.z + _scaled.z) * SCALE,
        ),
      );
    }
    allFaceVerts.push(faceVerts);
  }
  return allFaceVerts;
}

/**
 * Extract unique vertices from face groups, deduplicating overlapping verts.
 * At VE (theta=π/3) there are exactly 12 unique vertices.
 * At OCT (theta=0) there are 6.
 */
function extractUniqueVerts(allFaceVerts: THREE.Vector3[][]): THREE.Vector3[] {
  const unique: THREE.Vector3[] = [];
  const seen = new Set<string>();
  for (const fv of allFaceVerts) {
    for (const v of fv) {
      const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(v.clone());
      }
    }
  }
  return unique;
}

/**
 * Compute inter-face edges: vertex pairs from different faces that are
 * close enough to form edges (distance ≤ intra-edge length * 1.15).
 */
function computeInterEdges(allFaceVerts: THREE.Vector3[][]): [THREE.Vector3, THREE.Vector3][] {
  const pairs: [THREE.Vector3, THREE.Vector3][] = [];
  // Intra-face edge length = √2 for unit octahedron
  const intraLen = Math.sqrt(2);
  const threshold = intraLen * 1.15;

  for (let i = 0; i < allFaceVerts.length; i++) {
    for (let j = i + 1; j < allFaceVerts.length; j++) {
      for (const vi of allFaceVerts[i]) {
        for (const vj of allFaceVerts[j]) {
          const d = vi.distanceTo(vj);
          if (d > 0.01 && d < threshold) {
            pairs.push([vi, vj]);
          }
        }
      }
    }
  }
  return pairs;
}

export class JitterbugFrame {
  readonly group: THREE.Group;

  // Face meshes (8 triangles with wireframes)
  private faceMeshes: THREE.Mesh[] = [];
  private faceWires: THREE.Line[] = [];
  private interEdgeLines: THREE.LineSegments;
  private vertexDots: THREE.Points;

  // Current face verts
  private currentFaceVerts: THREE.Vector3[][] = [];
  private uniqueVerts: THREE.Vector3[] = [];

  // State
  private theta = THETA_VE;         // Start at cuboctahedron
  private targetTheta = THETA_VE;
  private idlePhase = 0;
  private mode: 'idle' | 'breathing' | 'locked' | 'manual' = 'idle';
  private breathSpeed = 0.5;

  // Group colors
  private readonly GROUP_A_COLOR = new THREE.Color(0.18, 0.85, 0.55); // phosphor green
  private readonly GROUP_B_COLOR = new THREE.Color(0.15, 0.65, 0.95); // electric blue
  private readonly GROUP_A_WIRE = new THREE.Color(0.25, 1.0, 0.7);
  private readonly GROUP_B_WIRE = new THREE.Color(0.2, 0.8, 1.0);

  constructor() {
    this.group = new THREE.Group();

    // Create 8 triangle face meshes + wireframes
    for (let fi = 0; fi < 8; fi++) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(9);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const grp = faceGroup(fi);
      const mat = new THREE.MeshPhongMaterial({
        color: grp === 0 ? this.GROUP_A_COLOR : this.GROUP_B_COLOR,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        shininess: 80,
        specular: new THREE.Color(0x222233),
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.group.add(mesh);
      this.faceMeshes.push(mesh);

      // Wireframe per triangle (Line loop: 4 points to close)
      const wireGeo = new THREE.BufferGeometry();
      const wirePositions = new Float32Array(12);
      wireGeo.setAttribute('position', new THREE.BufferAttribute(wirePositions, 3));
      const wireMat = new THREE.LineBasicMaterial({
        color: grp === 0 ? this.GROUP_A_WIRE : this.GROUP_B_WIRE,
        transparent: true,
        opacity: 0.9,
      });
      const wireLine = new THREE.Line(wireGeo, wireMat);
      this.group.add(wireLine);
      this.faceWires.push(wireLine);
    }

    // Inter-triangle edges
    const edgeGeo = new THREE.BufferGeometry();
    const edgePositions = new Float32Array(300); // enough for ~50 edges
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.5, 0.5, 0.6),
      transparent: true,
      opacity: 0.35,
    });
    this.interEdgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    this.group.add(this.interEdgeLines);

    // Vertex dots
    const dotGeo = new THREE.BufferGeometry();
    const dotPositions = new Float32Array(36); // up to 12 verts
    dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
    const dotMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.08,
      sizeAttenuation: true,
    });
    this.vertexDots = new THREE.Points(dotGeo, dotMat);
    this.group.add(this.vertexDots);

    // Initial geometry
    this.updateGeometry();
  }

  private updateGeometry(): void {
    this.currentFaceVerts = computeJitterbugFaceVerts(this.theta);
    this.uniqueVerts = extractUniqueVerts(this.currentFaceVerts);

    // Update face meshes and wireframes
    for (let fi = 0; fi < 8; fi++) {
      const verts = this.currentFaceVerts[fi];
      const mesh = this.faceMeshes[fi];
      const pos = (mesh.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let vi = 0; vi < 3; vi++) {
        pos[vi * 3] = verts[vi].x;
        pos[vi * 3 + 1] = verts[vi].y;
        pos[vi * 3 + 2] = verts[vi].z;
      }
      (mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      mesh.geometry.computeVertexNormals();

      // Wireframe
      const wire = this.faceWires[fi];
      const wp = (wire.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let vi = 0; vi < 3; vi++) {
        wp[vi * 3] = verts[vi].x;
        wp[vi * 3 + 1] = verts[vi].y;
        wp[vi * 3 + 2] = verts[vi].z;
      }
      // Close the triangle
      wp[9] = verts[0].x;
      wp[10] = verts[0].y;
      wp[11] = verts[0].z;
      (wire.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Update vertex dots
    const dotPositions = new Float32Array(this.uniqueVerts.length * 3);
    for (let i = 0; i < this.uniqueVerts.length; i++) {
      dotPositions[i * 3] = this.uniqueVerts[i].x;
      dotPositions[i * 3 + 1] = this.uniqueVerts[i].y;
      dotPositions[i * 3 + 2] = this.uniqueVerts[i].z;
    }
    this.vertexDots.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(dotPositions, 3),
    );
    (this.vertexDots.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Update inter-triangle edges
    const interEdges = computeInterEdges(this.currentFaceVerts);
    const ep = new Float32Array(Math.max(interEdges.length * 6, 6));
    for (let i = 0; i < interEdges.length; i++) {
      ep[i * 6] = interEdges[i][0].x;
      ep[i * 6 + 1] = interEdges[i][0].y;
      ep[i * 6 + 2] = interEdges[i][0].z;
      ep[i * 6 + 3] = interEdges[i][1].x;
      ep[i * 6 + 4] = interEdges[i][1].y;
      ep[i * 6 + 5] = interEdges[i][1].z;
    }
    this.interEdgeLines.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(ep, 3),
    );
    (this.interEdgeLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  /**
   * Returns the unique deduplicated vertices for the current theta.
   * At VE → 12 vertices; at octahedron → 6.
   * NodeInstances uses these to position node orbs.
   */
  getAllVertices(): THREE.Vector3[] {
    return this.uniqueVerts.map((v) => v.clone());
  }

  /** Get the current theta (0 = oct, π/3 = VE) */
  getTheta(): number {
    return this.theta;
  }

  /** Get normalized t ∈ [0,1] where 0=oct, 1=VE */
  getT(): number {
    return this.theta / THETA_VE;
  }

  getStageName(): string {
    const t = this.theta / THETA_VE;
    if (t < 0.01) return 'OCTAHEDRON';
    if (t > 0.99) return 'CUBOCTAHEDRON (VE)';
    if (Math.abs(this.theta - THETA_ICOSA) < 0.02) return 'ICOSAHEDRON';
    if (this.theta < THETA_ICOSA) return 'OCT → ICOSA';
    return 'ICOSA → VE';
  }

  getScaleFactor(): number {
    return 2 * Math.cos(this.theta - PI / 3);
  }

  setBreathing(phase: 'in' | 'hold' | 'out'): void {
    this.mode = 'breathing';
    if (phase === 'in') this.targetTheta = THETA_VE;       // expand to VE
    else if (phase === 'out') this.targetTheta = THETA_ICOSA * 0.5; // contract past icosa
    // hold: keep current
  }

  setIdle(): void {
    this.mode = 'idle';
  }

  setLocked(locked: boolean): void {
    if (locked) {
      this.mode = 'locked';
      this.targetTheta = 0.1; // near-octahedron (defensive)
    } else {
      this.mode = 'idle';
    }
  }

  setTension(t: number): void {
    if (this.mode === 'idle') {
      // Map tension 0-1 to theta range: low tension = VE, high tension = near-oct
      const mapped = THETA_VE - t * (THETA_VE - THETA_ICOSA * 0.3);
      this.targetTheta = Math.max(0, Math.min(THETA_VE, mapped));
    }
  }

  setSensoryProfile(profile: { motionScale: number }): void {
    const m = profile.motionScale;
    if (m <= 0.33) this.breathSpeed = 0.3;
    else if (m <= 0.66) this.breathSpeed = 0.5;
    else this.breathSpeed = 0.6;

    // Adjust face opacity based on motion sensitivity
    for (let fi = 0; fi < 8; fi++) {
      const mat = this.faceMeshes[fi].material as THREE.MeshPhongMaterial;
      mat.opacity = m <= 0.33 ? 0.25 : m <= 0.66 ? 0.4 : 0.5;
    }
  }

  update(dt: number): void {
    if (this.mode === 'idle') {
      // Gentle breathing oscillation centered around mid-VE
      this.idlePhase += dt * this.breathSpeed;
      // Oscillate between icosa region and near-VE
      this.targetTheta = THETA_VE * 0.75 + THETA_VE * 0.2 * Math.sin(this.idlePhase);
    }

    const speed = this.mode === 'locked' ? 1.0 : 2.0;
    this.theta += (this.targetTheta - this.theta) * Math.min(1.0, speed * dt);
    this.theta = Math.max(0, Math.min(THETA_VE, this.theta));

    this.updateGeometry();
  }

  dispose(): void {
    for (const mesh of this.faceMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const wire of this.faceWires) {
      wire.geometry.dispose();
      (wire.material as THREE.Material).dispose();
    }
    this.interEdgeLines.geometry.dispose();
    (this.interEdgeLines.material as THREE.Material).dispose();
    this.vertexDots.geometry.dispose();
    (this.vertexDots.material as THREE.Material).dispose();
  }
}
