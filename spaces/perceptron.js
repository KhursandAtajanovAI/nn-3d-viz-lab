// Перцептрон Розенблатта (1958): один нейрон, который умеет «И» и «ИЛИ», но не XOR.
// Тексты — в словарях src/i18n/<язык>/spaces/perceptron.js.
import { MLP } from '../src/engine/models/mlp.js';
import { scope, fmtNum } from '../src/i18n/i18n.js';

const S = scope('sp.perceptron');

export default {
  meta: {
    id: 'perceptron',
    title: S('title'),
    category: 'basics',
    order: 5,
    level: 1,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['MLP', 'history', 'logic', 'pretrained'],
    preview: [2, 1],
  },

  type: 'mlp',
  randomizable: false,
  randomInput: false,
  createModel() {
    const net = new MLP([2, 1], { outputActivation: 'sigmoid' });
    // «И»: сумма 6·A + 6·B − 9 положительна, только когда оба входа равны 1
    net.weights = [[[6, 6]]];
    net.biases = [[-9]];
    return net;
  },
  names: { input: ['A', 'B'], output: [S('outName')] },
  inputs: [
    { name: 'A = 0, B = 0', values: [0, 0] },
    { name: 'A = 0, B = 1', values: [0, 1] },
    { name: 'A = 1, B = 0', values: [1, 0] },
    { name: 'A = 1, B = 1', values: [1, 1] },
  ],

  explainResult(ctx, acts, { outputBarsHtml }) {
    const [a, b] = acts[0];
    const z = ctx.model.lastZ[1][0];
    const y = acts[1][0];
    const and = a && b ? 1 : 0;
    return `${outputBarsHtml(ctx, acts[1])}
      <p>z = 6·${a} + 6·${b} − 9 = <b>${z.toFixed(0)}</b>, σ(z) = <b>${fmtNum(y, 3)}</b> → ${y > 0.5 ? '<b class="pos">1</b>' : '<b class="neg">0</b>'}.
        ${Math.round(y) === and ? S.h('correct', { a, b, y: and }) : ''}</p>
      <p class="small muted">${S.t('orXorHtml')}</p>`;
  },

  intro: S('introHtml'),

  sections: [{ title: S('historyTitle'), open: false, html: S('historyHtml') }],
};
