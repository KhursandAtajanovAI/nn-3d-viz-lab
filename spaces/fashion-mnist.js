// Fashion-MNIST: та же сеть, что и для цифр, но на силуэтах одежды и обуви.
// Тексты — в словарях src/i18n/<язык>/spaces/fashion-mnist.js.
import { syntheticVision, HOW_SYNTHETIC_WORKS } from '../src/engine/models/syntheticVision.js';
import { generateFashion, FASHION_CLASSES } from '../src/engine/models/generators.js';
import { scope, L, str } from '../src/i18n/i18n.js';

const S = scope('sp.fashion-mnist');

export default {
  meta: {
    id: 'fashion-mnist',
    title: S('title'),
    category: 'vision',
    order: 20,
    level: 1,
    fidelity: 'trained',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['CNN', 'convolutions', 'classification', 'Fashion-MNIST'],
    preview: { blocks: [[1, 0.1], [0.85, 0.5], [0.45, 0.5], [0.35, 0.7], [0.18, 0.7], [0.6, 0.12], [0.35, 0.12], [0.25, 0.12]] },
  },

  ...syntheticVision({ size: 28, channels: 1, classes: FASHION_CLASSES, generate: generateFashion }),
  accuracyLabel: S('accuracy'),

  intro: S('introHtml'),

  sections: [
    { title: L('sv.howTitle'), html: HOW_SYNTHETIC_WORKS },
    { title: S('confuseTitle'), open: false, html: S('confuseHtml') },
  ],

  explainResult(result, { classes }) {
    const order = result.probs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const [[p1, c1], [p2, c2]] = order;
    const close = p1 - p2 < 0.25;
    const p = { c1: str(classes[c1]), p1: Math.round(p1 * 100), c2: str(classes[c2]), p2: Math.round(p2 * 100) };
    return `<p>${S.h('answerHtml', p)}
      ${S.h(close ? 'closeHtml' : 'farHtml', p)}</p>`;
  },
};
