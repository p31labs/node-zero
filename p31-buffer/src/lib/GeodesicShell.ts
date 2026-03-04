/**
 * GeodesicShell.ts — 2V icosahedral geodesic wireframe
 * Encloses the IVM as the outer "Spaceship Earth" boundary
 */
import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2;

function subdivide(
  verts: [number, number, number][],
  faces: [number, number, number][],
  radius: number,
  iterations: number
): { verts: [number, number, number][]; edges: [number, number][] } {
  let v = [...verts];
  let f = [...faces];
  const midCache: Map<string, number> = new Map();

  function getMid(a: number, b: number): number {
    const key = `${Math.min(a, b)}_${Math.max(a, b)}`;
    const cached = midCache.get(key);
    if (cached !== undefined) return cached;

    const [ax, ay, az] = v[a];
    const [bx, by, bz] = v[b];
    let mx = (ax + bx) / 2;
    let my = (ay + by) / 2;
    let mz = (az + bz) / 2;
    // Project onto sphere
    const len = Math.hypot(mx, my, mz) || 0.001;
    mx = (mx / len) * radius;
    my = (my / len) * radius;
    mz = (mz / len) * radius;
    const idx = v.length;
    v.push([mx, my, mz]);
    midCache.set(key, idx);
    return idx;
  }

  for (let i = 0; i < iterations; i++) {
    const newFaces: [number, number, number][] = [];
    midCache.clear();
    for (const [a, b, c] of f) {
      const ab = getMid(a, b);
      const bc = getMid(b, c);
      const ca = getMid(c, a);
      newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    f = newFaces;
  }

  // Extract unique edges
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];
  for (const [a, b, c] of f) {
    for (const [i, j] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = `${Math.min(i, j)}_${Math.max(i, j)}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([i, j]);
      }
    }
  }

  return { verts: v, edges };
}

export class GeodesicShell {
  readonly mesh: THREE.LineSegments;
  private material: THREE.LineBasicMaterial;

  constructor(radius = 3.2, detail = 2) {
    // Icosahedron base vertices
    const t = PHI;
    const raw: [number, number, number][] = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ];
    const baseVerts: [number, number, number][] = raw.map(([x, y, z]) => {
      const len = Math.hypot(x, y, z);
      return [(x / len) * radius, (y / len) * radius, (z / len) * radius];
    });

    const baseFaces: [number, number, number][] = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];

    const { verts, edges } = subdivide(baseVerts, baseFaces, radius, detail);

    // Build line geometry
    const positions: number[] = [];
    for (const [i, j] of edges) {
      positions.push(verts[i][0], verts[i][1], verts[i][2]);
      positions.push(verts[j][0], verts[j][1], verts[j][2]);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    this.material = new THREE.LineBasicMaterial({
      color: 0x1a2a3a,
      transparent: true,
      opacity: 0.15,
    });

    this.mesh = new THREE.LineSegments(geo, this.material);
  }

  setOpacity(opacity: number): void {
    this.material.opacity = Math.max(0, Math.min(1, opacity));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
