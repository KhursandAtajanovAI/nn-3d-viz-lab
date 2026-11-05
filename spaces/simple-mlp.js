// Простейшая полносвязная сеть 3 → 4 → 2 — первое знакомство с визуализацией.
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.simple-mlp');

export default {
  meta: {
    id: 'simple-mlp',
    title: S('title'),
    category: 'basics',
    order: 10,
    level: 1,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['MLP', 'forward pass'],
    preview: [3, 4, 2],
  },

  type: 'mlp',
  model: { layers: [3, 4, 2], activation: 'tanh', outputActivation: 'sigmoid', seed: 42 },
  names: { input: ['x₁', 'x₂', 'x₃'], output: ['y₁', 'y₂'] },

  intro: S('introHtml'),

  sections: [{ title: S('startTitle'), html: S('startHtml') }],
};
