// Автоэнкодер: сеть сжимает картинку 3×3 до трёх чисел и восстанавливает обратно.
import { MLP, seededRandom } from '../src/engine/models/mlp.js';
import { scope, fmtNum, str } from '../src/i18n/i18n.js';

// Тексты — в словарях src/i18n/<язык>/spaces/autoencoder.js; ключи узоров — идентификаторы (p.<id>)
const S = scope('sp.autoencoder');

const PATTERNS = {
  horizontal: [0, 0, 0, 1, 1, 1, 0, 0, 0],
  vertical: [0, 1, 0, 0, 1, 0, 0, 1, 0],
  diagDown: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  diagUp: [0, 0, 1, 0, 1, 0, 1, 0, 0],
  cross: [0, 1, 0, 1, 1, 1, 0, 1, 0],
  frame: [1, 1, 1, 1, 0, 1, 1, 1, 1],
  corner: [1, 1, 1, 1, 0, 0, 1, 0, 0],
  dot: [0, 0, 0, 0, 1, 0, 0, 0, 0],
};
const NAMES = Object.keys(PATTERNS);
const PIX = ['↖', '↑', '↗', '←', '•', '→', '↙', '↓', '↘'];

let codes = {};
let finalLoss = 0;

const grid = v => `<div class="pix-grid">${v.map(x => `<span style="--v:${Math.min(1, Math.max(0, x)).toFixed(2)}"></span>`).join('')}</div>`;

export default {
  meta: {
    id: 'autoencoder',
    title: S('title'),
    category: 'tasks',
    order: 20,
    level: 2,
    fidelity: 'trained',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['MLP', 'autoencoder', 'compression', 'unsupervised', 'latent-space'],
    preview: [9, 6, 3, 6, 9],
  },

  type: 'mlp',
  randomizable: false,
  createModel() {
    // 160 зашумлённых копий восьми узоров; ответ при обучении — сам вход
    const rnd = seededRandom(9);
    const X = [];
    for (let k = 0; k < 20; k++) {
      for (const p of Object.values(PATTERNS)) X.push(p.map(v => Math.min(1, Math.max(0, v + (rnd() - 0.5) * 0.2))));
    }
    const net = new MLP([9, 6, 3, 6, 9], { activation: 'tanh', outputActivation: 'sigmoid', seed: 7 });
    const hist = net.fit(X, X, { epochs: 1500, lr: 0.05 });
    finalLoss = hist.at(-1);
    codes = Object.fromEntries(NAMES.map(n => [n, net.forward(PATTERNS[n])[2]]));
    return net;
  },
  names: { input: PIX, output: PIX },
  randomInputNote: S('randomNote'),
  inputs: NAMES.map(n => ({ name: S(`p.${n}`), values: PATTERNS[n] })),

  explainResult(ctx, acts) {
    const input = acts[0], out = acts.at(-1), code = acts[2];
    const mse = input.reduce((s, v, i) => s + (v - out[i]) ** 2, 0) / input.length;
    // Карта кодов всех узоров: проекция на первые два числа кода
    const all = Object.entries(codes);
    const xs = all.map(([, c]) => c[0]).concat(code[0]), ys = all.map(([, c]) => c[1]).concat(code[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const X = v => 20 + ((v - x0) / (x1 - x0 || 1)) * 230, Y = v => 150 - ((v - y0) / (y1 - y0 || 1)) * 130;
    const map = `<svg class="chart" viewBox="0 0 320 170">
      ${all.map(([n, c]) => `<circle cx="${X(c[0])}" cy="${Y(c[1])}" r="4" style="fill:var(--neg)" /><text x="${X(c[0]) + 6}" y="${Y(c[1]) + 4}" class="tick">${S.h(`p.${n}`)}</text>`).join('')}
      <circle cx="${X(code[0])}" cy="${Y(code[1])}" r="7" fill="none" style="stroke:var(--pos)" stroke-width="2.5" />
    </svg>`;
    return `
      <div class="ae-compare">
        <div><p class="list-title">${S.h('input')}</p>${grid(input)}</div>
        <div class="arrow">→ <b class="num">(${code.map(v => fmtNum(v, 2)).join('; ')})</b> →</div>
        <div><p class="list-title">${S.h('restored')}</p>${grid(out)}</div>
      </div>
      <p>${S.t('mseHtml', { mse: fmtNum(mse, 3), verdict: S.t(mse < 0.02 ? 'v.great' : mse < 0.06 ? 'v.good' : 'v.bad') })}</p>
      <p class="list-title">${S.h('latentTitle')}</p>
      ${map}
      <p class="small muted">${S.h('latentNote', { loss: fmtNum(finalLoss, 3) })}</p>`;
  },

  intro: S('introHtml'),

  sections: [{ title: S('whyTitle'), open: false, html: S('whyHtml') }],
};
