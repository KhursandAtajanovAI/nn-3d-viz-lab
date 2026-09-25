// MobileNet (2017): лёгкая сеть для телефонов на depthwise-separable свёртках.
import { generateCifar, CIFAR_CLASSES } from '../src/engine/models/generators.js';
import { demoDistribution, demoActivations } from '../src/engine/models/libraryHelpers.js';

const SIMILAR = { 0: [2, 8], 1: [9], 2: [0], 3: [5], 4: [7], 5: [3], 6: [2], 7: [4], 8: [0], 9: [1] };

export default {
  meta: {
    id: 'mobilenet',
    title: 'MobileNet: сеть для телефона (2017)',
    category: 'library',
    order: 50,
    level: 2,
    fidelity: 'demo',
    fidelityNote: 'Архитектура MobileNet v1 точная; ответ демонстрационный.',
    summary: 'Почти как VGG по качеству, но в 30 раз меньше весов (4,2 млн) и в десятки раз меньше вычислений — благодаря depthwise-separable свёрткам.',
    uses: 'Распознавание на смартфонах и камерах: портретный режим, распознавание растений и товаров, AR-фильтры, умные дверные звонки.',
    tags: ['CNN', 'MobileNet', 'мобильные устройства', 'depthwise'],
    preview: { blocks: [[1, 0.2], [0.8, 0.3], [0.8, 0.4], [0.6, 0.5], [0.45, 0.6], [0.3, 0.75], [0.2, 0.9], [0.4, 0.12], [0.3, 0.12]] },
  },

  type: 'stack',
  layers: [
    { name: 'Вход 224×224', kind: 'input', shape: [224, 224, 3], maps: true, slices: 1 },
    { name: 'Conv 3×3, шаг 2', kind: 'conv', kernel: 3, shape: [112, 112, 32], params: 864 },
    { name: 'DW-блок', kind: 'dwconv', kernel: 3, shape: [112, 112, 64], params: 2336, note: 'Depthwise 3×3 (каждый канал отдельно) + pointwise 1×1 (смешивание каналов).' },
    { name: 'DW-блоки', kind: 'dwconv', kernel: 3, repeat: 2, shape: [56, 56, 128], params: 26432 },
    { name: 'DW-блоки', kind: 'dwconv', kernel: 3, repeat: 2, shape: [28, 28, 256], params: 102016 },
    { name: 'DW-блоки', kind: 'dwconv', kernel: 3, repeat: 6, shape: [14, 14, 512], params: 1454336 },
    { name: 'DW-блоки', kind: 'dwconv', kernel: 3, repeat: 2, shape: [7, 7, 1024], params: 1603072 },
    { name: 'Global avg pool', kind: 'pool', shape: [1024] },
    { name: 'Softmax 1000', kind: 'output', shape: [1000], params: 1025000 },
  ],
  totalParams: 4231976,
  resultClasses: CIFAR_CLASSES,
  input: { kind: 'image', size: 32, channels: 3, classes: CIFAR_CLASSES, generate: generateCifar },

  demo(img, { sample, rnd }) {
    const label = sample?.label ?? 0;
    const probs = demoDistribution(10, label, rnd, { similar: SIMILAR[label], confidence: [0.45, 0.8] });
    return { vectors: { 7: demoActivations(rnd), 8: [...probs].sort((a, b) => b - a) }, probs };
  },

  intro: `<p>Обычная свёртка 3×3 из 256 каналов в 256 каналов — это 590 тысяч весов. MobileNet делит её на две части:
    <b>depthwise</b> (фильтр 3×3 для каждого канала отдельно, 2,3 тыс. весов) и <b>pointwise</b> 1×1 (смешивание каналов, 66 тыс.).
    В сумме — в 8–9 раз меньше весов и вычислений почти без потери качества.</p>`,

  sections: [{
    title: 'Компромисс «точность — скорость»',
    open: false,
    html: `<p>MobileNet имеет «ручки» — множитель ширины (сколько каналов) и разрешение входа. Уменьшая их, получают сеть под любой телефон.
      Эта идея развилась в MobileNet v2/v3 и EfficientNet, которые работают прямо в камерах и браузерах.</p>`,
  }],
};
