import * as THREE from 'three';
import { rockGeometry } from '../entities/Meteor.js';

/** Decorative rocks drifting past outside the play lane. One InstancedMesh = one draw call. */
export class AsteroidField {
  constructor(scene, count = 70) {
    this.mesh = new THREE.InstancedMesh(
      rockGeometry(),
      new THREE.MeshStandardMaterial({ color: 0x3e3a48, flatShading: true, roughness: 0.95 }),
      count,
    );
    this.rocks = Array.from({ length: count }, () => this.place({}, -Math.random() * 140));
    this.dummy = new THREE.Object3D();
    scene.add(this.mesh);
  }

  place(rock, z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    rock.x = side * (14 + Math.random() * 30);
    rock.y = (Math.random() - 0.4) * 18;
    rock.z = z;
    rock.size = 0.4 + Math.random() * 2.2;
    rock.rx = Math.random() * 6;
    rock.ry = Math.random() * 6;
    rock.spin = (Math.random() - 0.5) * 0.8;
    return rock;
  }

  update(dt, paused) {
    if (paused) return;
    this.rocks.forEach((rock, i) => {
      rock.z += 14 * dt;
      rock.rx += rock.spin * dt;
      if (rock.z > 15) this.place(rock, -140);
      this.dummy.position.set(rock.x, rock.y, rock.z);
      this.dummy.rotation.set(rock.rx, rock.ry, 0);
      this.dummy.scale.setScalar(rock.size);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
