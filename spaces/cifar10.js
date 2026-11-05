// CIFAR-10: классификация маленьких цветных картинок по 10 категориям.
// Тексты — в словарях src/i18n/<язык>/spaces/cifar10.js.
import { syntheticVision, HOW_SYNTHETIC_WORKS } from '../src/engine/models/syntheticVision.js';
import { generateCifar, CIFAR_CLASSES } from '../src/engine/models/generators.js';
import { scope, L, str } from '../src/i18n/i18n.js';

const S = scope('sp.cifar10');

export default {
  meta: {
    id: 'cifar10',
    title: S('title'),
    category: 'vision',
    order: 30,
    level: 2,
    fidelity: 'trained',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['CNN', 'convolutions', 'classification', 'CIFAR-10', 'color'],
    preview: { blocks: [[1, 0.25], [0.85, 0.5], [0.45, 0.5], [0.38, 0.7], [0.2, 0.7], [0.6, 0.12], [0.35, 0.12], [0.25, 0.12]] },
  },

  ...syntheticVision({ size: 32, channels: 3, classes: CIFAR_CLASSES, generate: generateCifar, perClass: 80 }),
  accuracyLabel: S('accuracy'),

  intro: S('introHtml'),

  sections: [
    { title: L('sv.howTitle'), html: HOW_SYNTHETIC_WORKS },
    { title: S('bgTitle'), open: false, html: S('bgHtml') },
  ],

  explainResult(result, { classes }) {
    const order = result.probs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const [[p1, c1], [p2, c2]] = order;
    return S.h('explainHtml', { c1: str(classes[c1]), p1: Math.round(p1 * 100), c2: str(classes[c2]), p2: Math.round(p2 * 100) });
  },
};
