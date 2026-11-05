// ResNet-18 (2015): остаточные связи, благодаря которым обучаются сети в сотни слоёв.
// Тексты — в словарях src/i18n/<язык>/spaces/resnet.js.
import { generateCifar, CIFAR_CLASSES } from '../src/engine/models/generators.js';
import { demoDistribution, demoActivations } from '../src/engine/models/libraryHelpers.js';
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.resnet');

const SIMILAR = { 0: [2, 8], 1: [9], 2: [0], 3: [5], 4: [7], 5: [3], 6: [2], 7: [4], 8: [0], 9: [1] };

export default {
  meta: {
    id: 'resnet',
    title: S('title'),
    category: 'library',
    order: 40,
    level: 2,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['CNN', 'ResNet', 'skip connections', 'ImageNet'],
    preview: { blocks: [[1, 0.2], [0.7, 0.4], [0.55, 0.4], [0.55, 0.4], [0.4, 0.55], [0.3, 0.7], [0.2, 0.85], [0.35, 0.12]], skips: [[2, 3], [3, 4], [4, 5], [5, 6]] },
  },

  type: 'stack',
  layers: [
    { name: S('l.input'), kind: 'input', shape: [224, 224, 3], maps: true, slices: 1 },
    { name: S('l.conv'), kind: 'conv', kernel: 7, shape: [112, 112, 64], params: 9472 },
    { name: 'Max-pool', kind: 'pool', shape: [56, 56, 64] },
    { name: S('l.stage', { n: 1 }), kind: 'conv', repeat: 2, shape: [56, 56, 64], params: 147968, note: S('n.stage1') },
    { name: S('l.stage', { n: 2 }), kind: 'conv', repeat: 2, shape: [28, 28, 128], params: 525568 },
    { name: S('l.stage', { n: 3 }), kind: 'conv', repeat: 2, shape: [14, 14, 256], params: 2099712 },
    { name: S('l.stage', { n: 4 }), kind: 'conv', repeat: 2, shape: [7, 7, 512], params: 8393728 },
    { name: 'Global avg pool', kind: 'pool', shape: [512] },
    { name: 'Softmax 1000', kind: 'output', shape: [1000], params: 513000 },
  ],
  totalParams: 11689512,
  skips: [
    { from: 2, to: 3, label: S('skip') },
    { from: 3, to: 4, label: '+' },
    { from: 4, to: 5, label: '+' },
    { from: 5, to: 6, label: '+' },
  ],
  resultClasses: CIFAR_CLASSES,
  input: { kind: 'image', size: 32, channels: 3, classes: CIFAR_CLASSES, generate: generateCifar },

  demo(img, { sample, rnd }) {
    const label = sample?.label ?? 0;
    const probs = demoDistribution(10, label, rnd, { similar: SIMILAR[label] });
    return { vectors: { 7: demoActivations(rnd), 8: [...probs].sort((a, b) => b - a) }, probs };
  },

  intro: S('introHtml'),

  sections: [{ title: S('familyTitle'), open: false, html: S('familyHtml') }],
};
