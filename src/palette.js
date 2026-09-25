import * as THREE from 'three';

// Единая палитра: тёплый = положительное, холодный = отрицательное, серый = слабое/нейтральное.
// Те же значения продублированы как CSS-переменные в styles.css.
export const PALETTE = {
  background: 0x0a0e17,
  neuronIdle: 0x8a9ab3,
  positive: 0xff9f1c,
  negative: 0x2f9bff,
  neutral: 0x4a5264,
  pulse: 0xfff4d6,
  hover: 0xffffff,
};

const POS = new THREE.Color(PALETTE.positive);
const NEG = new THREE.Color(PALETTE.negative);
const NEUTRAL = new THREE.Color(PALETTE.neutral);

/** Цвет связи: от серого (слабый вес) к тёплому/холодному (сильный положительный/отрицательный) */
export function weightColor(w, maxAbs, target = new THREE.Color()) {
  const k = Math.min(1, Math.abs(w) / (maxAbs || 1));
  return target.copy(NEUTRAL).lerp(w >= 0 ? POS : NEG, Math.pow(k, 0.6));
}

/** Цвет знака (для активаций нейронов) */
export function signColor(value) {
  return value >= 0 ? POS : NEG;
}
