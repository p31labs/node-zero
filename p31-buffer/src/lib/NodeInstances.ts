/**
 * NodeInstances.ts — InstancedMesh renderer for graph nodes
 * Nodes attach to their nearest jitterbug vertex and breathe with it.
 * Pre-allocates all temp objects to avoid per-frame GC.
 */
import * as THREE from 'three';

export interface NodeRenderData {
  id: string;
  axis: string;        // 'A'|'B'|'C'|'D'
  x: number;           // bary[0]
  y: number;           // bary[1]
  z: number;           // bary[2]
  radius: number;      // 0.02–0.06
  voltage: number;     // 0–10
  vertexIdx: number;   // assigned jitterbug vertex (0–11)
  offsetAngle: number; // golden angle offset for same-vertex stacking
}

const AXIS_COLORS: Record<string, THREE.Color> = {
  A: new THREE.Color('#ff6b6b'),
  B: new THREE.Color('#4ecdc4'),
  C: new THREE.Color('#ffe66d'),
  D: new THREE.Color('#a29bfe'),
};

const WHITE = new THREE.Color(0xffffff);
const DIM = new THREE.Color(0x333333);

// Pre-allocated temp objects — NEVER create these per-frame
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _pos = new THREE.Vector3();

export class NodeInstances {
  readonly mesh: THREE.InstancedMesh;
  private maxNodes: number;
  private assignments: NodeRenderData[] = [];
  private activeCount = 0;

  constructor(maxNodes = 200) {
    this.maxNodes = maxNodes;

    const geo = new THREE.SphereGeometry(1, 12, 8); // unit sphere, scale per instance
    const mat = new THREE.MeshStandardMaterial({
      metalness: 0.15,
      roughness: 0.7,
      emissiveIntensity: 0.3,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, maxNodes);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Initialize all instances as invisible (scale 0)
    _dummy.scale.set(0, 0, 0);
    _dummy.updateMatrix();
    for (let i = 0; i < maxNodes; i++) {
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = 0;
  }

  /** Assign nodes to jitterbug vertices. Call when graph changes, not per-frame. */
  assignNodes(
    nodes: { id: string; axis: string; x: number; y: number; z: number; radius: number; voltage: number }[],
    jitterbugVerts: [number, number, number][],
  ): void {
    const vertexCounts = new Array(12).fill(0);
    this.assignments = [];

    for (const node of nodes) {
      // Find closest jitterbug vertex by Euclidean distance
      // (x,y,z here are bary[0..2], but for proximity we just compare directly)
      let minDist = Infinity;
      let closest = 0;
      for (let v = 0; v < 12; v++) {
        const [vx, vy, vz] = jitterbugVerts[v];
        const dx = node.x - vx;
        const dy = node.y - vy;
        const dz = node.z - vz;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < minDist) {
          minDist = d;
          closest = v;
        }
      }

      const count = vertexCounts[closest];
      vertexCounts[closest]++;

      this.assignments.push({
        ...node,
        vertexIdx: closest,
        offsetAngle: count * 2.399, // golden angle for spiral stacking
      });
    }

    this.activeCount = Math.min(nodes.length, this.maxNodes);
    this.mesh.count = this.activeCount;
  }

  /** Update positions and colors per frame. */
  update(
    jitterbugVerts: [number, number, number][],
    selectedId: string | null,
    time: number,
  ): void {
    for (let i = 0; i < this.activeCount; i++) {
      const a = this.assignments[i];
      const [vx, vy, vz] = jitterbugVerts[a.vertexIdx];

      // Position: jitterbug vertex + stacking offset
      const stackDist = 0.08;
      const ox = Math.cos(a.offsetAngle) * stackDist;
      const oy = Math.sin(a.offsetAngle) * stackDist;
      _pos.set(vx + ox, vy + oy, vz);

      // Scale: base radius + breathing pulse
      const breathPulse = 1 + 0.06 * Math.sin(time * 2 + i * 0.3);
      let scale = a.radius * breathPulse;

      const isSelected = selectedId === a.id;
      if (isSelected) scale *= 2.5;

      _dummy.position.copy(_pos);
      _dummy.scale.set(scale, scale, scale);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);

      // Color
      if (isSelected) {
        _color.copy(WHITE);
      } else {
        _color.copy(AXIS_COLORS[a.axis] ?? AXIS_COLORS.D);
      }
      this.mesh.setColorAt(i, _color);
    }

    // Hide unused
    if (this.activeCount < this.maxNodes) {
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      for (let i = this.activeCount; i < this.maxNodes; i++) {
        this.mesh.setMatrixAt(i, _dummy.matrix);
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Get the world position of a node by index (for edge rendering) */
  getNodePosition(index: number, jitterbugVerts: [number, number, number][]): THREE.Vector3 {
    const a = this.assignments[index];
    if (!a) return new THREE.Vector3();
    const [vx, vy, vz] = jitterbugVerts[a.vertexIdx];
    const stackDist = 0.08;
    return new THREE.Vector3(
      vx + Math.cos(a.offsetAngle) * stackDist,
      vy + Math.sin(a.offsetAngle) * stackDist,
      vz,
    );
  }

  getAssignments(): NodeRenderData[] {
    return this.assignments;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
