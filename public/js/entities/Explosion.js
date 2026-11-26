import * as THREE from 'three';

function dotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

const ringGeo = new THREE.TorusGeometry(1, 0.06, 6, 32).rotateX(Math.PI / 2);
const tmpColor = new THREE.Color();

/**
 * All particles (explosions, sparks, engine trail) share one Points draw call.
 * Additive blending means fading a particle is just scaling its color to black.
 */
export class Effects {
  constructor(scene, max = 1600) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.span = new Float32Array(max);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(this.geometry, new THREE.PointsMaterial({
      size: 0.5,
      map: dotTexture(),
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.rings = Array.from({ length: 8 }, () => {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, life: 0, span: 1, size: 1 };
    });
  }

  emit(x, y, z, vx, vy, vz, life, color) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const j = i * 3;
    tmpColor.set(color);
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.base[j] = tmpColor.r; this.base[j + 1] = tmpColor.g; this.base[j + 2] = tmpColor.b;
    this.life[i] = life;
    this.span[i] = life;
  }

  burst(position, color, count = 36, speed = 9, life = 0.75) {
    for (let k = 0; k < count; k += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.35 + Math.random() * 0.65);
      this.emit(
        position.x, position.y, position.z,
        Math.sin(phi) * Math.cos(theta) * s,
        Math.cos(phi) * s * 0.6,
        Math.sin(phi) * Math.sin(theta) * s,
        life * (0.5 + Math.random() * 0.5),
        color,
      );
    }
  }

  ring(position, color, size = 4, span = 0.5) {
    const ring = this.rings.find((r) => r.life <= 0) || this.rings[0];
    ring.mesh.position.copy(position);
    ring.mesh.material.color.set(color);
    ring.mesh.visible = true;
    ring.life = span;
    ring.span = span;
    ring.size = size;
  }

  update(dt) {
    const drag = Math.exp(-2.2 * dt);
    for (let i = 0; i < this.max; i += 1) {
      const j = i * 3;
      if (this.life[i] <= 0) {
        this.col[j] = 0; this.col[j + 1] = 0; this.col[j + 2] = 0;
        continue;
      }
      this.life[i] -= dt;
      const fade = Math.max(0, this.life[i] / this.span[i]);
      for (let a = 0; a < 3; a += 1) {
        this.pos[j + a] += this.vel[j + a] * dt;
        this.vel[j + a] *= drag;
        this.col[j + a] = this.base[j + a] * fade;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.life -= dt;
      const p = 1 - Math.max(0, ring.life) / ring.span;
      ring.mesh.scale.setScalar(0.2 + p * ring.size);
      ring.mesh.material.opacity = 1 - p;
      ring.mesh.visible = ring.life > 0;
    }
  }

  clear() {
    this.life.fill(0);
    this.rings.forEach((r) => {
      r.life = 0;
      r.mesh.visible = false;
    });
  }
}
