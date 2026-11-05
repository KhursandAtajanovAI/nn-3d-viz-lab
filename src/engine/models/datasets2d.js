// Двумерные наборы данных для учебной классификации (точки в квадрате [-1, 1]², метки 0/1).
import { L } from '../../i18n/i18n.js';


function gauss(rnd) {
  return Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
}

export const DATASETS_2D = {
  xor: {
    name: L('ds2d.xor.name'),
    note: L('ds2d.xor.note'),
    make(rnd, n = 160) {
      const X = [], Y = [];
      for (let i = 0; i < n; i++) {
        const sx = i % 2 ? 1 : -1, sy = (i >> 1) % 2 ? 1 : -1;
        X.push([sx * 0.5 + gauss(rnd) * 0.18, sy * 0.5 + gauss(rnd) * 0.18]);
        Y.push([sx * sy > 0 ? 0 : 1]);
      }
      return { X, Y };
    },
  },
  circles: {
    name: L('ds2d.circles.name'),
    note: L('ds2d.circles.note'),
    make(rnd, n = 160) {
      const X = [], Y = [];
      for (let i = 0; i < n; i++) {
        const inner = i % 2 === 0;
        const r = inner ? rnd() * 0.38 : 0.62 + rnd() * 0.3, a = rnd() * Math.PI * 2;
        X.push([r * Math.cos(a), r * Math.sin(a)]);
        Y.push([inner ? 1 : 0]);
      }
      return { X, Y };
    },
  },
  moons: {
    name: L('ds2d.moons.name'),
    note: L('ds2d.moons.note'),
    make(rnd, n = 160) {
      const X = [], Y = [];
      for (let i = 0; i < n; i++) {
        const top = i % 2 === 0, t = rnd() * Math.PI;
        const x = top ? Math.cos(t) - 0.5 : 0.5 - Math.cos(t), y = top ? Math.sin(t) * 0.8 - 0.15 : -Math.sin(t) * 0.8 + 0.15;
        X.push([x * 0.62 + gauss(rnd) * 0.05, y * 0.62 + gauss(rnd) * 0.05]);
        Y.push([top ? 1 : 0]);
      }
      return { X, Y };
    },
  },
  spiral: {
    name: L('ds2d.spirals.name'),
    note: L('ds2d.spirals.note'),
    make(rnd, n = 200) {
      const X = [], Y = [];
      for (let i = 0; i < n; i++) {
        const cls = i % 2, t = (i / n) * 3.2 + 0.3, a = t * 2.1 + cls * Math.PI;
        const r = t / 3.6;
        X.push([r * Math.cos(a) + gauss(rnd) * 0.02, r * Math.sin(a) + gauss(rnd) * 0.02]);
        Y.push([cls]);
      }
      return { X, Y };
    },
  },
};
