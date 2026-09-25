// Простая полносвязная сеть: хранит веса и считает forward-pass.

const activations = {
  tanh: Math.tanh,
  relu: x => Math.max(0, x),
  sigmoid: x => 1 / (1 + Math.exp(-x)),
};

// Нормальное распределение (Box–Muller)
function randn() {
  const u = 1 - Math.random(), v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Network {
  /** @param {number[]} layers — число нейронов в каждом слое */
  constructor(layers, activation = 'tanh') {
    if (layers.length < 2) throw new Error('Нужно минимум 2 слоя');
    this.layers = layers;
    this.activation = activation;
    this.randomize();
  }

  // Инициализация Xavier: weights[l][j][i] — связь от нейрона i слоя l к нейрону j слоя l+1
  randomize() {
    this.weights = [];
    this.biases = [];
    for (let l = 0; l < this.layers.length - 1; l++) {
      const nIn = this.layers[l], nOut = this.layers[l + 1];
      const scale = Math.sqrt(2 / (nIn + nOut));
      this.weights.push(Array.from({ length: nOut }, () =>
        Array.from({ length: nIn }, () => randn() * scale * 1.5)));
      this.biases.push(Array.from({ length: nOut }, () => randn() * 0.1));
    }
  }

  randomInput() {
    return Array.from({ length: this.layers[0] }, () => Math.random() * 2 - 1);
  }

  /** @returns {number[][]} активации всех слоёв, включая входной */
  forward(input) {
    const f = activations[this.activation];
    const out = [input];
    for (let l = 0; l < this.weights.length; l++) {
      const prev = out[l];
      const isLast = l === this.weights.length - 1;
      out.push(this.weights[l].map((row, j) => {
        const z = row.reduce((s, w, i) => s + w * prev[i], this.biases[l][j]);
        return isLast ? activations.sigmoid(z) : f(z);
      }));
    }
    return out;
  }
}
