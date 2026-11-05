// Кластеризация самоорганизующейся картой Кохонена (SOM): сетка нейронов «натягивается» на облако данных.
import { seededRandom } from '../src/engine/models/mlp.js';
import { lineChartSvg } from '../src/engine/chart.js';
import { scope, fmtNum } from '../src/i18n/i18n.js';

// Тексты — в словарях src/i18n/<язык>/spaces/clustering.js
const S = scope('sp.clustering');
const vec = (a, d) => a.map(v => fmtNum(v, d)).join('; ');

const N = 6; // сетка нейронов N×N

function makeData(rnd, kind) {
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const pts = [];
  if (kind === 'blobs') {
    const centers = [[-2.5, 1.5, 0], [2.5, 1.8, -1], [0, -2, 1.5], [1.5, -0.5, -2.5]];
    for (let i = 0; i < 160; i++) {
      const c = centers[i % centers.length];
      pts.push(c.map(v => v + gauss() * 0.55));
    }
  } else {
    // «Спираль-лента»: одномерная структура, свёрнутая в 3D
    for (let i = 0; i < 160; i++) {
      const t = (i / 160) * 3 * Math.PI;
      pts.push([Math.cos(t) * (1 + t / 3), t / 2.5 - 2, Math.sin(t) * (1 + t / 3)].map(v => v + gauss() * 0.15));
    }
  }
  return pts;
}

// Цвет нейрона по его месту на сетке: соседние нейроны — похожие цвета (так видна топология карты)
const neuronColor = (r, c) => `hsl(${Math.round((c / (N - 1)) * 300)}, 80%, ${Math.round(45 + (r / (N - 1)) * 25)}%)`;
const dist2 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);

function init(state, kind) {
  const rnd = state.rnd;
  state.kind = kind;
  state.data = makeData(rnd, kind);
  state.W = Array.from({ length: N * N }, () => [(rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6]);
  state.t = 0;
  state.errors = [];
  state.points = state.data.map((pos, i) => ({ id: i, label: '', pos, group: 'none' }));
}

function bmu(state, x) {
  let best = 0, bd = Infinity;
  state.W.forEach((w, k) => { const d = dist2(w, x); if (d < bd) { bd = d; best = k; } });
  return [best, bd];
}

/** Один «шаг» обучения — 60 случайных примеров */
function trainStep(state) {
  const T = 3000;
  for (let s = 0; s < 60; s++) {
    const x = state.data[Math.floor(state.rnd() * state.data.length)];
    const [b] = bmu(state, x);
    const br = Math.floor(b / N), bc = b % N;
    const frac = Math.min(1, state.t / T);
    const lr = 0.5 * (1 - frac) + 0.02;              // скорость обучения уменьшается
    const radius = (N / 2) * (1 - frac) + 0.5;       // и радиус соседства тоже
    state.W.forEach((w, k) => {
      const d = (Math.floor(k / N) - br) ** 2 + ((k % N) - bc) ** 2;
      const h = Math.exp(-d / (2 * radius * radius));
      for (let i = 0; i < 3; i++) w[i] += lr * h * (x[i] - w[i]);
    });
    state.t++;
  }
  const qe = state.data.reduce((s, x) => s + Math.sqrt(bmu(state, x)[1]), 0) / state.data.length;
  state.errors.push(qe);
}

function view(state, extra = {}) {
  const points = {};
  const counts = new Array(N * N).fill(0);
  state.data.forEach((x, i) => {
    const [b] = bmu(state, x);
    counts[b]++;
    points[i] = { group: state.t ? `n${b}` : 'none' };
  });
  const lines = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const k = r * N + c;
    if (c < N - 1) lines.push({ from: state.W[k], to: state.W[k + 1], color: '#8a9ab3', width: 1.5 });
    if (r < N - 1) lines.push({ from: state.W[k], to: state.W[k + N], color: '#8a9ab3', width: 1.5 });
  }
  const markers = state.W.map((w, k) => ({
    id: `n${k}`, pos: w, color: neuronColor(Math.floor(k / N), k % N),
    info: {
      get tooltip() { return S.t('neuronTip', { r: Math.floor(k / N) + 1, c: (k % N) + 1, n: counts[k] }); },
      get html() { return S.h('neuronHtml', { r: Math.floor(k / N) + 1, c: (k % N) + 1, w: vec(w, 2), n: counts[k] }); },
    },
  }));
  const used = counts.filter(Boolean).length;
  return {
    points, lines, markers,
    html: () => `<p>${S.h('trainedHtml', { t: state.t, used, total: N * N })}</p>
      <p class="list-title">${S.h('qeTitle')}</p>
      ${lineChartSvg([{ values: state.errors, color: '#ff9f1c' }], { xLabel: S.t('xAxis'), yLabel: S.t('yAxis') })}
      <p class="small muted">${S.h('colorNote')}</p>`,
    ...extra,
  };
}

export default {
  meta: {
    id: 'clustering',
    title: S('title'),
    category: 'tasks',
    order: 40,
    level: 2,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['clustering', 'SOM', 'unsupervised', 'kohonen'],
    preview: { scatter: 4 },
  },

  type: 'scatter',
  hideLabels: true,
  resultTitle: S('resultTitle'),

  async setup() {
    const state = { rnd: seededRandom(3) };
    init(state, 'blobs');
    state.groups = { none: { label: S('unassigned'), color: '#6b7385' } };
    for (let k = 0; k < N * N; k++) state.groups[`n${k}`] = { label: S('neuron', { n: k + 1 }), color: neuronColor(Math.floor(k / N), k % N) };
    state.status = S('pressTrain');
    return state;
  },

  initialView: state => view(state),

  controls: [
    { id: 'auto', kind: 'auto', label: S('train'), stopLabel: S('pause'), primary: true, interval: 350,
      run(state) {
        trainStep(state);
        return view(state, { done: state.t >= 3000, status: state.t >= 3000 ? S('done') : S('progress', { n: state.t }) });
      } },
    { id: 'step', kind: 'button', label: S('step'), run(state) { trainStep(state); return view(state, { status: S('progress', { n: state.t }) }); } },
    {
      id: 'data', kind: 'select', label: S('data'),
      options: [{ value: 'blobs', label: S('blobs') }, { value: 'spiral', label: S('spiral') }],
      run(state, v) {
        init(state, v);
        return { ...view(state), rebuild: true, status: S('newData') };
      },
    },
  ],

  describe(p) {
    return { tooltip: S.t('pointTip', { pos: vec(p.pos, 1) }), html: S.h('pointHtml', { pos: vec(p.pos, 2) }) };
  },

  legendHtml: S('legendHtml'),

  intro: S('introHtml'),

  sections: [{ title: S('kmeansTitle'), open: false, html: S('kmeansHtml') }],
};
