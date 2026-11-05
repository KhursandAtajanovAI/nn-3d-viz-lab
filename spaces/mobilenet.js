// MobileNet (2017): лёгкая сеть для телефонов на depthwise-separable свёртках.
// Тексты — в словарях src/i18n/<язык>/spaces/mobilenet.js.
import { generateCifar, CIFAR_CLASSES } from '../src/engine/models/generators.js';
import { demoDistribution, demoActivations } from '../src/engine/models/libraryHelpers.js';
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.mobilenet');

const SIMILAR = { 0: [2, 8], 1: [9], 2: [0], 3: [5], 4: [7], 5: [3], 6: [2], 7: [4], 8: [0], 9: [1] };

export default {
  meta: {
    id: 'mobilenet',
    title: S('title'),
    category: 'library',
    order: 50,
    level: 2,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['CNN', 'MobileNet', 'mobile', 'depthwise'],
    preview: { blocks: [[1, 0.2], [0.8, 0.3], [0.8, 0.4], [0.6, 0.5], [0.45, 0.6], [0.3, 0.75], [0.2, 0.9], [0.4, 0.12], [0.3, 0.12]] },
  },

  type: 'stack',
  layers: [
    { name: S('l.input'), kind: 'input', shape: [224, 224, 3], maps: true, slices: 1 },
    { name: S('l.conv'), kind: 'conv', kernel: 3, shape: [112, 112, 32], params: 864 },
    { name: S('l.dw'), kind: 'dwconv', kernel: 3, shape: [112, 112, 64], params: 2336, note: S('n.dw') },
    { name: S('l.dws'), kind: 'dwconv', kernel: 3, repeat: 2, shape: [56, 56, 128], params: 26432 },
    { name: S('l.dws'), kind: 'dwconv', kernel: 3, repeat: 2, shape: [28, 28, 256], params: 102016 },
    { name: S('l.dws'), kind: 'dwconv', kernel: 3, repeat: 6, shape: [14, 14, 512], params: 1454336 },
    { name: S('l.dws'), kind: 'dwconv', kernel: 3, repeat: 2, shape: [7, 7, 1024], params: 1603072 },
    { name: 'Global avg pool', kind: 'pool', shape: [1024] },
    { name: 'Softmax 1000', kind: 'output', shape: [1000], params: 1025000 },
  ],
  totalParams: 4231976,
  paramsNote: S('paramsNote'),
  resultClasses: CIFAR_CLASSES,
  input: { kind: 'image', size: 32, channels: 3, classes: CIFAR_CLASSES, generate: generateCifar },

  demo(img, { sample, rnd }) {
    const label = sample?.label ?? 0;
    const probs = demoDistribution(10, label, rnd, { similar: SIMILAR[label], confidence: [0.45, 0.8] });
    return { vectors: { 7: demoActivations(rnd), 8: [...probs].sort((a, b) => b - a) }, probs };
  },

  intro: S('introHtml'),

  sections: [{ title: S('tradeTitle'), open: false, html: S('tradeHtml') }],
};
