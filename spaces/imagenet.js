// ImageNet: идея классификации на 1000 классов на примере ResNet-50 (упрощённая иллюстрация).
// Тексты — в словарях src/i18n/<язык>/spaces/imagenet.js.
import { generateCifar, CIFAR_CLASSES } from '../src/engine/models/generators.js';
import { scope, str } from '../src/i18n/i18n.js';

const S = scope('sp.imagenet');

// По три «узких» класса ImageNet на каждую крупную категорию картинок-примеров (названия — fine.<категория>.<k>)
const FINE = Array.from({ length: 10 }, (_, g) => [0, 1, 2].map(k => S(`fine.${g}.${k}`)));
// Похожие категории — с ними демо-«сеть» чаще всего путает
const CONFUSED = { 0: [2, 8], 1: [9, 8], 2: [0, 6], 3: [5, 4], 4: [7, 5], 5: [3, 7], 6: [2, 3], 7: [4, 5], 8: [0, 1], 9: [1, 8] };
const RESULT_CLASSES = FINE.flat();

export default {
  meta: {
    id: 'imagenet',
    title: S('title'),
    category: 'vision',
    order: 40,
    level: 2,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['CNN', 'ResNet', 'ImageNet', 'classification', 'transfer learning'],
    preview: { blocks: [[1, 0.2], [0.75, 0.45], [0.6, 0.45], [0.6, 0.65], [0.42, 0.75], [0.3, 0.85], [0.18, 0.95], [0.45, 0.12], [0.35, 0.12]], skips: [[3, 4], [4, 5], [5, 6]] },
  },

  type: 'stack',
  layers: [
    { name: S('l.input'), kind: 'input', shape: [224, 224, 3], maps: true, slices: 1, note: S('n.input') },
    { name: S('l.conv'), kind: 'conv', kernel: 7, shape: [112, 112, 64], params: 9472 },
    { name: 'Max-pooling', kind: 'pool', shape: [56, 56, 64] },
    { name: S('l.stage', { n: 1 }), kind: 'conv', repeat: 3, shape: [56, 56, 256], params: 215808, note: S('n.stage1') },
    { name: S('l.stage', { n: 2 }), kind: 'conv', repeat: 4, shape: [28, 28, 512], params: 1219584, note: S('n.stage2') },
    { name: S('l.stage', { n: 3 }), kind: 'conv', repeat: 6, shape: [14, 14, 1024], params: 7098368, note: S('n.stage3') },
    { name: S('l.stage', { n: 4 }), kind: 'conv', repeat: 3, shape: [7, 7, 2048], params: 14964736 },
    { name: 'Global average pooling', kind: 'pool', shape: [2048], note: S('n.gap') },
    { name: S('l.out'), kind: 'output', shape: [1000], params: 2049000 },
  ],
  totalParams: 25557032,
  skips: [
    { from: 2, to: 3, label: '+ skip' },
    { from: 3, to: 4, label: '+ skip' },
    { from: 4, to: 5, label: '+ skip' },
    { from: 5, to: 6, label: '+ skip' },
  ],
  resultClasses: RESULT_CLASSES,
  input: { kind: 'image', size: 32, channels: 3, classes: CIFAR_CLASSES, generate: generateCifar },

  /** Демонстрационный ответ: правдоподобное распределение, согласованное с категорией картинки */
  demo(img, { sample, rnd }) {
    const g = sample?.label ?? 0;
    const probs = new Array(RESULT_CLASSES.length).fill(0).map(() => rnd() * 0.004);
    const top = Math.floor(rnd() * 3);
    let left = 1 - probs.reduce((a, b) => a + b, 0);
    const give = (i, share) => { const v = left * share; probs[i] += v; left -= v; };
    give(g * 3 + top, 0.45 + rnd() * 0.35);
    for (let k = 0; k < 3; k++) if (k !== top) give(g * 3 + k, 0.35 + rnd() * 0.3);
    for (const c of CONFUSED[g]) give(c * 3 + Math.floor(rnd() * 3), 0.3 + rnd() * 0.3);
    probs[g * 3 + top] += left;
    const sorted = [...probs].sort((a, b) => b - a);
    return {
      probs,
      vectors: {
        7: Array.from({ length: 12 }, () => Math.max(0, rnd() * 1.6 - 0.4)),
        8: sorted.slice(0, 12),
      },
    };
  },

  intro: S('introHtml'),

  sections: [
    { title: S('realTitle'), html: S('realHtml') },
    { title: S('topTitle'), open: false, html: S('topHtml') },
  ],

  explainResult(result, { classes }) {
    const order = result.probs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 5);
    const list = order.map(([p, i]) => S.t('item', { name: str(classes[i]), p: Math.round(p * 100) })).join(', ');
    return S.h('explainHtml', { list });
  },
};
