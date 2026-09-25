// Общая «заготовка» для пространств-классификаторов картинок (MNIST, Fashion-MNIST, CIFAR-10):
// архитектура сети + обучение в браузере на синтетических картинках из генератора.
// Пространство подключает её так: export default { meta, ...syntheticVision({...}), intro, sections }.
import { CONV1_FILTERS, CONV2_FILTERS, featureShapes, trainSyntheticClassifier } from './cnn.js';
import { normalizeGlyph } from './generators.js';

/**
 * @param {object} o
 * @param {number} o.size — сторона картинки (28 или 32)
 * @param {number} o.channels — 1 (ч/б) или 3 (цвет)
 * @param {string[]} o.classes — названия классов
 * @param {(cls: number, rnd: () => number) => object} o.generate — генератор картинок
 * @param {boolean} [o.draw] — можно ли рисовать вход мышью (для цифр)
 */
export function syntheticVision({ size, channels, classes, generate, draw = false, perClass = 90, epochs = 14, hidden = 32 }) {
  const sh = featureShapes(size, channels);
  const colorNote = channels === 3
    ? ' К вектору также добавлены средние цвета картинки по участкам 4×4 (48 чисел): свёртки здесь смотрят на яркость, а цвет помогает отличить, например, лягушку от корабля.'
    : '';
  const layers = [
    { name: 'Вход', kind: 'input', shape: [size, size, channels], maps: true, slices: 1, note: channels === 3 ? 'Цветная картинка 32×32: три канала — красный, зелёный, синий.' : 'Картинка 28×28 в оттенках серого: 784 числа от 0 (чёрный) до 1 (белый).' },
    { name: 'Свёртка 1 + ReLU', kind: 'conv', kernel: 5, shape: [sh.c1, sh.c1, 6], maps: true, filters: CONV1_FILTERS, params: 150, fixed: true, note: '6 фильтров 5×5 заданы вручную — классические детекторы краёв. В настоящих сетях такие фильтры получаются сами при обучении (см. карточку «Как это работает»).' },
    { name: 'Пулинг 1', kind: 'pool', shape: [sh.p1, sh.p1, 6], maps: true, note: 'Max-pooling 2×2: карта уменьшается вдвое по каждой стороне.' },
    { name: 'Свёртка 2 + ReLU', kind: 'conv', kernel: 3, shape: [sh.c2, sh.c2, 8], maps: true, slices: 8, filters: CONV2_FILTERS.map(f => ({ ...f, description: 'складывает два канала первого слоя с фиксированными случайными весами — получаются более сложные сочетания признаков' })), params: 144, fixed: true, note: '8 фильтров 3×3, каждый смотрит на пару каналов первого слоя. Веса фиксированные (случайные) — это тоже рабочий приём: «случайные признаки».' },
    { name: 'Пулинг 2', kind: 'pool', shape: [sh.p2, sh.p2, 8], maps: true, slices: 8 },
    { name: 'Вектор признаков', kind: 'flatten', shape: [sh.flat], note: `Все карты вытягиваются в один вектор из ${sh.flat} чисел.${colorNote}` },
    { name: 'Скрытый слой (ReLU)', kind: 'dense', shape: [hidden], note: 'Обучается в браузере: комбинирует признаки в «понятия» вроде «замкнутый контур сверху».' },
    { name: 'Вероятности (softmax)', kind: 'output', shape: [classes.length], note: 'Softmax превращает выходы в вероятности, которые в сумме дают 100%. Обучается в браузере.' },
  ];

  return {
    type: 'stack',
    layers,
    outputNames: classes,
    input: { kind: 'image', size, channels, classes, draw, generate },
    async setup({ onProgress }) {
      const clf = await trainSyntheticClassifier({ generate, classes: classes.length, perClass, epochs, hidden, onProgress });
      return {
        accuracy: clf.accuracy,
        history: clf.history,
        generate,
        fromDrawing: canvas => normalizeGlyph(canvas),
        run(img) {
          const r = clf.classify(img);
          return {
            maps: { 0: img, 1: r.conv1, 2: r.pool1, 3: r.conv2, 4: r.pool2 },
            vectors: { 5: Array.from(r.features.slice(0, 12)), 6: r.hidden, 7: r.probs },
            probs: r.probs,
            raw: r,
          };
        },
      };
    },
  };
}

/** Общий текст «Как это работает» для синтетических классификаторов */
export const HOW_SYNTHETIC_WORKS = `
  <ol class="steps">
    <li><b>Свёртки</b> проходят по картинке маленькими фильтрами и строят <b>карты признаков</b>: где есть вертикальные края, где горизонтальные, где пятна.</li>
    <li><b>Пулинг</b> уменьшает карты, оставляя самые сильные отклики, — сеть становится устойчивой к небольшим сдвигам.</li>
    <li>Второй слой свёрток комбинирует простые признаки в более сложные.</li>
    <li>Карты <b>выпрямляются</b> в вектор, а <b>полносвязные слои</b> превращают его в вероятности классов.</li>
  </ol>
  <p class="muted small">Что здесь настоящее: все свёртки, пулинги и вероятности реально вычисляются для вашей картинки.
    Что упрощено: фильтры свёрток заданы вручную, а полносвязные слои обучаются прямо при открытии страницы
    на <b>синтетических</b> картинках (нарисованных программой), а не на настоящем наборе данных — он весит десятки мегабайт.
    Точность на новых синтетических картинках показана в строке статуса.</p>`;
