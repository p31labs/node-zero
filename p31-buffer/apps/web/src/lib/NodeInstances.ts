/**
 * NodeInstances.ts — InstancedMesh renderer for graph nodes
 * Nodes attach to their nearest jitterbug vertex and spiral-stack around it.
 * Pre-allocates all temp objects to avoid per-frame GC.
 *
 * Reference: spaceship-earth.jsx uses scale*15 for visible orbs at camera distance ~6–8.
 * r128 instanceColor fix: pre-allocate InstancedBufferAttribute before first render.
 */
import * as THREE from 'three';
import { COLORS } from './design-tokens';

export interface NodeRenderData {
  id: string;
  axis: string;        // 'A'|'B'|'C'|'D'
  x: number;           // original position x
  y: number;           // original position y
  z: number;           // original position z
  radius: number;      // base radius (0.04–0.08)
  voltage: number;     // 0–10
  vertexIdx: number;   // assigned jitterbug vertex (0–11)
  offsetAngle: number; // golden angle offset for same-vertex stacking
  stackLayer: number;  // 0 = on vertex, 1+ = stacked outward
}

const AXIS_COLORS: Record<string, THREE.Color> = {
  A: new THREE.Color(COLORS.ivmNode.A),
  B: new THREE.Color(COLORS.ivmNode.B),
  C: new THREE.Color(COLORS.ivmNode.C),
  D: new THREE.Color(COLORS.ivmNode.D),
};

const WHITE = new THREE.Color(0xffffff);

// Pre-allocated temp objects — NEVER create these per-frame
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _pos = new THREE.Vector3();
const _vertDir = new THREE.Vector3();

export class NodeInstances {
  readonly mesh: THREE.InstancedMesh;
  private maxNodes: number;
  private assignments: NodeRenderData[] = [];
  private activeCount = 0;
  private materialPrimed = false;

