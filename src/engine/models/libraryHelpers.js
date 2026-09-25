// Помощники для «библиотечных» пространств: простые операции над картинками и
// правдоподобные демонстрационные распределения. Без зависимостей от Three.js.
import { CONV1_FILTERS, conv2d, relu, maxPool2, luminance } from './cnn.js';

/** Дополнить картинку нулями по краям (как padding в свёртке) */
export function padImage(img, p) {
  const w = img.w + 2 * p, h = img.h + 2 * p, n = w * h;
  const data = new Float32Array(n * img.c);
  for (let c = 0; c < img.c; c++) {
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      data[c * n + (y + p) * w + x + p] = img.data[c * img.w * img.h + y * img.w + x];
    }
  }
  return { w, h, c: img.c, data };
}

/** Карты первого свёрточного слоя (фильтры-детекторы краёв) и пулинг — настоящие вычисления */
export function firstLayerMaps(img, filters = CONV1_FILTERS) {
  const lum = luminance(img);
  const conv = filters.map(f => relu(conv2d(lum, f.kernel)));
  return { conv, pool: conv.map(maxPool2) };
}

/** Размытие 3×3 (для «восстановленной» картинки) */
export function blurImage(img, passes = 1) {
  let cur = img;
  for (let k = 0; k < passes; k++) {
    const out = new Float32Array(cur.data.length);
    const n = cur.w * cur.h;
    for (let c = 0; c < cur.c; c++) {
      for (let y = 0; y < cur.h; y++) for (let x = 0; x < cur.w; x++) {
        let s = 0, m = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= cur.h || xx >= cur.w) continue;
          s += cur.data[c * n + yy * cur.w + xx];
          m++;
        }
        out[c * n + y * cur.w + x] = s / m;
      }
    }
    cur = { ...cur, data: out };
  }
  return cur;
}

export function noiseImage(w, h, rnd, c = 1) {
  return { w, h, c, data: Float32Array.from({ length: w * h * c }, () => rnd()) };
}

/** Смесь двух картинок: (1 − t)·a + t·b */
export function blendImages(a, b, t) {
  return { ...a, data: a.data.map((v, i) => (1 - t) * v + t * b.data[i]) };
}

/**
 * Правдоподобное распределение вероятностей: класс top получает большую долю,
 * «похожие» классы (similar) — заметную, остальные — малую. Сумма = 1.
 */
export function demoDistribution(n, top, rnd, { confidence = [0.55, 0.9], similar = [] } = {}) {
  const p = Array.from({ length: n }, () => rnd() * 0.02);
  similar.forEach(k => { p[k] += 0.05 + rnd() * 0.12; });
  const rest = p.reduce((a, b) => a + b, 0);
  const conf = confidence[0] + rnd() * (confidence[1] - confidence[0]);
  const scale = (1 - conf) / rest;
  const out = p.map(v => v * scale);
  out[top] += conf;
  return out;
}

/** Правдоподобные активации для «столбиков» нейронов (ReLU-подобные) */
export function demoActivations(rnd, n = 12) {
  return Array.from({ length: n }, () => Math.max(0, rnd() * 1.8 - 0.6));
}
