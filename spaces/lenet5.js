// LeNet-5 (1998): первая успешная свёрточная сеть — читала цифры на банковских чеках.
// Тексты — в словарях src/i18n/<язык>/spaces/lenet5.js.
import { generateDigit, DIGIT_CLASSES } from '../src/engine/models/generators.js';
import { padImage, firstLayerMaps, demoDistribution, demoActivations } from '../src/engine/models/libraryHelpers.js';
import { CONV1_FILTERS } from '../src/engine/models/cnn.js';
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.lenet5');

// Похожие цифры — чаще всего путаются
const SIMILAR = { 0: [6, 8], 1: [7], 2: [7, 3], 3: [8, 5], 4: [9], 5: [3, 6], 6: [5, 0], 7: [1, 2], 8: [3, 0], 9: [4, 7] };

export default {
  meta: {
    id: 'lenet5',
    title: 'LeNet-5 (1998)',
    category: 'library',
    order: 10,
    level: 1,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['CNN', 'LeNet', 'history', 'convolutions', 'MNIST'],
    preview: { blocks: [[1, 0.1], [0.85, 0.35], [0.45, 0.35], [0.32, 0.55], [0.16, 0.55], [0.5, 0.12], [0.4, 0.12], [0.25, 0.12]] },
  },

  type: 'stack',
  layers: [
    { name: S('l.input'), kind: 'input', shape: [32, 32, 1], maps: true, slices: 1, note: S('n.input') },
    { name: S('l.c1'), kind: 'conv', kernel: 5, shape: [28, 28, 6], maps: true, filters: CONV1_FILTERS, note: S('n.c1') },
    { name: S('l.s2'), kind: 'pool', shape: [14, 14, 6], maps: true, note: S('n.s2') },
    { name: S('l.c3'), kind: 'conv', kernel: 5, shape: [10, 10, 16], params: 2416, note: S('n.c3') },
    { name: S('l.s4'), kind: 'pool', shape: [5, 5, 16] },
    { name: S('l.c5'), kind: 'dense', shape: [120], params: 48120 },
    { name: S('l.f6'), kind: 'dense', shape: [84], params: 10164 },
    { name: S('l.out'), kind: 'output', shape: [10], params: 850 },
  ],
  totalParams: 61706,
  outputNames: DIGIT_CLASSES,
  input: { kind: 'image', size: 32, channels: 1, classes: DIGIT_CLASSES, generate: (cls, rnd) => padImage(generateDigit(cls, rnd), 2) },

  demo(img, { sample, rnd }) {
    const { conv, pool } = firstLayerMaps(img);
    const label = sample?.label ?? 0;
    const probs = demoDistribution(10, label, rnd, { similar: SIMILAR[label], confidence: [0.8, 0.97] });
    return { maps: { 1: conv, 2: pool }, vectors: { 5: demoActivations(rnd), 6: demoActivations(rnd), 7: probs }, probs };
  },

  intro: S('introHtml'),

  sections: [{ title: S('historyTitle'), open: false, html: S('historyHtml') }],
};
