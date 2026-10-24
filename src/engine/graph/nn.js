// Маленький движок нейросетей для блочного конструктора: последовательная модель из слоёв
// dense / activation / conv2d / maxpool / flatten, функции потерь MSE и кросс-энтропия, SGD и Adam.
// Всё считается по одному примеру за раз (Float32Array), градиенты накапливаются за батч.
// Без зависимостей и без DOM — модуль работает и в браузере, и в Node.
//
// Форма данных: [n] — вектор, [h, w, c] — картинка (хранится плоско, порядок HWC).

const size = shape => shape.reduce((a, b) => a * b, 1);

/** Детерминированный генератор (mulberry32) */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randn = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

function param(n) {
  return { w: new Float32Array(n), g: new Float32Array(n), m: null, v: null };
}

// ---------- Слои ----------

class Dense {
  constructor(inShape, units, r) {
    this.type = 'dense';
    this.nIn = size(inShape);
    this.units = units;
    this.outShape = [units];
    this.W = param(units * this.nIn);
    this.b = param(units);
    const s = Math.sqrt(2 / (this.nIn + units)); // Xavier
    for (let i = 0; i < this.W.w.length; i++) this.W.w[i] = randn(r) * s;
  }
  get params() { return [this.W, this.b]; }
  forward(x) {
    this.x = x;
    const { nIn, units } = this, W = this.W.w, y = new Float32Array(units);
    for (let j = 0; j < units; j++) {
      let s = this.b.w[j];
      const o = j * nIn;
      for (let i = 0; i < nIn; i++) s += W[o + i] * x[i];
      y[j] = s;
    }
    return y;
  }
  backward(dy) {
    const { nIn, units, x } = this, W = this.W.w, gW = this.W.g, dx = new Float32Array(nIn);
    for (let j = 0; j < units; j++) {
      const d = dy[j];
      if (d === 0) continue;
      this.b.g[j] += d;
      const o = j * nIn;
      for (let i = 0; i < nIn; i++) { gW[o + i] += d * x[i]; dx[i] += d * W[o + i]; }
    }
    return dx;
  }
}

const ACT = {
  relu: [v => (v > 0 ? v : 0), (y) => (y > 0 ? 1 : 0)],
  tanh: [Math.tanh, y => 1 - y * y],
  sigmoid: [v => 1 / (1 + Math.exp(-v)), y => y * (1 - y)],
  linear: [v => v, () => 1],
};
export const ACTIVATION_NAMES = ['relu', 'tanh', 'sigmoid', 'softmax', 'linear'];

class Activation {
  constructor(inShape, fn) {
    if (!ACT[fn] && fn !== 'softmax') throw new Error(`Неизвестная активация «${fn}»`);
    this.type = 'activation';
    this.fn = fn;
    this.outShape = inShape;
  }
  get params() { return []; }
  forward(x) {
    let y;
    if (this.fn === 'softmax') {
      y = new Float32Array(x.length);
      let max = -Infinity, sum = 0;
      for (const v of x) if (v > max) max = v;
      for (let i = 0; i < x.length; i++) { y[i] = Math.exp(x[i] - max); sum += y[i]; }
      for (let i = 0; i < x.length; i++) y[i] /= sum;
    } else {
      const f = ACT[this.fn][0];
      y = x.map(f);
    }
    this.y = y;
    return y;
  }
  backward(dy) {
    const y = this.y;
    if (this.fn === 'softmax') {
      // Якобиан softmax: dx_i = y_i (dy_i − Σ dy_j y_j)
      let dot = 0;
      for (let i = 0; i < y.length; i++) dot += dy[i] * y[i];
      return y.map((v, i) => v * (dy[i] - dot));
    }
    const d = ACT[this.fn][1];
    return dy.map((g, i) => g * d(y[i]));
  }
}

