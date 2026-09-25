import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Network } from './network.js';
import { NetworkView } from './NetworkView.js';
import { ForwardPassAnimation } from './ForwardPassAnimation.js';
import { PALETTE } from './palette.js';
import { sceneHtml, hoverHtml, tooltipText, stageText, resultHtml } from './panels.js';

// --- Сцена ---
const container = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.background);

const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

// HTML-подписи (числа, названия слоёв) поверх canvas — чёткие и не размываются bloom
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
container.appendChild(labelRenderer.domElement);

scene.add(new THREE.HemisphereLight(0xdde6ff, 0x1a2233, 1.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
keyLight.position.set(6, 10, 8);
scene.add(keyLight);

// Свечение: светится только то, что ярче порога — активные нейроны, активные связи и импульсы
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.3, 0.7);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 80;

// --- Сеть ---
const view = new NetworkView(scene);
const anim = new ForwardPassAnimation(view);
let network;
let lastResult = null;

const $ = id => document.getElementById(id);
const ui = {
  arch: $('arch'),
  activation: $('activation'),
  speed: $('speed'),
  build: $('build'),
  run: $('run'),
  randomize: $('randomize'),
  modeVisual: $('mode-visual'),
  modeDetail: $('mode-detail'),
  status: $('status'),
  sceneInfo: $('scene-info'),
  hoverInfo: $('hover-info'),
  resultCard: $('result-card'),
  result: $('result'),
  stage: $('stage'),
  tooltip: $('tooltip'),
};

function parseArch(text) {
  const layers = text.split(/[^0-9]+/).filter(Boolean).map(Number);
  if (layers.length < 2 || layers.some(n => n < 1 || n > 64)) {
    throw new Error('Архитектура: минимум 2 слоя, 1–64 нейрона в слое, например «3, 4, 2»');
  }
  return layers;
}

function frameCamera() {
  const s = view.size;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;
  // +1.2 по высоте — запас под подписи слоёв
  const dist = Math.max(s.x / (2 * tanH), (s.y + 1.2) / (2 * tanV), 5) * 1.2 + s.z / 2;
  camera.position.set(dist * 0.3, 0.4 + dist * 0.2, dist);
  controls.target.set(0, 0.4, 0);
  controls.update();
}

// Полная перерисовка сцены с сохранением режима, наведения и т.п.
function rebuildView() {
  anim.stop();
  view.build(network);
  view.setResolution(container.clientWidth, container.clientHeight);
  lastResult = null;
  ui.resultCard.hidden = true;
  ui.run.disabled = false;
  hover = null;
  refreshHover();
  ui.sceneInfo.innerHTML = sceneHtml(network);
  updateStage();
}

function buildNetwork() {
  try {
    const layers = parseArch(ui.arch.value);
    network = new Network(layers, ui.activation.value);
    rebuildView();
    frameCamera();
    setStatus(`Сеть ${layers.join(' → ')} построена`);
  } catch (e) {
    setStatus(e.message, true);
  }
}

function runForward() {
  if (!network || anim.running) return;
  const acts = network.forward(network.randomInput());
  ui.run.disabled = true;
  ui.resultCard.hidden = true;
  anim.start(acts, result => {
    ui.run.disabled = false;
    lastResult = result;
    ui.result.innerHTML = resultHtml(network, result);
    ui.resultCard.hidden = false;
    setStatus('Forward pass завершён — результат ниже');
    updateStage();
    refreshHover();
  });
}

function setStatus(text, isError = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle('error', isError);
}

function setMode(detail) {
  view.setShowNumbers(detail);
  ui.modeVisual.setAttribute('aria-pressed', String(!detail));
  ui.modeDetail.setAttribute('aria-pressed', String(detail));
}

// Этап анимации: текст в карточке forward pass + подсветка слоя в списке
function updateStage() {
  const items = ui.sceneInfo.querySelectorAll('li[data-layer]');
  if (anim.running) {
    const current = anim.stage >> 1;
    const onLayer = anim.stage % 2 === 0;
    items.forEach((li, l) => {
      li.classList.toggle('active', onLayer ? l === current : l === current || l === current + 1);
      li.classList.toggle('done', l < current || (l === current && !onLayer));
    });
    ui.stage.textContent = stageText(anim.stage, network);
    ui.stage.classList.add('live');
  } else {
    items.forEach(li => {
      li.classList.remove('active');
      li.classList.toggle('done', !!lastResult);
    });
    ui.stage.textContent = lastResult
      ? 'Готово: сигнал дошёл до выходного слоя. Запустите ещё раз — вход будет другим.'
      : 'Нажмите «Запустить forward pass» или пробел.';
    ui.stage.classList.remove('live');
  }
}

// --- Наведение на нейроны и связи ---
const raycaster = new THREE.Raycaster();
raycaster.params.Line2 = { threshold: 6 };
const pointer = new THREE.Vector2();
let hover = null;
let pointerEvent = null;

function pick(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);

  const { neurons, connections } = view.pickables;
  const hitN = raycaster.intersectObjects(neurons, false)[0];
  if (hitN) return { type: 'neuron', layer: hitN.object.userData.layer, index: hitN.object.userData.index };

  const hitL = raycaster.intersectObjects(connections, false)[0];
  if (hitL) {
    const c = view.connectionAt(hitL.object.userData.gap, hitL.faceIndex);
    return { type: 'weight', gap: c.gap, from: c.from, to: c.to };
  }
  return null;
}

