// AlexNet (2012): сеть, с которой начался бум глубокого обучения.
import { generateCifar, CIFAR_CLASSES } from '../src/engine/models/generators.js';
import { demoDistribution, demoActivations } from '../src/engine/models/libraryHelpers.js';

const SIMILAR = { 0: [2, 8], 1: [9], 2: [0], 3: [5], 4: [7], 5: [3], 6: [2], 7: [4], 8: [0], 9: [1] };

export default {
  meta: {
    id: 'alexnet',
    title: 'AlexNet (2012)',
    category: 'library',
    order: 20,
    level: 2,
    fidelity: 'demo',
    fidelityNote: 'Архитектура и число параметров AlexNet точные; ответ демонстрационный (62 млн весов слишком тяжелы для страницы).',
    summary: 'Пять свёрточных слоёв, три полносвязных и 62 миллиона весов. Победа на ImageNet-2012 с огромным отрывом запустила революцию глубокого обучения.',
    uses: 'Первая «большая» сеть для распознавания фотографий; её идеи (ReLU, dropout, обучение на GPU) используются во всех современных моделях.',
    tags: ['CNN', 'AlexNet', 'ImageNet', 'история', 'GPU'],
    preview: { blocks: [[1, 0.2], [0.72, 0.5], [0.55, 0.5], [0.55, 0.7], [0.4, 0.7], [0.4, 0.8], [0.4, 0.8], [0.4, 0.7], [0.25, 0.7], [0.7, 0.12], [0.7, 0.12], [0.4, 0.12]] },
  },

  type: 'stack',
  layers: [
    { name: 'Вход 227×227', kind: 'input', shape: [227, 227, 3], maps: true, slices: 1 },
    { name: 'Conv1 11×11, шаг 4', kind: 'conv', kernel: 11, shape: [55, 55, 96], params: 34944, note: 'Огромные фильтры 11×11 с шагом 4 — сразу сильно уменьшают картинку.' },
    { name: 'Max-pool', kind: 'pool', shape: [27, 27, 96] },
    { name: 'Conv2 5×5', kind: 'conv', kernel: 5, shape: [27, 27, 256], params: 614656 },
    { name: 'Max-pool', kind: 'pool', shape: [13, 13, 256] },
    { name: 'Conv3 3×3', kind: 'conv', kernel: 3, shape: [13, 13, 384], params: 885120 },
    { name: 'Conv4 3×3', kind: 'conv', kernel: 3, shape: [13, 13, 384], params: 1327488 },
    { name: 'Conv5 3×3', kind: 'conv', kernel: 3, shape: [13, 13, 256], params: 884992 },
    { name: 'Max-pool', kind: 'pool', shape: [6, 6, 256] },
    { name: 'FC6 + dropout', kind: 'dense', shape: [4096], params: 37752832, note: 'Больше половины всех весов сети — в этом слое.' },
    { name: 'FC7 + dropout', kind: 'dense', shape: [4096], params: 16781312 },
    { name: 'FC8 softmax', kind: 'output', shape: [1000], params: 4097000 },
  ],
  totalParams: 62378344,
  resultClasses: CIFAR_CLASSES,
  input: { kind: 'image', size: 32, channels: 3, classes: CIFAR_CLASSES, generate: generateCifar },

  demo(img, { sample, rnd }) {
    const label = sample?.label ?? 0;
    const probs = demoDistribution(10, label, rnd, { similar: SIMILAR[label] });
    return { vectors: { 9: demoActivations(rnd), 10: demoActivations(rnd), 11: [...probs].sort((a, b) => b - a).concat(Array(2).fill(0.001)) }, probs };
  },

  intro: `<p>AlexNet (Крижевский, Суцкевер, Хинтон) выиграла ImageNet-2012 с ошибкой top-5 <b>15,3%</b> — на 11 пунктов лучше второго места.
    Три новшества сделали это возможным: функция активации <b>ReLU</b> (обучение в разы быстрее), <b>dropout</b> против переобучения
    и обучение на двух <b>видеокартах</b>.</p>`,

  sections: [{
    title: 'Где здесь «глубина»',
    open: false,
    html: `<p>Наведите курсор на слои: свёрточные слои содержат лишь ~6% весов, зато делают почти все вычисления.
      Полносвязные FC6–FC8 содержат ~94% весов. Поздние архитектуры (VGG, ResNet, MobileNet) шли к тому, чтобы убрать эти тяжёлые слои.</p>`,
  }],
};
