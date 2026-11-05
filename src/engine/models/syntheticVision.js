// Общая «заготовка» для пространств-классификаторов картинок (MNIST, Fashion-MNIST, CIFAR-10):
// архитектура сети + обучение в браузере на синтетических картинках из генератора.
// Пространство подключает её так: export default { meta, ...syntheticVision({...}), intro, sections }.
import { CONV1_FILTERS, CONV2_FILTERS, featureShapes, trainSyntheticClassifier } from './cnn.js';
import { normalizeGlyph } from './generators.js';
import { L, t, H, str } from '../../i18n/i18n.js';

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
  const colorNote = channels === 3 ? L('sv.colorNote') : '';
  const layers = [
    { name: L('sv.input'), kind: 'input', shape: [size, size, channels], maps: true, slices: 1, note: L(channels === 3 ? 'sv.inputColor' : 'sv.inputGray') },
    { name: L('sv.conv1'), kind: 'conv', kernel: 5, shape: [sh.c1, sh.c1, 6], maps: true, filters: CONV1_FILTERS, params: 150, fixed: true, note: L('sv.conv1Note') },
    { name: L('sv.pool1'), kind: 'pool', shape: [sh.p1, sh.p1, 6], maps: true, note: L('sv.pool1Note') },
    { name: L('sv.conv2'), kind: 'conv', kernel: 3, shape: [sh.c2, sh.c2, 8], maps: true, slices: 8, filters: CONV2_FILTERS.map(f => ({ ...f, description: L('sv.conv2Desc') })), params: 144, fixed: true, note: L('sv.conv2Note') },
    { name: L('sv.pool2'), kind: 'pool', shape: [sh.p2, sh.p2, 8], maps: true, slices: 8 },
    { name: L('sv.flat'), kind: 'flatten', shape: [sh.flat], note: L('sv.flatNote', { n: sh.flat, color: colorNote }) },
    { name: L('sv.hidden'), kind: 'dense', shape: [hidden], note: L('sv.hiddenNote') },
    { name: L('sv.out'), kind: 'output', shape: [classes.length], note: L('sv.outNote') },
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

/** Общий текст «Как это работает» для синтетических классификаторов (sv.howHtml) */
export const HOW_SYNTHETIC_WORKS = L('sv.howHtml');

/** Пояснение к результату синтетического классификатора */
export function explainTop2(result, { classes }) {
  const p = result.probs;
  const order = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const [[p1, c1], [p2, c2]] = order;
  const sure = t(p1 > 0.8 ? 'sv.sureHigh' : p1 > 0.5 ? 'sv.sureMid' : 'sv.sureLow');
  return H('sv.explainHtml', { sure, c1: str(classes[c1]), p1: Math.round(p1 * 100), c2: str(classes[c2]), p2: Math.round(p2 * 100) });
}
