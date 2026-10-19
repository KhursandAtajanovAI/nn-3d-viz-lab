import * as THREE from 'three';
import { themeScene } from './theme.js';

// Единая палитра: тёплый = положительное, холодный = отрицательное, серый = слабое/нейтральное.
// Те же значения продублированы как CSS-переменные в base.css.
// Фон, нейтральный и «покойный» цвета зависят от темы (theme.js) и меняются на лету через applyScenePalette.
const T = themeScene();
export const PALETTE = {
  background: T.background,
  neuronIdle: T.neuronIdle,
  positive: 0xff9f1c,
  negative: 0x2f9bff,
  neutral: T.neutral,
  pulse: T.pulse,
  hover: T.hover,
  accent: T.accent,
  plate: T.plate,
  axes: T.axes,
  cell: T.cell,
  links: T.links,
  glow: T.glow,
};

// Подмена цветов темы (theme.remap: hex → hex). Нужна яркой неоновой теме: светло-зелёные, жёлтые, оранжевые и голубые
// объекты на зелёном фоне сливаются, поэтому они получают более тёмный оттенок. Подмена делается на самом низком уровне —
// в THREE.Color.set (им пользуются конструкторы цветов и материалов), так что конфиги пространств менять не нужно.
let remap = T.remap ?? null;
const hexOf = v => (typeof v === 'number' ? v : /^#[0-9a-f]{6}$/i.test(v) ? parseInt(v.slice(1), 16) : null);
const baseSet = THREE.Color.prototype.set;
THREE.Color.prototype.set = function (r, g, b) {
  if (remap && g === undefined && b === undefined && (typeof r === 'number' || typeof r === 'string')) {
    const to = remap[hexOf(r)];
    if (to !== undefined) r = to;
  }
  return baseSet.call(this, r, g, b);
};

const BASE_POS = 0xff9f1c, BASE_NEG = 0x2f9bff;
const POS = new THREE.Color().set(BASE_POS);
const NEG = new THREE.Color().set(BASE_NEG);
const NEUTRAL = new THREE.Color(PALETTE.neutral);
/** Цвет нейрона «в покое»; общий объект — при смене темы меняется на месте */
export const IDLE_COLOR = new THREE.Color(PALETTE.neuronIdle);

/** Цвет связи: от серого (слабый вес) к тёплому/холодному (сильный положительный/отрицательный) */
export function weightColor(w, maxAbs, target = new THREE.Color()) {
  const k = Math.min(1, Math.abs(w) / (maxAbs || 1));
  return target.copy(NEUTRAL).lerp(w >= 0 ? POS : NEG, Math.pow(k, 0.6));
}

/** Цвет знака (для активаций нейронов) */
export function signColor(value) {
  return value >= 0 ? POS : NEG;
}

/**
 * Накал нейрона по значению: base + k · PALETTE.glow. Запоминаем k в материале,
 * чтобы при смене темы пересчитать накал без перерисовки (SceneKit.applyTheme)
 */
export function setGlow(material, base, k) {
  material.userData.glow = { base, k };
  material.emissiveIntensity = base + k * PALETTE.glow;
}

/** Обновить цвета палитры под тему. Возвращает пары [старый, новый] hex для перекраски готовых материалов */
export function applyScenePalette(next, prev) {
  PALETTE.background = next.background;
  PALETTE.neuronIdle = next.neuronIdle;
  PALETTE.neutral = next.neutral;
  PALETTE.pulse = next.pulse;
  PALETTE.hover = next.hover;
  PALETTE.accent = next.accent;
  PALETTE.plate = next.plate;
  PALETTE.axes = next.axes;
  PALETTE.cell = next.cell;
  PALETTE.links = next.links;
  PALETTE.glow = next.glow;
  remap = next.remap ?? null;
  NEUTRAL.set(next.neutral);
  IDLE_COLOR.set(next.neuronIdle);
  POS.set(BASE_POS);
  NEG.set(BASE_NEG);
  // hover не перекрашиваем: белый цвет материала у линий с цветами вершин — это множитель, а не цвет
  const keys = ['neutral', 'neuronIdle', 'pulse', 'plate', 'axes', 'cell'];
  const pairs = keys.filter(k => prev[k] !== next[k]).map(k => [prev[k], next[k]]);
  // Подменённые цвета: что было на сцене при старой теме → что должно быть при новой
  const bases = new Set([...Object.keys(prev.remap ?? {}), ...Object.keys(next.remap ?? {})].map(Number));
  for (const h of bases) {
    const from = prev.remap?.[h] ?? h, to = next.remap?.[h] ?? h;
    if (from !== to) pairs.push([from, to]);
  }
  return pairs;
}
