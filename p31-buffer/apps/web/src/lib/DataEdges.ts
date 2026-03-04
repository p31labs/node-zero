/**
 * DataEdges.ts — Dynamic edge rendering between graph nodes
 * Updates positions each frame to track jitterbug-attached nodes.
 */
import * as THREE from 'three';

export interface EdgeDef {
  source: string;
  target: string;
  type: string;
  weight: number;
}

const HIGHLIGHT_COLOR = new THREE.Color('#4ecdc4');
const DIM_COLOR = new THREE.Color('#1a3040');

export class DataEdges {
  readonly lines: THREE.LineSegments;
  private geo: THREE.BufferGeometry;
  private posAttr: THREE.BufferAttribute;
  private colorAttr: THREE.BufferAttribute;
  private maxEdges: number;
  private edges: EdgeDef[] = [];

  constructor(maxEdges = 400) {
    this.maxEdges = maxEdges;
    this.geo = new THREE.BufferGeometry();

    this.posAttr = new THREE.BufferAttribute(new Float32Array(maxEdges * 6), 3);
    this.colorAttr = new THREE.BufferAttribute(new Float32Array(maxEdges * 6), 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);

    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('color', this.colorAttr);

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
    });

    this.lines = new THREE.LineSegments(this.geo, mat);
    this.geo.setDrawRange(0, 0);
  }

  setEdges(edges: EdgeDef[]): void {
    this.edges = edges.slice(0, this.maxEdges);
  }

  update(
    nodeIdToIndex: Map<string, number>,
    getNodePos: (index: number) => THREE.Vector3,
    selectedId: string | null,
  ): void {
    let vertCount = 0;
    const pa = this.posAttr.array as Float32Array;
    const ca = this.colorAttr.array as Float32Array;

    for (const edge of this.edges) {
      const si = nodeIdToIndex.get(edge.source);
      const ti = nodeIdToIndex.get(edge.target);
      if (si === undefined || ti === undefined) continue;

      const sp = getNodePos(si);
      const tp = getNodePos(ti);

      const off = vertCount * 3;

      pa[off] = sp.x;
      pa[off + 1] = sp.y;
      pa[off + 2] = sp.z;
      pa[off + 3] = tp.x;
      pa[off + 4] = tp.y;
      pa[off + 5] = tp.z;

      const highlight = selectedId === edge.source || selectedId === edge.target;
      const c = highlight ? HIGHLIGHT_COLOR : DIM_COLOR;
      const intensity = highlight ? 0.8 : 0.2;

      ca[off] = c.r * intensity;
      ca[off + 1] = c.g * intensity;
      ca[off + 2] = c.b * intensity;
      ca[off + 3] = c.r * intensity;
      ca[off + 4] = c.g * intensity;
      ca[off + 5] = c.b * intensity;

      vertCount += 2;
    }

    for (let i = vertCount * 3; i < this.maxEdges * 6; i++) {
      pa[i] = 0;
      ca[i] = 0;
    }

    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.geo.setDrawRange(0, vertCount);
  }

  dispose(): void {
    this.geo.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}
