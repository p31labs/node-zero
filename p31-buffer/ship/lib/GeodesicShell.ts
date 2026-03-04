import * as THREE from 'three';

export class GeodesicShell {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  private pulseTime = 0;
  private pulseActive = false;
  private pulseDur = 0;
  private baseOpacity = 0.06;

  constructor() {
    const geo = new THREE.IcosahedronGeometry(1.2, 2);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x00E878,
      transparent: true,
      opacity: this.baseOpacity,
      wireframe: true,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
  }

  setOpacity(o: number) {
    this.baseOpacity = o;
    this.mat.opacity = o;
  }

  pulse(duration: number) {
    this.pulseActive = true;
    this.pulseDur = duration;
    this.pulseTime = 0;
  }

  update(dt: number) {
    this.mesh.rotation.y += dt * 0.05;
    this.mesh.rotation.x += dt * 0.02;

    if (this.pulseActive) {
      this.pulseTime += dt;
      const p = this.pulseTime / this.pulseDur;
      if (p >= 1.0) {
        this.pulseActive = false;
        this.mat.opacity = this.baseOpacity;
      } else {
        const i = p < 0.5 ? p * 2 : (1.0 - p) * 2;
        this.mat.opacity = this.baseOpacity + i * 0.15;
      }
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
