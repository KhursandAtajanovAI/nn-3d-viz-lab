// XOR: сеть с вручную подобранными весами, которая действительно решает задачу.
// Пример пространства с готовыми весами в конфиге (model.weights / model.biases), готовыми входами и своим объяснением результата.
// Тексты — в словарях src/i18n/<язык>/spaces/xor.js.
import { scope, fmtNum } from '../src/i18n/i18n.js';

const S = scope('sp.xor');

// Скрытый нейрон 1 ≈ ИЛИ, скрытый нейрон 2 ≈ И-НЕ, выход ≈ И от них → вместе это XOR
const WEIGHTS = [
  [[20, 20], [-20, -20]],
  [[20, 20]],
];
const BIASES = [[-10, 30], [-30]];

export default {
  meta: {
    id: 'xor',
    title: S('title'),
    category: 'basics',
    order: 20,
    level: 1,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['MLP', 'logic', 'pretrained'],
    preview: [2, 2, 1],
  },

  type: 'mlp',
  randomizable: false, // веса подобраны вручную — перегенерировать их нельзя
  randomInput: false,
  model: { layers: [2, 2, 1], activation: 'sigmoid', outputActivation: 'sigmoid', weights: WEIGHTS, biases: BIASES },

  names: { input: ['A', 'B'], output: ['A XOR B'] },
  inputs: [
    { name: 'A = 0, B = 0', values: [0, 0] },
    { name: 'A = 0, B = 1', values: [0, 1] },
    { name: 'A = 1, B = 0', values: [1, 0] },
    { name: 'A = 1, B = 1', values: [1, 1] },
  ],

  intro: S('introHtml'),

  sections: [{ title: S('howTitle'), html: S('howHtml') }],

  explainResult(ctx, acts, { outputBarsHtml }) {
    const [a, b] = acts[0];
    const [or, nand] = acts[1];
    const y = acts[2][0];
    const expected = a !== b ? 1 : 0;
    const on = v => (v > 0.5 ? '<b class="pos">≈ 1</b>' : '<b class="neg">≈ 0</b>');
    return `
      ${outputBarsHtml(ctx, acts[2])}
      <p>${S.t('resultHtml', { a, b, or: fmtNum(or, 3), orOn: on(or), nand: fmtNum(nand, 3), nandOn: on(nand), y: fmtNum(y, 3), yOn: on(y) })}</p>
      <p>${Math.round(y) === expected ? S.h('correct', { a, b, y: expected }) : S.h('wrong', { y: expected })}
        ${S.h('bigWeights')}</p>`;
  },
};
