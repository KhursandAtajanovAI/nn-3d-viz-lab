// MNIST: распознавание рукописных цифр свёрточной сетью. Можно нарисовать цифру мышью.
// Тексты — в словарях src/i18n/<язык>/spaces/mnist.js.
import { syntheticVision, HOW_SYNTHETIC_WORKS, explainTop2 } from '../src/engine/models/syntheticVision.js';
import { generateDigit, DIGIT_CLASSES } from '../src/engine/models/generators.js';
import { scope, L } from '../src/i18n/i18n.js';

const S = scope('sp.mnist');

export default {
  meta: {
    id: 'mnist',
    title: S('title'),
    category: 'vision',
    order: 10,
    level: 1,
    fidelity: 'trained',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['CNN', 'convolutions', 'classification', 'MNIST', 'drawing'],
    preview: { blocks: [[1, 0.1], [0.85, 0.5], [0.45, 0.5], [0.35, 0.7], [0.18, 0.7], [0.6, 0.12], [0.35, 0.12], [0.25, 0.12]] },
  },

  ...syntheticVision({ size: 28, channels: 1, classes: DIGIT_CLASSES, generate: generateDigit, draw: true }),
  accuracyLabel: S('accuracy'),

  intro: S('introHtml'),

  sections: [
    { title: L('sv.howTitle'), html: HOW_SYNTHETIC_WORKS },
    { title: S('tryTitle'), open: false, html: S('tryHtml') },
  ],

  explainResult: explainTop2,
};
