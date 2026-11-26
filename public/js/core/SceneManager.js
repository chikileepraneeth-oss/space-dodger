import * as THREE from 'three';

export class SceneManager {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070b14, 0.012);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x070b14);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const hemi = new THREE.HemisphereLight(0x8ecbff, 0x1a1020, 0.85);
    const key = new THREE.DirectionalLight(0xd7f6ff, 1.6);
    key.position.set(-4, 8, 6);
    const rim = new THREE.DirectionalLight(0xff7a3c, 0.55);
    rim.position.set(6, 2, -4);
    this.scene.add(hemi, key, rim);

    this.onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / Math.max(height, 1);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    };
    this.onResize();
    window.addEventListener('resize', this.onResize);

    this.lost = document.createElement('div');
    this.lost.className = 'context-lost';
    this.lost.hidden = true;
    this.lost.textContent = 'Graphics reset. Reload the page to continue.';
    canvas.parentElement.append(this.lost);
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.lost.hidden = false;
    });
  }

  setQuality(quality) {
    const ratio = quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(ratio);
    this.onResize();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
