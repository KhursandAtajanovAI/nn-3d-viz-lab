// Градиентный спуск: шарики-оптимизаторы скатываются по поверхности ошибки к минимуму.
// Тексты — в словарях src/i18n/<язык>/spaces/gradient-descent.js.
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.gradient-descent');
const bump = (x, y, cx, cy, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s);

export default {
  meta: {
    id: 'gradient-descent',
    title: S('title'),
    category: 'training',
    order: 10,
    level: 1,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['training', 'gradient-descent', 'optimizers', 'Adam', 'learning rate'],
    preview: { surface: true },
  },

  type: 'surface',
  surfaces: [
    {
      id: 'bowl', name: S('bowl.name'), lr: 0.1, start: [-2.6, 2.2], range: [-3, 3, -3, 3],
      f: (x, y) => x * x + 3 * y * y,
      formula: 'w₁² + 3·w₂²',
      note: S('bowl.note'),
    },
    {
      id: 'rosenbrock', name: S('rosenbrock.name'), lr: 0.01, start: [-1.6, 2.4], range: [-2, 2, -1, 3], log: true,
      f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2,
      formula: '(1 − w₁)² + 10·(w₂ − w₁²)²',
      note: S('rosenbrock.note'),
    },
    {
      id: 'multi', name: S('multi.name'), lr: 0.05, start: [-2.6, 2.4], range: [-3, 3, -3, 3],
      f: (x, y) => 0.08 * (x * x + y * y) - 1.2 * bump(x, y, 1.4, -0.8, 1.2) - 0.7 * bump(x, y, -1.5, 1.4, 0.6) - 0.5 * bump(x, y, -1, -1.8, 0.5) + 1.3,
      formula: S('multi.formula'),
      note: S('multi.note'),
    },
    {
      id: 'saddle', name: S('saddle.name'), lr: 0.05, start: [2.4, 0.02], range: [-2.5, 2.5, -2.5, 2.5],
      f: (x, y) => x * x - y * y + 0.25 * y ** 4 + 1.5,
      formula: 'w₁² − w₂² + 0.25·w₂⁴',
      note: S('saddle.note'),
    },
  ],

  intro: S('introHtml'),

  sections: [{ title: S('tryTitle'), html: S('tryHtml') }],
};