const sameHover = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function setHover(h) {
  if (sameHover(h, hover)) return;
  hover = h;
  view.setHover(h);
  renderer.domElement.style.cursor = h ? 'pointer' : '';
  refreshHover();
}

function refreshHover() {
  ui.hoverInfo.innerHTML = hoverHtml(hover, network, view.values);
  if (hover && pointerEvent) {
    ui.tooltip.textContent = tooltipText(hover, network, view.values);
    ui.tooltip.hidden = false;
    const rect = container.getBoundingClientRect();
    const x = pointerEvent.clientX - rect.left, y = pointerEvent.clientY - rect.top;
    const flip = x > rect.width - 280; // у правого края показываем подсказку слева от курсора
    ui.tooltip.style.left = `${flip ? x - 14 : x + 14}px`;
    ui.tooltip.style.top = `${Math.max(4, y - 40)}px`; // над курсором, чтобы не закрывать подписи весов
    ui.tooltip.style.transform = flip ? 'translateX(-100%)' : '';
  } else {
    ui.tooltip.hidden = true;
  }
}

let pickQueued = false;
renderer.domElement.addEventListener('pointermove', ev => {
  pointerEvent = ev;
  if (ev.buttons) return; // во время вращения мышью не пересчитываем
  if (pickQueued) return;
  pickQueued = true;
  requestAnimationFrame(() => {
    pickQueued = false;
    setHover(pick(pointerEvent));
    if (hover) refreshHover(); // двигаем подсказку за курсором
  });
});
renderer.domElement.addEventListener('pointerdown', ev => {
  if (ev.pointerType !== 'mouse') { pointerEvent = ev; setHover(pick(ev)); }
});
renderer.domElement.addEventListener('pointerleave', () => { pointerEvent = null; setHover(null); });

// --- Кнопки и клавиши ---
ui.build.addEventListener('click', buildNetwork);
ui.arch.addEventListener('keydown', e => { if (e.key === 'Enter') buildNetwork(); });
ui.activation.addEventListener('change', () => {
  if (!network) return;
  network.activation = ui.activation.value;
  rebuildView();
  setStatus(`Активация скрытых слоёв: ${ui.activation.value}`);
});
ui.randomize.addEventListener('click', () => {
  if (!network) return;
  network.randomize();
  rebuildView();
  setStatus('Веса перегенерированы');
});
ui.run.addEventListener('click', runForward);
ui.speed.addEventListener('input', () => { anim.stageDuration = 1.2 / Number(ui.speed.value); });
ui.modeVisual.addEventListener('click', () => setMode(false));
ui.modeDetail.addEventListener('click', () => setMode(true));
addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); runForward(); }
  if (e.code === 'KeyN') setMode(!view.showNumbers);
});

new ResizeObserver(() => {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
  view.setResolution(w, h);
}).observe(container);

// --- Цикл рендера ---
const clock = new THREE.Clock();
let lastPanelUpdate = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (anim.running) {
    anim.update(dt);
    updateStage();
    // Числа в панели обновляются вместе с яркостью нейронов (не чаще ~12 раз/с)
    const now = performance.now();
    if (hover && now - lastPanelUpdate > 80) { refreshHover(); lastPanelUpdate = now; }
  }
  controls.update();
  composer.render();
  labelRenderer.render(scene, camera);
});

anim.stageDuration = 1.2 / Number(ui.speed.value);
buildNetwork();

// Для отладки из консоли
window.lab = { scene, camera, network: () => network, view, anim, runForward, buildNetwork, setMode, setHover, bloom };
