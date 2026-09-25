// VGG-16 (2014): простота и глубина — только свёртки 3×3 и пулинг.
import { generateCifar, CIFAR_CLASSES } from '../src/engine/models/generators.js';
import { demoDistribution, demoActivations } from '../src/engine/models/libraryHelpers.js';

const SIMILAR = { 0: [2, 8], 1: [9], 2: [0], 3: [5], 4: [7], 5: [3], 6: [2], 7: [4], 8: [0], 9: [1] };

export default {
  meta: {
    id: 'vgg16',
    title: 'VGG-16 (2014)',
    category: 'library',
    order: 30,
    level: 2,
    fidelity: 'demo',
    fidelityNote: 'Архитектура и число параметров VGG-16 точные; ответ демонстрационный.',
    summary: '13 свёрточных слоёв 3×3 в пяти блоках и три полносвязных — 138 миллионов весов. Показала, что глубина важнее размера фильтров.',
    uses: 'Популярная «основа» для переноса обучения, перенос художественного стиля (style transfer), извлечение признаков картинок.',
    tags: ['CNN', 'VGG', 'ImageNet', 'transfer learning'],
    preview: { blocks: [[1, 0.2], [1, 0.35], [0.8, 0.45], [0.6, 0.55], [0.45, 0.7], [0.3, 0.7], [0.6, 0.12], [0.6, 0.12], [0.4, 0.12]] },
  },

  type: 'stack',
  layers: [
    { name: 'Вход 224×224', kind: 'input', shape: [224, 224, 3], maps: true, slices: 1 },
    { name: 'Блок 1: conv 3×3', kind: 'conv', kernel: 3, repeat: 2, shape: [224, 224, 64], params: 38720 },
    { name: 'Блок 2: conv 3×3', kind: 'conv', kernel: 3, repeat: 2, shape: [112, 112, 128], params: 221440, note: 'Перед каждым блоком — max-pooling 2×2: карта уменьшается вдвое, каналов — вдвое больше.' },
    { name: 'Блок 3: conv 3×3', kind: 'conv', kernel: 3, repeat: 3, shape: [56, 56, 256], params: 1475328 },
    { name: 'Блок 4: conv 3×3', kind: 'conv', kernel: 3, repeat: 3, shape: [28, 28, 512], params: 5899776 },
    { name: 'Блок 5: conv 3×3', kind: 'conv', kernel: 3, repeat: 3, shape: [14, 14, 512], params: 7079424 },
    { name: 'Max-pool', kind: 'pool', shape: [7, 7, 512] },
    { name: 'FC 4096', kind: 'dense', shape: [4096], params: 102764544, note: '74% всех весов VGG-16 — в одном этом слое.' },
    { name: 'FC 4096', kind: 'dense', shape: [4096], params: 16781312 },
    { name: 'Softmax 1000', kind: 'output', shape: [1000], params: 4097000 },
  ],
  totalParams: 138357544,
  resultClasses: CIFAR_CLASSES,
  input: { kind: 'image', size: 32, channels: 3, classes: CIFAR_CLASSES, generate: generateCifar },

  demo(img, { sample, rnd }) {
    const label = sample?.label ?? 0;
    const probs = demoDistribution(10, label, rnd, { similar: SIMILAR[label] });
    return { vectors: { 7: demoActivations(rnd), 8: demoActivations(rnd), 9: [...probs].sort((a, b) => b - a) }, probs };
  },

  intro: `<p>Команда Visual Geometry Group из Оксфорда заменила большие фильтры стопками маленьких <b>3×3</b>:
    две свёртки 3×3 «видят» столько же, сколько одна 5×5, но имеют меньше весов и лишнюю нелинейность.
    Архитектура очень регулярная: блоки свёрток, после каждого — пулинг.</p>`,

  sections: [{
    title: 'Почему VGG до сих пор используют',
    open: false,
    html: `<p>VGG медленная и тяжёлая, но её признаки хорошо описывают «стиль» и «содержание» картинки.
      Поэтому её часто берут как готовую основу: отрезают последние слои и дообучают на своих данных (transfer learning),
      а в нейросетевом переносе стиля сравнивают карты признаков VGG.</p>`,
  }],
};
