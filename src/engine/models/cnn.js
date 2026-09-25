// Небольшая свёрточная сеть на чистом JS: свёртка, ReLU, max-pooling и обучаемая «голова».
// Без зависимостей от Three.js и DOM (картинки генерируются в generators.js).
//
// Изображение: { w, h, c, data: Float32Array } — значения 0..1, каналы хранятся плоскостями
// (сначала весь канал 0, потом канал 1…). Карта признаков: { w, h, data }.
import { MLP, seededRandom } from './mlp.js';

// ---------- Фильтры первого слоя: классические «детекторы» ----------

function kernelFrom(fn, size = 5) {
  const r = (size - 1) / 2;
  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data[y * size + x] = fn(x - r, y - r);
  // Нормируем, чтобы сумма |w| = 1 (масштаб выходов не зависит от фильтра)
  const s = data.reduce((a, v) => a + Math.abs(v), 0) || 1;
  for (let i = 0; i < data.length; i++) data[i] /= s / 4;
  return { size, data };
}

const g = (x, y, s = 1.3) => Math.exp(-(x * x + y * y) / (2 * s * s));

/** 6 фильтров 5×5 первого свёрточного слоя. Они заданы вручную — как детекторы краёв в классическом зрении. */
export const CONV1_FILTERS = [
  { name: 'Вертикальные края', description: 'реагирует на переход «тёмное → светлое» слева направо', kernel: kernelFrom((x, y) => -x * g(x, y)) },
  { name: 'Горизонтальные края', description: 'реагирует на переход «тёмное → светлое» сверху вниз', kernel: kernelFrom((x, y) => -y * g(x, y)) },
  { name: 'Диагональ ↘', description: 'реагирует на наклонные линии сверху-слева вниз-вправо', kernel: kernelFrom((x, y) => (Math.abs(x - y) < 1 ? 1 : -0.35) * g(x, y, 1.8)) },
  { name: 'Диагональ ↗', description: 'реагирует на наклонные линии снизу-слева вверх-вправо', kernel: kernelFrom((x, y) => (Math.abs(x + y) < 1 ? 1 : -0.35) * g(x, y, 1.8)) },
  { name: 'Пятно / точка', description: 'реагирует на небольшие светлые пятна и концы штрихов (центр минус окружение)', kernel: kernelFrom((x, y) => g(x, y, 0.9) - 0.55 * g(x, y, 2)) },
  { name: 'Размытие (яркость)', description: 'усредняет яркость в окрестности — показывает, где вообще есть «чернила»', kernel: kernelFrom((x, y) => g(x, y, 1.4)) },
];

/** Второй свёрточный слой: 8 фильтров 3×3, каждый смотрит на пару каналов первого слоя (фиксированные случайные веса) */
function makeConv2(seed = 11) {
  const rnd = seededRandom(seed);
  return Array.from({ length: 8 }, (_, k) => {
    const inputs = [k % 6, (k * 2 + 1) % 6];
    const kernels = inputs.map(() => {
      const data = new Float32Array(9);
      for (let i = 0; i < 9; i++) data[i] = (rnd() * 2 - 1) * 0.6 + (i === 4 ? 0.4 : 0);
      return { size: 3, data };
    });
    return { name: `Комбинация каналов ${inputs[0] + 1} и ${inputs[1] + 1}`, inputs, kernels };
  });
}
export const CONV2_FILTERS = makeConv2();

// ---------- Операции ----------

export function channel(img, c) {
  const n = img.w * img.h;
  return { w: img.w, h: img.h, data: img.data.subarray(c * n, (c + 1) * n) };
}

export function luminance(img) {
  if (img.c === 1) return channel(img, 0);
  const n = img.w * img.h, d = img.data, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.299 * d[i] + 0.587 * d[n + i] + 0.114 * d[2 * n + i];
  return { w: img.w, h: img.h, data: out };
}

/** Свёртка без дополнения краёв («valid»): выход меньше входа на size − 1 */
export function conv2d(map, kernel, out = null, bias = 0) {
  const k = kernel.size, ow = map.w - k + 1, oh = map.h - k + 1;
  const res = out ?? { w: ow, h: oh, data: new Float32Array(ow * oh) };
  const src = map.data, K = kernel.data, W = map.w;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let s = 0;
      for (let ky = 0; ky < k; ky++) {
        const row = (y + ky) * W + x, krow = ky * k;
        for (let kx = 0; kx < k; kx++) s += src[row + kx] * K[krow + kx];
      }
      res.data[y * ow + x] += s + bias;
    }
  }
  return res;
}

export function relu(map) {
  for (let i = 0; i < map.data.length; i++) if (map.data[i] < 0) map.data[i] = 0;
  return map;
}

export function maxPool2(map) {
  const ow = map.w >> 1, oh = map.h >> 1, out = new Float32Array(ow * oh);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const i = 2 * y * map.w + 2 * x;
    out[y * ow + x] = Math.max(map.data[i], map.data[i + 1], map.data[i + map.w], map.data[i + map.w + 1]);
  }
  return { w: ow, h: oh, data: out };
}