  constructor(maxNodes = 200) {
    this.maxNodes = maxNodes;

    const geo = new THREE.SphereGeometry(1, 16, 12); // unit sphere, scale per instance
    const mat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      emissiveIntensity: 0.5,
      shininess: 80,
      specular: new THREE.Color(0x334455),
      transparent: true,
      opacity: 0.92,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, maxNodes);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // r128 instanceColor fix (GitHub #21786): The shader compiles on first
    // render. If instanceColor is null at that point, the compiled shader
    // will NEVER support per-instance colors — even if you add them later.
    // Fix: directly assign a pre-allocated InstancedBufferAttribute so it
    // exists before the first frame. This matches the working reference impl.
    const colorData = new Float32Array(maxNodes * 3);
    colorData.fill(1.0); // white default
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colorData, 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

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
    jitterbugVerts: [number, number, number][] | THREE.Vector3[],
  ): void {
    const verts = this.normalizeVerts(jitterbugVerts);
    const vertexCounts = new Array(Math.max(verts.length, 12)).fill(0);
    this.assignments = [];

    for (const node of nodes) {
      let minDist = Infinity;
      let closest = 0;
      for (let v = 0; v < verts.length; v++) {
        const [vx, vy, vz] = verts[v] ?? [0, 0, 0];
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
        stackLayer: count,
      });
    }

    this.activeCount = Math.min(nodes.length, this.maxNodes);
    this.mesh.count = this.activeCount;
  }

  /** Update positions and colors per frame. */
  update(
    jitterbugVerts: [number, number, number][] | THREE.Vector3[],
    selectedId: string | null,
    time: number,
  ): void {
    const verts = this.normalizeVerts(jitterbugVerts);

    for (let i = 0; i < this.activeCount; i++) {
      const a = this.assignments[i];
      const [vx, vy, vz] = verts[a.vertexIdx] ?? [0, 0, 0];

      // Direction from origin to vertex (for radial stacking)
      _vertDir.set(vx, vy, vz);
      const vertDist = _vertDir.length();
      if (vertDist > 0.001) _vertDir.normalize();
      else _vertDir.set(0, 1, 0);

      // Stack nodes in a spiral AROUND the vertex, offset radially outward
      // Layer 0: sits right at the vertex
      // Layer 1+: spirals outward at increasing distance
      const stackDist = 0.15 + a.stackLayer * 0.12; // much wider spacing
      const ox = Math.cos(a.offsetAngle) * stackDist;
      const oy = Math.sin(a.offsetAngle) * stackDist;

      // Create a local tangent plane at the vertex for stacking
      // Use cross product with up vector to get tangent basis
      const upish = Math.abs(_vertDir.y) > 0.9
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
      const tangentX = new THREE.Vector3().crossVectors(_vertDir, upish).normalize();
      const tangentY = new THREE.Vector3().crossVectors(tangentX, _vertDir).normalize();

      if (a.stackLayer === 0) {
        _pos.set(vx, vy, vz);
      } else {
        _pos.set(
          vx + tangentX.x * ox + tangentY.x * oy,
          vy + tangentX.y * ox + tangentY.y * oy,
          vz + tangentX.z * ox + tangentY.z * oy,
        );
      }

      // Breathing pulse per node
      const breathPulse = 1 + 0.08 * Math.sin(time * 2 + i * 0.4);

      // Base scale: reference uses scale * 15, where scale ≈ 0.06
      // So visible radius ≈ 0.06 * 15 = 0.9 at unit sphere
      // We use radius directly as the visible scale
      let scale = a.radius * breathPulse;

      const isSelected = selectedId === a.id;
      if (isSelected) scale *= 2.0;

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

    // Hide inactive instances
    if (this.activeCount < this.maxNodes) {
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      for (let i = this.activeCount; i < this.maxNodes; i++) {
        this.mesh.setMatrixAt(i, _dummy.matrix);
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    // One-time shader recompile: force material update on first frame with
    // active nodes so the shader picks up instanceColor support.
    if (!this.materialPrimed && this.activeCount > 0) {
      (this.mesh.material as THREE.Material).needsUpdate = true;
      this.materialPrimed = true;
    }
  }

  /** Get the world position of a node by index (for edge rendering) */
  getNodePosition(index: number, jitterbugVerts: [number, number, number][] | THREE.Vector3[]): THREE.Vector3 {
    const a = this.assignments[index];
    if (!a) return new THREE.Vector3();
    const verts = this.normalizeVerts(jitterbugVerts);
    const [vx, vy, vz] = verts[a.vertexIdx] ?? [0, 0, 0];

    if (a.stackLayer === 0) {
      return new THREE.Vector3(vx, vy, vz);
    }

    // Reconstruct stacked position
    _vertDir.set(vx, vy, vz);
    const vertDist = _vertDir.length();
    if (vertDist > 0.001) _vertDir.normalize();
    else _vertDir.set(0, 1, 0);

    const upish = Math.abs(_vertDir.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
    const tangentX = new THREE.Vector3().crossVectors(_vertDir, upish).normalize();
    const tangentY = new THREE.Vector3().crossVectors(tangentX, _vertDir).normalize();

    const stackDist = 0.15 + a.stackLayer * 0.12;
    const ox = Math.cos(a.offsetAngle) * stackDist;
    const oy = Math.sin(a.offsetAngle) * stackDist;

    return new THREE.Vector3(
      vx + tangentX.x * ox + tangentY.x * oy,
      vy + tangentX.y * ox + tangentY.y * oy,
      vz + tangentX.z * ox + tangentY.z * oy,
    );
  }

  getAssignments(): NodeRenderData[] {
    return this.assignments;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  /** Normalize vertex input to tuple arrays */
  private normalizeVerts(
    jitterbugVerts: [number, number, number][] | THREE.Vector3[],
  ): [number, number, number][] {
    if (
      Array.isArray(jitterbugVerts) &&
      jitterbugVerts.length > 0 &&
      jitterbugVerts[0] instanceof THREE.Vector3
    ) {
      return (jitterbugVerts as THREE.Vector3[]).map(
        (v) => [v.x, v.y, v.z] as [number, number, number],
      );
    }
    return jitterbugVerts as [number, number, number][];
  }
}
