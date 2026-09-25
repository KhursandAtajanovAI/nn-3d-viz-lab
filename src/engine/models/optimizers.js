// Оптимизаторы для двумерных функций (поверхность ошибки). Без зависимостей.

/** Численный градиент (центральные разности) */
export function numGrad(f, x, y, h = 1e-4) {
  return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
}

export const OPTIMIZERS = {
  sgd: {
    name: 'Градиентный спуск',
    color: '#ff9f1c',
    init: () => ({}),
    step(p, g, s, { lr }) { return [p[0] - lr * g[0], p[1] - lr * g[1]]; },
    formula: 'w ← w − η·∇L',
  },
  momentum: {
    name: 'С моментом',
    color: '#2f9bff',
    init: () => ({ v: [0, 0] }),
    step(p, g, s, { lr, beta = 0.9 }) {
      s.v = [beta * s.v[0] - lr * g[0], beta * s.v[1] - lr * g[1]];
      return [p[0] + s.v[0], p[1] + s.v[1]];
    },
    formula: 'v ← β·v − η·∇L;  w ← w + v',
  },
  adam: {
    name: 'Adam',
    color: '#7ee081',
    init: () => ({ m: [0, 0], v: [0, 0], t: 0 }),
    step(p, g, s, { lr }) {
      const b1 = 0.9, b2 = 0.999, eps = 1e-8;
      s.t++;
      s.m = s.m.map((m, i) => b1 * m + (1 - b1) * g[i]);
      s.v = s.v.map((v, i) => b2 * v + (1 - b2) * g[i] * g[i]);
      const mh = s.m.map(m => m / (1 - b1 ** s.t)), vh = s.v.map(v => v / (1 - b2 ** s.t));
      return p.map((w, i) => w - (lr * mh[i]) / (Math.sqrt(vh[i]) + eps));
    },
    formula: 'шаг ∝ m / √v — своя скорость для каждого веса',
  },
};
