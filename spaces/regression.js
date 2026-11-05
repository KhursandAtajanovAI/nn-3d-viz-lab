// Регрессия: сеть предсказывает цену квартиры по четырём признакам. Обучается прямо в браузере.
import { MLP, seededRandom } from '../src/engine/models/mlp.js';
import { lineChartSvg } from '../src/engine/chart.js';
import { scope, fmtNum, str } from '../src/i18n/i18n.js';

// Тексты — в словарях src/i18n/<язык>/spaces/regression.js
const S = scope('sp.regression');

const FEATURES = [
  { name: S('f.area'), unit: S('u.area'), min: 25, max: 150 },
  { name: S('f.rooms'), unit: '', min: 1, max: 5, int: true },
  { name: S('f.dist'), unit: S('u.dist'), min: 1, max: 25 },
  { name: S('f.age'), unit: S('u.age'), min: 0, max: 60, int: true },
];

/**
 * «Истинная» закономерность, по которой сгенерированы данные (млн ₸) — сеть её не знает.
 * Порядок цен — как в Астане и Алматы: типичная квартира 25–90 млн ₸, премиум в центре — дороже 100 млн ₸.
 */
const truePrice = ([area, rooms, dist, age]) => 4.5 * ((0.11 * area + 0.6 * rooms) * (1.45 - 0.022 * dist) - 0.025 * age + 1.5);

// Синтетический набор данных: 400 квартир с шумом ±5%
const rnd = seededRandom(2024);
const DATA = Array.from({ length: 400 }, () => {
  const x = FEATURES.map(f => {
    const v = f.min + rnd() * (f.max - f.min);
    return f.int ? Math.round(v) : v;
  });
  x[1] = Math.max(1, Math.min(5, Math.round(x[0] / 30 + (rnd() - 0.5) * 1.5))); // комнат обычно больше в больших квартирах
  return { x, y: truePrice(x) * (1 + (rnd() - 0.5) * 0.1) };
});

// Нормирование: сеть работает с числами порядка ±1, а не с «150 м²» и «50 млн ₸»
const mean = FEATURES.map((_, k) => DATA.reduce((s, d) => s + d.x[k], 0) / DATA.length);
const std = FEATURES.map((_, k) => Math.sqrt(DATA.reduce((s, d) => s + (d.x[k] - mean[k]) ** 2, 0) / DATA.length));
const yMean = DATA.reduce((s, d) => s + d.y, 0) / DATA.length;
const yStd = Math.sqrt(DATA.reduce((s, d) => s + (d.y - yMean) ** 2, 0) / DATA.length);
const norm = x => x.map((v, k) => (v - mean[k]) / std[k]);
const denorm = z => z.map((v, k) => v * std[k] + mean[k]);

const APARTMENTS = [
  { name: S('apt.0'), x: [28, 1, 18, 5] },
  { name: S('apt.1'), x: [54, 2, 9, 30] },
  { name: S('apt.2'), x: [78, 3, 4, 50] },
  { name: S('apt.3'), x: [140, 5, 2, 3] },
  { name: S('apt.4'), x: [44, 2, 22, 60] },
];

let history = [];
const fmtFeature = (f, v) => `${f.int ? Math.round(v) : v.toFixed(0)}${f.unit ? ` ${str(f.unit)}` : ''}`;
const money = v => S.t('money', { v: fmtNum(v, 1) });

export default {
  meta: {
    id: 'regression',
    title: S('title'),
    category: 'tasks',
    order: 10,
    level: 1,
    fidelity: 'trained',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['MLP', 'regression', 'tabular', 'normalization'],
    preview: [4, 8, 1],
  },

  type: 'mlp',
  randomizable: false,
  createModel() {
    const net = new MLP([4, 8, 1], { activation: 'tanh', outputActivation: 'linear', seed: 5 });
    const X = DATA.map(d => norm(d.x)), Y = DATA.map(d => [(d.y - yMean) / yStd]);
    history = net.fit(X, Y, { epochs: 120, lr: 0.02 });
    return net;
  },
  names: { input: FEATURES.map(f => f.name), output: [S('outName')] },
  randomInputNote: S('randomNote'),
  // Подсказка при наведении: перевод нормированных значений в исходные единицы
  valueText(l, i, a) {
    if (l === 0) return S.t('rawUnitsHtml', { v: fmtFeature(FEATURES[i], a * std[i] + mean[i]) });
    if (l === 2) return S.t('inTengeHtml', { v: money(a * yStd + yMean) });
    return null;
  },
  inputs: APARTMENTS.map(a => ({ name: a.name, values: norm(a.x) })),

  explainResult(ctx, acts) {
    const raw = denorm(acts[0]).map((v, k) => Math.min(FEATURES[k].max, Math.max(FEATURES[k].min, v)));
    const pred = acts.at(-1)[0] * yStd + yMean;
    const truth = truePrice(raw);
    const err = Math.abs(pred - truth) / truth;
    return `
      <p class="big-number">≈ ${money(pred)}</p>
      <table class="arch-table"><tbody>
        ${FEATURES.map((f, k) => `<tr><td>${str(f.name)}</td><td class="num">${fmtFeature(f, raw[k])}</td><td class="num muted">→ ${acts[0][k] >= 0 ? '+' : '−'}${fmtNum(Math.abs(acts[0][k]), 2)}</td></tr>`).join('')}
      </tbody></table>
      <p>${S.t('truthHtml', { v: money(truth), err: (err * 100).toFixed(0) })}</p>
      <p class="small muted">${S.h('normNote')}</p>
      <p class="list-title">${S.h('lossTitle')}</p>
      ${lineChartSvg([{ values: history, color: '#ff9f1c' }], { xLabel: S.t('epoch'), yLabel: S.t('mseNorm'), logY: true })}
      <p class="small muted">${S.h('finalLoss', { loss: fmtNum(history.at(-1), 4), v: money(Math.sqrt(history.at(-1)) * yStd) })}</p>`;
  },

  intro: S('introHtml'),

  sections: [{ title: S('tryTitle'), open: false, html: S('tryHtml') }],
};
