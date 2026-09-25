// ResNet-18 (2015): остаточные связи, благодаря которым обучаются сети в сотни слоёв.
import { generateCifar, CIFAR_CLASSES } from '../src/engine/models/generators.js';
import { demoDistribution, demoActivations } from '../src/engine/models/libraryHelpers.js';

const SIMILAR = { 0: [2, 8], 1: [9], 2: [0], 3: [5], 4: [7], 5: [3], 6: [2], 7: [4], 8: [0], 9: [1] };

export default {
  meta: {
    id: 'resnet',
    title: 'ResNet: остаточные связи (2015)',
    category: 'library',
    order: 40,
    level: 2,
    fidelity: 'demo',
    fidelityNote: 'Архитектура ResNet-18 и число параметров точные; ответ демонстрационный.',
    summary: 'Синие дуги — «короткие пути»: вход блока прибавляется к его выходу. Так сигнал и градиент проходят через десятки слоёв без затухания.',
    uses: 'Основа большинства систем компьютерного зрения: медицинские снимки, беспилотники, распознавание лиц; идея skip-связей есть и в трансформерах.',
    tags: ['CNN', 'ResNet', 'skip connections', 'ImageNet'],
    preview: { blocks: [[1, 0.2], [0.7, 0.4], [0.55, 0.4], [0.55, 0.4], [0.4, 0.55], [0.3, 0.7], [0.2, 0.85], [0.35, 0.12]], skips: [[2, 3], [3, 4], [4, 5], [5, 6]] },
  },

  type: 'stack',
  layers: [
    { name: 'Вход 224×224', kind: 'input', shape: [224, 224, 3], maps: true, slices: 1 },
    { name: 'Conv 7×7, шаг 2', kind: 'conv', kernel: 7, shape: [112, 112, 64], params: 9472 },
    { name: 'Max-pool', kind: 'pool', shape: [56, 56, 64] },
    { name: 'Стадия 1', kind: 'conv', repeat: 2, shape: [56, 56, 64], params: 147968, note: '2 остаточных блока: conv 3×3 → conv 3×3, и вход блока прибавляется к выходу.' },
    { name: 'Стадия 2', kind: 'conv', repeat: 2, shape: [28, 28, 128], params: 525568 },
    { name: 'Стадия 3', kind: 'conv', repeat: 2, shape: [14, 14, 256], params: 2099712 },
    { name: 'Стадия 4', kind: 'conv', repeat: 2, shape: [7, 7, 512], params: 8393728 },
    { name: 'Global avg pool', kind: 'pool', shape: [512] },
    { name: 'Softmax 1000', kind: 'output', shape: [1000], params: 513000 },
  ],
  totalParams: 11689512,
  skips: [
    { from: 2, to: 3, label: '+ вход блока' },
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

  intro: `<p>До ResNet сети глубже ~20 слоёв обучались хуже неглубоких: сигнал и градиент «затухали».
    Решение Кайминга Хэ и коллег: каждый блок учит не весь результат, а только <b>поправку</b> к своему входу —
    выход = вход + F(вход). Синие дуги в сцене — эти остаточные связи.</p>`,

  sections: [{
    title: 'Семейство ResNet',
    open: false,
    html: `<p>ResNet-18 и -34 используют простые блоки из двух свёрток 3×3. ResNet-50/101/152 — «бутылочные» блоки 1×1 → 3×3 → 1×1
      (схема ResNet-50 — в пространстве <a href="space.html?id=imagenet">ImageNet</a>). В 2015 году ResNet-152 выиграла ImageNet с ошибкой top-5 3,57% —
      лучше среднего человека.</p>`,
  }],
};
