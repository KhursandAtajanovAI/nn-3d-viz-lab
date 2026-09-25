// LeNet-5 (1998): первая успешная свёрточная сеть — читала цифры на банковских чеках.
import { generateDigit, DIGIT_CLASSES } from '../src/engine/models/generators.js';
import { padImage, firstLayerMaps, demoDistribution, demoActivations } from '../src/engine/models/libraryHelpers.js';
import { CONV1_FILTERS } from '../src/engine/models/cnn.js';

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
    fidelityNote: 'Архитектура LeNet-5 точная. Карты первых двух слоёв реально вычислены на вашей картинке (фильтры-детекторы краёв), дальнейшие слои и ответ — демонстрационные.',
    summary: 'Сеть Яна Лекуна: две свёртки с пулингом и три полносвязных слоя — всего 61 тысяча весов. Прародитель всех современных CNN.',
    uses: 'В 1990-х читала рукописные суммы на миллионах банковских чеков в США; сегодня — учебный эталон свёрточной сети.',
    tags: ['CNN', 'LeNet', 'история', 'свёртки', 'MNIST'],
    preview: { blocks: [[1, 0.1], [0.85, 0.35], [0.45, 0.35], [0.32, 0.55], [0.16, 0.55], [0.5, 0.12], [0.4, 0.12], [0.25, 0.12]] },
  },

  type: 'stack',
  layers: [
    { name: 'Вход 32×32', kind: 'input', shape: [32, 32, 1], maps: true, slices: 1, note: 'Цифра 28×28, дополненная нулями до 32×32 — так делали в оригинале.' },
    { name: 'C1: свёртка 5×5', kind: 'conv', kernel: 5, shape: [28, 28, 6], maps: true, filters: CONV1_FILTERS, note: '6 фильтров. Здесь показаны карты от фильтров-детекторов краёв; в LeNet фильтры выучивались.' },
    { name: 'S2: пулинг', kind: 'pool', shape: [14, 14, 6], maps: true, note: 'В оригинале — усредняющий пулинг с обучаемым множителем.' },
    { name: 'C3: свёртка 5×5', kind: 'conv', kernel: 5, shape: [10, 10, 16], params: 1516, note: '16 фильтров; каждый смотрит только на часть карт S2 — хитрость для экономии вычислений 1990-х.' },
    { name: 'S4: пулинг', kind: 'pool', shape: [5, 5, 16] },
    { name: 'C5: 120 нейронов', kind: 'dense', shape: [120], params: 48120 },
    { name: 'F6: 84 нейрона', kind: 'dense', shape: [84], params: 10164 },
    { name: 'Выход: 10 цифр', kind: 'output', shape: [10], params: 850 },
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

  intro: `<p>LeNet-5 — сеть, с которой началась эпоха свёрточных сетей. Идея, сохранившаяся до сих пор:
    <b>свёртка → пулинг → свёртка → пулинг → полносвязные слои</b>. Сравните с пространством
    <a href="space.html?id=mnist">MNIST</a> — там сеть почти такой же формы обучается прямо в браузере.</p>`,

  sections: [{
    title: 'Историческая справка',
    open: false,
    html: `<p>Ян Лекун с коллегами из AT&T Bell Labs опубликовали LeNet-5 в 1998 году. Сеть обучали на базе рукописных цифр,
      из которой позже сделали MNIST. Тогда обучение занимало дни на лучших компьютерах, а сейчас — секунды на телефоне.</p>`,
  }],
};
