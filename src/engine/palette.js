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

const POS = new THREE.Color(PALETTE.positive);
const NEG = new THREE.Color(PALETTE.negative);
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
  NEUTRAL.set(next.neutral);
  IDLE_COLOR.set(next.neuronIdle);
  // hover не перекрашиваем: белый цвет материала у линий с цветами вершин — это множитель, а не цвет
  const keys = ['neutral', 'neuronIdle', 'pulse', 'plate', 'axes', 'cell'];
  return keys.filter(k => prev[k] !== next[k]).map(k => [prev[k], next[k]]);
}
