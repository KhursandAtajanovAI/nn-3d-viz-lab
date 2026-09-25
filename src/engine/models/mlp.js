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
      const f = ACTIVATIONS[this.activationName(l + 1)];
      const z = this.weights[l].map((row, j) =>
        row.reduce((s, w, i) => s + w * prev[i], this.biases[l][j]));
      this.lastZ.push(z);
      out.push(z.map(f));
    }
    return out;
  }
}