function avgPoolTo(map, size) {
  const out = new Float32Array(size * size);
  const sx = map.w / size, sy = map.h / size;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    out[Math.min(size - 1, Math.floor(y / sy)) * size + Math.min(size - 1, Math.floor(x / sx))] += map.data[y * map.w + x];
  }
  for (let i = 0; i < out.length; i++) out[i] /= sx * sy;
  return out;
}

/**
 * Прогон картинки через свёрточную часть. Возвращает все промежуточные карты (для 3D-сцены)
 * и вектор признаков для классификатора.
 */
export function extractFeatures(img) {
  const lum = luminance(img);
  const conv1 = CONV1_FILTERS.map(f => relu(conv2d(lum, f.kernel)));
  const pool1 = conv1.map(maxPool2);
  const conv2 = CONV2_FILTERS.map(f => {
    const ow = pool1[0].w - 2, oh = pool1[0].h - 2;
    const out = { w: ow, h: oh, data: new Float32Array(ow * oh) };
    f.inputs.forEach((c, i) => conv2d(pool1[c], f.kernels[i], out));
    return relu(out);
  });
  const pool2 = conv2.map(maxPool2);
  const parts = pool2.map(m => m.data);
  // Для цветных картинок добавляем грубую «цветовую карту» 4×4 по каждому каналу:
  // свёртки смотрят на яркость, а цвет (зелёная лягушка, синее море) тоже важен
  if (img.c === 3) for (let c = 0; c < 3; c++) parts.push(avgPoolTo(channel(img, c), 4));
  const len = parts.reduce((a, p) => a + p.length, 0);
  const features = new Float32Array(len);
  let o = 0;
  for (const p of parts) { features.set(p, o); o += p.length; }
  return { input: img, conv1, pool1, conv2, pool2, features };
}

/** Форма слоёв (для описания архитектуры в конфиге) */
export function featureShapes(size, channels) {
  const c1 = size - 4, p1 = c1 >> 1, c2 = p1 - 2, p2 = c2 >> 1;
  const flat = p2 * p2 * 8 + (channels === 3 ? 48 : 0);
  return { c1, p1, c2, p2, flat };
}

// ---------- Обучение «головы» на синтетических картинках ----------

const tick = () => new Promise(r => setTimeout(r, 0));

/**
 * Обучить полносвязную «голову» (признаки → hidden → классы) на картинках из генератора.
 * Свёрточные фильтры фиксированы, обучаются только полносвязные слои — поэтому это быстро.
 *
 * @param {object} o
 * @param {(cls: number, rnd: () => number) => object} o.generate — генератор картинки класса
 * @param {number} o.classes — число классов
 * @returns {Promise<{ classify, accuracy, net }>}
 */
export async function trainSyntheticClassifier({
  generate, classes, perClass = 90, hidden = 32, epochs = 14, lr = 0.02, seed = 3, onProgress,
}) {
  const rnd = seededRandom(seed);
  const X = [], Y = [];
  for (let k = 0; k < perClass; k++) {
    for (let c = 0; c < classes; c++) {
      X.push(extractFeatures(generate(c, rnd)).features);
      Y.push(Array.from({ length: classes }, (_, j) => (j === c ? 1 : 0)));
    }
    if (k % 15 === 0) { onProgress?.({ phase: 'data', done: k, total: perClass }); await tick(); }
  }

  // Стандартизация признаков: (x − среднее) / σ — так обучение идёт ровнее
  const n = X[0].length, mu = new Float32Array(n), sd = new Float32Array(n);
  for (const x of X) for (let i = 0; i < n; i++) mu[i] += x[i] / X.length;
  for (const x of X) for (let i = 0; i < n; i++) sd[i] += (x[i] - mu[i]) ** 2 / X.length;
  for (let i = 0; i < n; i++) sd[i] = Math.sqrt(sd[i]) + 1e-3;
  const standardize = f => Array.from(f, (v, i) => (v - mu[i]) / sd[i]);
  const Xs = X.map(standardize);

  const net = new MLP([n, hidden, classes], { activation: 'relu', outputActivation: 'softmax', seed });
  const history = [];
  for (let e = 0; e < epochs; e++) {
    history.push(net.fit(Xs, Y, { epochs: 1, lr: lr * (1 - e / (epochs * 1.4)) })[0]);
    onProgress?.({ phase: 'train', epoch: e + 1, epochs, loss: history.at(-1) });
    await tick();
  }

  // Точность на новых картинках, которых сеть не видела
  let correct = 0, total = 0;
  const testRnd = seededRandom(seed + 1000);
  for (let k = 0; k < 20; k++) for (let c = 0; c < classes; c++) {
    const out = net.forward(standardize(extractFeatures(generate(c, testRnd)).features)).at(-1);
    correct += out.indexOf(Math.max(...out)) === c ? 1 : 0;
    total++;
  }

  return {
    net,
    history,
    accuracy: correct / total,
    /** Полный прогон: карты всех слоёв, скрытый слой и вероятности классов */
    classify(img) {
      const stages = extractFeatures(img);
      const acts = net.forward(standardize(stages.features));
      return { ...stages, hidden: acts[1], probs: acts[2] };
    },
  };
}
