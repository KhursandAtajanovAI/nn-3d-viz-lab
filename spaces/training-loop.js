// Цикл обучения: эпоха за эпохой, с живым графиком ошибки и границей решений.
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.training-loop');

export default {
  meta: {
    id: 'training-loop',
    title: S('title'),
    category: 'training',
    order: 30,
    level: 1,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['training', 'loss', 'epochs', 'decision-boundary', 'learning rate'],
    preview: [2, 8, 8, 1],
  },

  type: 'train',
  mode: 'loop',
  dataset: 'circles',
  model: { layers: [2, 8, 8, 1], activation: 'tanh', outputActivation: 'sigmoid', seed: 3 },
  lr: 0.05,
  maxEpochs: 600,
  names: { input: ['x', 'y'], output: [S('cls')] },

  intro: S('introHtml'),

  sections: [
    { title: S('tryTitle'), html: S('tryHtml') },
    { title: S('curveTitle'), open: false, html: S('curveHtml') },
  ],
};
