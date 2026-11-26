import * as THREE from 'three';

export class StarField {
  constructor(scene, count = 1400) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = -Math.random() * 120;
      const tint = Math.random();
      colors[i * 3] = 0.75 + tint * 0.25;
      colors[i * 3 + 1] = 0.82 + tint * 0.1;
      colors[i * 3 + 2] = 1;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.9 }),
    );
    scene.add(this.points);
    this.count = count;
  }

  update(dt, paused) {
    if (paused) return;
    const positions = this.geometry.attributes.position;
    const speed = 18 * dt;
    for (let i = 0; i < this.count; i += 1) {
      let z = positions.getZ(i) + speed;
      if (z > 12) {
        z = -110;
        positions.setX(i, (Math.random() - 0.5) * 90);
        positions.setY(i, (Math.random() - 0.5) * 50);
      }
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
  }
}
