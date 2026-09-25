// Кластеризация самоорганизующейся картой Кохонена (SOM): сетка нейронов «натягивается» на облако данных.
import { seededRandom } from '../src/engine/models/mlp.js';
import { lineChartSvg } from '../src/engine/chart.js';

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
      tooltip: `Нейрон (${Math.floor(k / N) + 1}, ${(k % N) + 1}) · точек: ${counts[k]}`,
      html: `<h3>Нейрон карты (${Math.floor(k / N) + 1}, ${(k % N) + 1})</h3>
        <p>Вес (положение в пространстве данных): <b class="num">(${w.map(v => v.toFixed(2)).join('; ')})</b></p>
        <p>Ближайших точек данных: <b>${counts[k]}</b></p>
        <p class="muted small">Нейрон «отвечает» за точки, к которым он ближе всех. Соседи по сетке тянутся вместе с ним.</p>`,
    },
  }));
  const used = counts.filter(Boolean).length;
  return {
    points, lines, markers,
    html: `<p>Шагов обучения: <b>${state.t}</b> примеров. Задействовано нейронов: ${used} из ${N * N}.</p>
      <p class="list-title">Средняя ошибка квантования (расстояние до ближайшего нейрона)</p>
      ${lineChartSvg([{ values: state.errors, color: '#ff9f1c' }], { xLabel: 'шаг (по 60 примеров)', yLabel: 'ошибка' })}
      <p class="small muted">Цвет точки = цвет ближайшего нейрона. Соседние нейроны сетки окрашены в близкие цвета —
        поэтому видно, что карта сохраняет «топологию»: близкие данные попадают на соседние нейроны.</p>`,
    ...extra,
  };
}

export default {
  meta: {
    id: 'clustering',
    title: 'Кластеризация: карта Кохонена',
    category: 'tasks',
    order: 40,
    level: 2,
    fidelity: 'real',
    summary: 'Самоорганизующаяся карта: сетка из 36 нейронов сама «натягивается» на облако точек и делит его на группы — без учителя и без правильных ответов.',
    uses: 'Сегментация клиентов, группировка документов и новостей, анализ генов, сжатие цветов изображения, поиск похожих товаров.',
    tags: ['кластеризация', 'SOM', 'без учителя', 'нейросеть Кохонена'],
    preview: { scatter: 4 },
  },

  type: 'scatter',
  hideLabels: true,
  resultTitle: 'Обучение карты',

  async setup() {
    const state = { rnd: seededRandom(3) };
    init(state, 'blobs');
    state.groups = { none: { label: 'не распределено', color: '#6b7385' } };
    for (let k = 0; k < N * N; k++) state.groups[`n${k}`] = { label: `нейрон ${k + 1}`, color: neuronColor(Math.floor(k / N), k % N) };
    state.status = 'Нажмите «Обучать» — нейроны начнут двигаться к данным';
    return state;
  },

  initialView: state => view(state),

  controls: [
    { id: 'auto', kind: 'auto', label: '▶ Обучать', stopLabel: '⏸ Пауза', primary: true, interval: 350,
      run(state) {
        trainStep(state);
        return view(state, { done: state.t >= 3000, status: state.t >= 3000 ? 'Обучение завершено: скорость и радиус соседства уменьшились до минимума' : `Обучение: ${state.t} примеров` });
      } },
    { id: 'step', kind: 'button', label: 'Один шаг (60 примеров)', run(state) { trainStep(state); return view(state, { status: `Обучение: ${state.t} примеров` }); } },
    {
      id: 'data', kind: 'select', label: 'Данные',
      options: [{ value: 'blobs', label: '4 облака точек' }, { value: 'spiral', label: 'Спираль (лента)' }],
      run(state, v) {
        init(state, v);
        return { ...view(state), rebuild: true, status: 'Новые данные — карта сброшена' };
      },
    },
  ],

  describe(p) {
    return { tooltip: `Точка (${p.pos.map(v => v.toFixed(1)).join('; ')})`, html: `<h3>Точка данных</h3><p>Координаты: <b class="num">(${p.pos.map(v => v.toFixed(2)).join('; ')})</b></p>` };
  },

  legendHtml: `<ul class="legend">
      <li><span class="dot idle"></span><span><b>Шарики — данные</b> (серые — ещё не распределены).</span></li>
      <li><span class="dot glow-pos"></span><span><b>Ромбы — нейроны карты</b>, линии соединяют соседей по сетке 6×6.</span></li>
    </ul>`,

  intro: `<p>Карта Кохонена — нейросеть <b>без учителя</b>. Каждый нейрон — это точка в пространстве данных.
    На каждом шаге берётся пример, находится ближайший нейрон («победитель»), и он вместе со <b>своими соседями по сетке</b>
    сдвигается к примеру. Постепенно сетка расправляется и покрывает данные, а группы точек достаются разным участкам карты.</p>`,

  sections: [
    {
      title: 'Чем это отличается от k-means',
      open: false,
      html: `<p>В k-means центры кластеров независимы. В карте Кохонена нейроны связаны сеткой: соседи двигаются вместе,
        поэтому похожие данные оказываются на соседних нейронах. Карту можно «развернуть» в плоскую картинку 6×6 и увидеть структуру многомерных данных.</p>`,
    },
  ],
};
