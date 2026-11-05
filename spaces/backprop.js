// Backpropagation шаг за шагом: как ошибка с выхода идёт назад и меняет веса.
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.backprop');

export default {
  meta: {
    id: 'backprop',
    title: S('title'),
    category: 'training',
    order: 20,
    level: 2,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['training', 'backpropagation', 'gradients', 'chain-rule'],
    preview: [2, 3, 1],
  },

  type: 'train',
  mode: 'backprop',
  taskName: 'XOR',
  model: { layers: [2, 3, 1], activation: 'tanh', outputActivation: 'sigmoid', seed: 4 },
  lr: 0.5,
  names: { input: ['x₁', 'x₂'], output: ['XOR'] },
  samples: [
    { name: 'x = (0, 0) → 0', x: [0, 0], t: [0] },
    { name: 'x = (0, 1) → 1', x: [0, 1], t: [1] },
    { name: 'x = (1, 0) → 1', x: [1, 0], t: [1] },
    { name: 'x = (1, 1) → 0', x: [1, 1], t: [0] },
  ],

  intro: S('introHtml'),

  sections: [
    { title: S('chainTitle'), open: false, html: S('chainHtml') },
    { title: S('tryTitle'), open: false, html: S('tryHtml') },
  ],
};
