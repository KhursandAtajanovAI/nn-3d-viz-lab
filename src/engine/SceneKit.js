import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { PALETTE } from './palette.js';

/**
 * Общая 3D-сцена лаборатории: рендерер, свечение (bloom), HTML-подписи, камера с OrbitControls,
 * подстройка под размер контейнера и цикл рендера. Не знает ничего о нейросетях —
 * её используют и визуализация сетей, и другие пространства (например, поверхность ошибки).
 */
export class SceneKit {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.background);

    const w = container.clientWidth, h = container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    // HTML-подписи (числа, названия слоёв) поверх canvas — чёткие и не размываются bloom
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'labels';
    container.appendChild(this.labelRenderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xdde6ff, 0x1a2233, 1.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(6, 10, 8);
    this.scene.add(keyLight);

    // Свечение: светится только то, что ярче порога — активные нейроны, активные связи и импульсы
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.3, 0.7);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 80;

    this.resizeListeners = [];
    this.frameListeners = [];
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();

    const clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.1);
      for (const fn of this.frameListeners) fn(dt);
      this.controls.update();
      this.composer.render();
      this.labelRenderer.render(this.scene, this.camera);
    });
  }

  get width() { return this.container.clientWidth; }
  get height() { return this.container.clientHeight; }

  /** Вызывается каждый кадр с dt (секунды) */
  onFrame(fn) { this.frameListeners.push(fn); }

  /** Вызывается при изменении размера сцены с (width, height) */
  onResize(fn) {
    this.resizeListeners.push(fn);
    fn(this.width, this.height);
  }

  resize() {
    const w = this.width, h = this.height;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    for (const fn of this.resizeListeners) fn(w, h);
  }

  /**
   * Поставить камеру так, чтобы объект размера size (Vector3) целиком помещался в кадр.
   * margin — запас в мировых единицах по ширине/высоте (под подписи).
   */
  frame(size, { margin = new THREE.Vector2(0, 1.2), target = new THREE.Vector3(0, 0.4, 0) } = {}) {
    const cam = this.camera;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const tanH = tanV * cam.aspect;
    const dist = Math.max((size.x + margin.x) / (2 * tanH), (size.y + margin.y) / (2 * tanV), 5) * 1.2 + size.z / 2;
    cam.position.set(target.x + dist * 0.3, target.y + dist * 0.2, target.z + dist);
    this.controls.target.copy(target);
    this.controls.update();
  }

  /** Лучи для выбора объектов под курсором */
  pointerRay(ev, raycaster) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(p, this.camera);
    return raycaster;
  }
}
