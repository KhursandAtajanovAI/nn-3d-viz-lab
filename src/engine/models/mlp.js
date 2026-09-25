// Простая полносвязная сеть (многослойный перцептрон): хранит веса и считает forward-pass.
// Модуль не зависит от Three.js — его могут импортировать конфиги пространств и каталог.

export const ACTIVATIONS = {
  tanh: Math.tanh,
  relu: x => Math.max(0, x),
  sigmoid: x => 1 / (1 + Math.exp(-x)),
  linear: x => x,
};

/** Детерминированный генератор (mulberry32): одинаковый seed → одинаковые веса */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MLP {
  /**
   * @param {number[]} layers — число нейронов в каждом слое
   * @param {object} [opts]
   * @param {string} [opts.activation='tanh'] — активация скрытых слоёв
   * @param {string} [opts.outputActivation='sigmoid'] — активация выходного слоя
   * @param {number} [opts.seed] — seed для воспроизводимых весов; без него — Math.random
   */
  constructor(layers, { activation = 'tanh', outputActivation = 'sigmoid', seed } = {}) {
    if (layers.length < 2) throw new Error('Нужно минимум 2 слоя');
    this.layers = layers;
    this.activation = activation;
    this.outputActivation = outputActivation;
    this.random = seed === undefined ? Math.random : seededRandom(seed);
    this.randomize();
  }

  // Нормальное распределение (Box–Muller)
  randn() {
    const u = 1 - this.random(), v = this.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Инициализация Xavier: weights[l][j][i] — связь от нейрона i слоя l к нейрону j слоя l+1
  randomize() {
    this.weights = [];
    this.biases = [];
    this.lastZ = null;
    for (let l = 0; l < this.layers.length - 1; l++) {
      const nIn = this.layers[l], nOut = this.layers[l + 1];
      const scale = Math.sqrt(2 / (nIn + nOut));
      this.weights.push(Array.from({ length: nOut }, () =>
        Array.from({ length: nIn }, () => this.randn() * scale * 1.5)));
      this.biases.push(Array.from({ length: nOut }, () => this.randn() * 0.1));
    }
  }

  randomInput() {
    return Array.from({ length: this.layers[0] }, () => Math.random() * 2 - 1);
  }

  /** Функция активации слоя l (у входного — нет) */
  activationName(l) {
    if (l === 0) return null;
    return l === this.layers.length - 1 ? this.outputActivation : this.activation;
  }

  /**
   * @returns {number[][]} активации всех слоёв, включая входной.
   * Взвешенные суммы z = Σ w·x + b сохраняются в this.lastZ (для пояснений в UI).
   */
  forward(input) {
    const out = [input];
    this.lastZ = [null];
    for (let l = 0; l < this.weights.length; l++) {
      const prev = out[l];
      const name = this.activationName(l + 1);
      const W = this.weights[l], B = this.biases[l];
      const z = new Array(W.length);
      for (let j = 0; j < W.length; j++) {
        const row = W[j];
        let s = B[j];
        for (let i = 0; i < row.length; i++) s += row[i] * prev[i];
        z[j] = s;
      }
      this.lastZ.push(z);
      out.push(name === 'softmax' ? softmax(z) : z.map(ACTIVATIONS[name]));
    }
    this.lastActs = out;
    return out;
  }

  /** Функция потерь по умолчанию: softmax → перекрёстная энтропия, sigmoid → бинарная, иначе MSE */
  get lossName() {
    return this.outputActivation === 'softmax' ? 'ce' : this.outputActivation === 'sigmoid' ? 'bce' : 'mse';
  }

  loss(output, target) {
    const eps = 1e-9;
    switch (this.lossName) {
      case 'ce': return -target.reduce((s, t, j) => s + t * Math.log(output[j] + eps), 0);
      case 'bce': return -target.reduce((s, t, j) => s + t * Math.log(output[j] + eps) + (1 - t) * Math.log(1 - output[j] + eps), 0) / target.length;
      default: return target.reduce((s, t, j) => s + (output[j] - t) ** 2, 0) / target.length;
    }
  }

  /**
   * Обратное распространение ошибки для последнего forward().
   * @returns {{ deltas: number[][], gradW: number[][][], gradB: number[][] }}
   *   deltas[l][i] = ∂L/∂z нейрона i слоя l (у входного слоя — null)
   */
  backward(target) {
    const acts = this.lastActs, Z = this.lastZ;
    const L = this.layers.length - 1;
    const deltas = new Array(L + 1).fill(null);
    const out = acts[L];
    // Для пар softmax+CE и sigmoid+BCE производная упрощается до (a − t)
    deltas[L] = this.lossName === 'mse'
      ? out.map((a, j) => (2 * (a - target[j]) / out.length) * deriv(this.outputActivation, a, Z[L][j]))
      : out.map((a, j) => a - target[j]);

    for (let l = L - 1; l >= 1; l--) {
      const W = this.weights[l], dNext = deltas[l + 1], name = this.activationName(l);
      deltas[l] = acts[l].map((a, i) => {
        let s = 0;
        for (let j = 0; j < W.length; j++) s += W[j][i] * dNext[j];
        return s * deriv(name, a, Z[l][i]);
      });
    }

    const gradW = this.weights.map((W, l) => W.map((row, j) => row.map((_, i) => deltas[l + 1][j] * acts[l][i])));
    const gradB = this.biases.map((b, l) => deltas[l + 1].slice());
    this.lastDeltas = deltas;
    return { deltas, gradW, gradB };
  }

  /** Шаг градиентного спуска: w ← w − lr · ∂L/∂w */
  applyGradients({ gradW, gradB }, lr) {
    this.weights.forEach((W, l) => W.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) row[i] -= lr * gradW[l][j][i];
    }));
    this.biases.forEach((b, l) => { for (let j = 0; j < b.length; j++) b[j] -= lr * gradB[l][j]; });
  }

  /** Один шаг обучения на одном примере; возвращает значение ошибки до шага */
  trainStep(input, target, lr) {
    const acts = this.forward(input);
    const loss = this.loss(acts.at(-1), target);
    // Быстрый путь без хранения полных градиентов: сразу обновляем веса
    const L = this.layers.length - 1;
    const Z = this.lastZ;
    let delta = this.lossName === 'mse'
      ? acts[L].map((a, j) => (2 * (a - target[j]) / target.length) * deriv(this.outputActivation, a, Z[L][j]))
      : acts[L].map((a, j) => a - target[j]);
    for (let l = L - 1; l >= 0; l--) {
      const W = this.weights[l], B = this.biases[l], prev = acts[l];
      let next = null;
      if (l > 0) {
        const name = this.activationName(l);
        next = new Array(prev.length);
        for (let i = 0; i < prev.length; i++) {
          let s = 0;
          for (let j = 0; j < W.length; j++) s += W[j][i] * delta[j];
          next[i] = s * deriv(name, prev[i], Z[l][i]);
        }
      }
      for (let j = 0; j < W.length; j++) {
        const row = W[j], d = lr * delta[j];
        for (let i = 0; i < row.length; i++) row[i] -= d * prev[i];
        B[j] -= d;
      }
      delta = next;
    }
    return loss;
  }

  /**
   * Обучение на наборе данных (синхронно). Возвращает историю средней ошибки по эпохам.
   * @param {number[][]} X @param {number[][]} Y
   */
  fit(X, Y, { epochs = 100, lr = 0.1, onEpoch } = {}) {
    const history = [];
    const order = X.map((_, i) => i);
    for (let e = 0; e < epochs; e++) {
      for (let i = order.length - 1; i > 0; i--) {
        const k = Math.floor(this.random() * (i + 1));
        [order[i], order[k]] = [order[k], order[i]];
      }
      let sum = 0;
      for (const i of order) sum += this.trainStep(X[i], Y[i], lr);
      history.push(sum / X.length);
      onEpoch?.(e, history.at(-1));
    }
    return history;
  }

  /** Копия весов (для «снимков» во время обучения) */
  snapshot() {
    return { weights: this.weights.map(W => W.map(r => r.slice())), biases: this.biases.map(b => b.slice()) };
  }

  restore({ weights, biases }) {
    this.weights = weights.map(W => W.map(r => r.slice()));
    this.biases = biases.map(b => b.slice());
  }
}

export function softmax(z) {
  const m = Math.max(...z);
  const e = z.map(v => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}

/** Производная функции активации через её значение a (и z для ReLU) */
function deriv(name, a, z) {
  switch (name) {
    case 'tanh': return 1 - a * a;
    case 'sigmoid': return a * (1 - a);
    case 'relu': return z > 0 ? 1 : 0;
    default: return 1;
  }
}