class Conv2D {
  constructor(inShape, filters, k, r) {
    if (inShape.length !== 3) throw new Error('Свёртке нужен вход-картинка (h × w × каналы) — подключите датасет изображений');
    const [h, w, c] = inShape;
    if (k > h || k > w) throw new Error(`Ядро ${k}×${k} больше картинки ${h}×${w}`);
    this.type = 'conv';
    Object.assign(this, { h, w, c, k, filters, oh: h - k + 1, ow: w - k + 1 });
    this.outShape = [this.oh, this.ow, filters];
    this.K = param(filters * k * k * c);
    this.b = param(filters);
    const s = Math.sqrt(2 / (k * k * c));
    for (let i = 0; i < this.K.w.length; i++) this.K.w[i] = randn(r) * s;
  }
  get params() { return [this.K, this.b]; }
  forward(x) {
    this.x = x;
    const { w, c, k, filters, oh, ow } = this, K = this.K.w, y = new Float32Array(oh * ow * filters);
    for (let f = 0; f < filters; f++) {
      const kf = f * k * k * c;
      for (let i = 0; i < oh; i++) for (let j = 0; j < ow; j++) {
        let s = this.b.w[f];
        for (let di = 0; di < k; di++) for (let dj = 0; dj < k; dj++) {
          const xo = ((i + di) * w + (j + dj)) * c, ko = kf + (di * k + dj) * c;
          for (let ch = 0; ch < c; ch++) s += K[ko + ch] * x[xo + ch];
        }
        y[(i * ow + j) * filters + f] = s;
      }
    }
    return y;
  }
  backward(dy) {
    const { w, c, k, filters, oh, ow, x } = this, K = this.K.w, gK = this.K.g, dx = new Float32Array(x.length);
    for (let f = 0; f < filters; f++) {
      const kf = f * k * k * c;
      for (let i = 0; i < oh; i++) for (let j = 0; j < ow; j++) {
        const d = dy[(i * ow + j) * filters + f];
        if (d === 0) continue;
        this.b.g[f] += d;
        for (let di = 0; di < k; di++) for (let dj = 0; dj < k; dj++) {
          const xo = ((i + di) * w + (j + dj)) * c, ko = kf + (di * k + dj) * c;
          for (let ch = 0; ch < c; ch++) { gK[ko + ch] += d * x[xo + ch]; dx[xo + ch] += d * K[ko + ch]; }
        }
      }
    }
    return dx;
  }
}

class MaxPool {
  constructor(inShape, p) {
    if (inShape.length !== 3) throw new Error('Пулингу нужен вход-картинка (после свёртки)');
    const [h, w, c] = inShape;
    if (h < p || w < p) throw new Error(`Окно пулинга ${p}×${p} больше карты ${h}×${w}`);
    this.type = 'pool';
    Object.assign(this, { h, w, c, p, oh: Math.floor(h / p), ow: Math.floor(w / p) });
    this.outShape = [this.oh, this.ow, c];
  }
  get params() { return []; }
  forward(x) {
    const { w, c, p, oh, ow } = this, y = new Float32Array(oh * ow * c);
    this.arg = new Int32Array(y.length);
    for (let i = 0; i < oh; i++) for (let j = 0; j < ow; j++) for (let ch = 0; ch < c; ch++) {
      let best = -Infinity, at = 0;
      for (let di = 0; di < p; di++) for (let dj = 0; dj < p; dj++) {
        const idx = ((i * p + di) * w + (j * p + dj)) * c + ch;
        if (x[idx] > best) { best = x[idx]; at = idx; }
      }
      const o = (i * ow + j) * c + ch;
      y[o] = best;
      this.arg[o] = at;
    }
    this.inLen = x.length;
    return y;
  }
  backward(dy) {
    const dx = new Float32Array(this.inLen);
    for (let o = 0; o < dy.length; o++) dx[this.arg[o]] += dy[o];
    return dx;
  }
}

class Flatten {
  constructor(inShape) { this.type = 'flatten'; this.outShape = [size(inShape)]; }
  get params() { return []; }
  forward(x) { return x; }
  backward(dy) { return dy; }
}

// ---------- Модель ----------

