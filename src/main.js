import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Network } from './network.js';
import { NetworkView } from './NetworkView.js';
import { ForwardPassAnimation } from './ForwardPassAnimation.js';

// --- Сцена ---
const container = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.Fog(0x0d1117, 30, 70);

const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(6, 10, 8);
scene.add(keyLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 80;

// --- Сеть ---
const view = new NetworkView(scene);
const anim = new ForwardPassAnimation(view);
let network;

const ui = {
  arch: document.getElementById('arch'),
  activation: document.getElementById('activation'),
  speed: document.getElementById('speed'),
  build: document.getElementById('build'),
  run: document.getElementById('run'),
  randomize: document.getElementById('randomize'),
  status: document.getElementById('status'),
  output: document.getElementById('output'),
};

function parseArch(text) {
  const layers = text.split(/[^0-9]+/).filter(Boolean).map(Number);
  if (layers.length < 2 || layers.some(n => n < 1 || n > 64)) {
    throw new Error('Архитектура: от 2 слоёв, 1–64 нейрона в слое, например "3,4,2"');
  }
  return layers;
}

function frameCamera() {
  const s = view.size;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;
  // Сдвигаем цель так, чтобы сеть не пряталась под панелью:
  // на широком экране панель слева (≈320px), на узком — сверху
  const wide = container.clientWidth > 600;
  const panelFrac = wide ? 320 / container.clientWidth : 0;
  const dist = Math.max(s.x / (2 * tanH * (1 - panelFrac)), s.y / (2 * tanV), 5) * 1.3 + s.z / 2;
  const shiftX = -dist * tanH * panelFrac;
  const shiftY = wide ? 0 : dist * tanV * 0.35;
  camera.position.set(shiftX + dist * 0.3, shiftY + dist * 0.2, dist);
  controls.target.set(shiftX, shiftY, 0);
  controls.update();
}

function buildNetwork() {
  try {
    const layers = parseArch(ui.arch.value);
    network = new Network(layers, ui.activation.value);
    anim.stop();
    view.build(network);
    frameCamera();
    setStatus(`Сеть ${layers.join(' → ')} · ${network.weights.flat(2).length} весов`);
    ui.output.textContent = '';
  } catch (e) {
    setStatus(e.message, true);
  }
}

function runForward() {
  if (!network) return;
  const input = network.randomInput();
  const acts = network.forward(input);
  ui.run.disabled = true;
  ui.output.textContent = '';
  anim.start(acts, result => {
    ui.run.disabled = false;
    const out = result.at(-1).map(v => v.toFixed(3)).join(', ');
    const inp = input.map(v => v.toFixed(2)).join(', ');
    ui.output.textContent = `вход [${inp}] → выход [${out}]`;
    setStatus('Forward-pass завершён');
  });
}

function setStatus(text, isError = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle('error', isError);
}

ui.build.addEventListener('click', buildNetwork);
ui.arch.addEventListener('keydown', e => { if (e.key === 'Enter') buildNetwork(); });
ui.activation.addEventListener('change', () => { if (network) network.activation = ui.activation.value; });
ui.randomize.addEventListener('click', () => {
  if (!network) return;
  network.randomize();
  anim.stop();
  view.build(network);
  ui.run.disabled = false;
  setStatus('Веса перегенерированы');
});
ui.run.addEventListener('click', runForward);
ui.speed.addEventListener('input', () => { anim.stageDuration = 1.2 / Number(ui.speed.value); });
addEventListener('keydown', e => {
  if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && !ui.run.disabled) {
    e.preventDefault();
    runForward();
  }
});

new ResizeObserver(() => {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}).observe(container);

// --- Цикл рендера ---
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  anim.update(dt);
  if (anim.running) setStatus(`Forward-pass: слой ${anim.currentLayer + 1} из ${network.layers.length}`);
  controls.update();
  renderer.render(scene, camera);
});

anim.stageDuration = 1.2 / Number(ui.speed.value);
buildNetwork();

// Для отладки из консоли
window.lab = { scene, camera, network: () => network, view, anim, runForward, buildNetwork };