/** Описание слоя из блоков: { type: 'dense', units, activation } | { type: 'activation', fn } | { type: 'conv', filters, kernel, activation } | { type: 'pool', size } | { type: 'flatten' } */
export class Network {
  /**
   * @param {object[]} spec — описания слоёв
   * @param {number[]} inputShape
   * @param {number} [seed]
   */
  constructor(spec, inputShape, seed = 1) {
    const r = rng(seed);
    this.inputShape = inputShape;
    this.layers = [];
    let shape = inputShape;
    const push = L => { this.layers.push(L); shape = L.outShape; };
    for (const s of spec) {
      if (s.type === 'dense') {
        if (shape.length > 1) push(new Flatten(shape));
        push(new Dense(shape, s.units, r));
        if (s.activation && s.activation !== 'linear') push(new Activation(shape, s.activation));
      } else if (s.type === 'activation') push(new Activation(shape, s.fn));
      else if (s.type === 'conv') {
        push(new Conv2D(shape, s.filters, s.kernel, r));
        if (s.activation && s.activation !== 'linear') push(new Activation(shape, s.activation));
      } else if (s.type === 'pool') push(new MaxPool(shape, s.size));
      else if (s.type === 'flatten') push(new Flatten(shape));
      else throw new Error(`Неизвестный слой «${s.type}»`);
    }
    this.outputShape = shape;
    this.params = this.layers.flatMap(L => L.params);
    this.paramCount = this.params.reduce((a, p) => a + p.w.length, 0);
    this.step = 0;
  }

  forward(x) {
    let y = x;
    for (const L of this.layers) y = L.forward(y);
    return y;
  }

  /** Прямой проход с сохранением выходов всех слоёв (для карт признаков) */
  trace(x) {
    const outs = [];
    let y = x;
    for (const L of this.layers) { y = L.forward(y); outs.push({ layer: L, shape: L.outShape, values: y }); }
    return outs;
  }

  backward(dy) {
    let g = dy;
    for (let i = this.layers.length - 1; i >= 0; i--) g = this.layers[i].backward(g);
  }

  get endsWithSoftmax() {
    const L = this.layers.at(-1);
    return L?.type === 'activation' && L.fn === 'softmax';
  }

  /**
   * Один пример: прямой проход, потеря, обратный проход (градиенты накапливаются).
   * @param {'ce'|'mse'} loss; для ce target — индекс класса, для mse — Float32Array
   */
  trainSample(x, target, loss) {
    const y = this.forward(x);
    let l, dy;
    if (loss === 'ce') {
      const p = Math.max(y[target], 1e-7);
      l = -Math.log(p);
      if (this.endsWithSoftmax) {
        // softmax + кросс-энтропия: градиент по входу softmax = p − onehot, минуя якобиан
        const g = y.slice();
        g[target] -= 1;
        let i = this.layers.length - 1;
        let grad = g;
        for (i -= 1; i >= 0; i--) grad = this.layers[i].backward(grad);
        return { loss: l, y };
      }
      dy = new Float32Array(y.length);
      dy[target] = -1 / p;
    } else {
      dy = new Float32Array(y.length);
      l = 0;
      for (let i = 0; i < y.length; i++) { const d = y[i] - target[i]; l += d * d; dy[i] = 2 * d / y.length; }
      l /= y.length;
    }
    this.backward(dy);
    return { loss: l, y };
  }

  /** Шаг оптимизатора по накопленным градиентам; градиенты обнуляются */
  apply(optimizer, lr, batch) {
    this.step++;
    const t = this.step, b1 = 0.9, b2 = 0.999, eps = 1e-8, inv = 1 / batch;
    for (const p of this.params) {
      const { w, g } = p;
      if (optimizer === 'adam') {
        if (!p.m) { p.m = new Float32Array(w.length); p.v = new Float32Array(w.length); }
        const { m, v } = p, c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
        for (let i = 0; i < w.length; i++) {
          const gi = g[i] * inv;
          m[i] = b1 * m[i] + (1 - b1) * gi;
          v[i] = b2 * v[i] + (1 - b2) * gi * gi;
          w[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + eps);
        }
      } else {
        for (let i = 0; i < w.length; i++) w[i] -= lr * g[i] * inv;
      }
      g.fill(0);
    }
  }

  /** Краткое описание слоёв для вывода */
  summary() {
    const name = L => ({ dense: `Полносвязный ${L.units}`, activation: L.fn, conv: `Свёртка ${L.filters}×${L.k}×${L.k}`, pool: `Пулинг ${L.p}×${L.p}`, flatten: 'В вектор' })[L.type];
    return this.layers.map(L => ({ name: name(L), shape: L.outShape, params: L.params.reduce((a, p) => a + p.w.length, 0) }));
  }
}

export { size as shapeSize };
