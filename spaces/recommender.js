// Рекомендательная система: матричная факторизация. Зрители и фильмы — точки в общем «пространстве вкусов».
import { escapeHtml } from '../src/engine/format.js';

const MOVIES = [
  ['Форсаж', 'боевики'], ['Джон Уик', 'боевики'], ['Миссия невыполнима', 'боевики'],
  ['Один дома', 'комедии'], ['Маска', 'комедии'], ['Мальчишник в Вегасе', 'комедии'],
  ['Зелёная миля', 'драмы'], ['Форрест Гамп', 'драмы'], ['Побег из Шоушенка', 'драмы'],
  ['Король Лев', 'мультфильмы'], ['Шрек', 'мультфильмы'], ['Холодное сердце', 'мультфильмы'],
];
// Оценки 1–5, 0 — не смотрел. Вкусы: Аня — драмы и мультфильмы, Борис — боевики, Вика — комедии и мультфильмы…
const USERS = ['Аня', 'Борис', 'Вика', 'Гриша', 'Даша', 'Егор', 'Жанна', 'Зоя'];
const R = [
  [0, 1, 0, 3, 0, 2, 5, 5, 0, 5, 4, 0],
  [5, 5, 4, 0, 2, 3, 0, 2, 3, 1, 0, 1],
  [1, 0, 2, 5, 5, 0, 0, 3, 2, 4, 5, 0],
  [4, 0, 5, 2, 0, 1, 4, 0, 5, 0, 1, 1],
  [0, 1, 0, 4, 4, 5, 2, 0, 1, 0, 4, 3],
  [5, 4, 0, 1, 1, 0, 3, 4, 0, 2, 0, 0],
  [1, 0, 1, 3, 0, 2, 5, 0, 5, 5, 0, 4],
  [2, 1, 0, 0, 5, 4, 0, 3, 1, 4, 5, 5],
];
const K = 3; // размерность «пространства вкусов»

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const predict = (s, u, m) => Math.min(5, Math.max(1, s.mu + dot(s.U[u], s.M[m])));

function train(rnd) {
  const known = [];
  R.forEach((row, u) => row.forEach((r, m) => { if (r) known.push([u, m, r]); }));
  const mu = known.reduce((s, [, , r]) => s + r, 0) / known.length;
  const U = USERS.map(() => Array.from({ length: K }, () => (rnd() - 0.5) * 0.3));
  const M = MOVIES.map(() => Array.from({ length: K }, () => (rnd() - 0.5) * 0.3));
  const history = [];
  for (let e = 0; e < 400; e++) {
    let sse = 0;
    for (const [u, m, r] of known) {
      const err = r - (mu + dot(U[u], M[m]));
      sse += err * err;
      for (let k = 0; k < K; k++) {
        const uk = U[u][k], mk = M[m][k];
        U[u][k] += 0.03 * (err * mk - 0.02 * uk);
        M[m][k] += 0.03 * (err * uk - 0.02 * mk);
      }
    }
    history.push(Math.sqrt(sse / known.length));
  }
  return { mu, U, M, history };
}

const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));

export default {
  meta: {
    id: 'recommender',
    title: 'Рекомендации: пространство вкусов',
    category: 'tasks',
    order: 30,
    level: 2,
    fidelity: 'trained',
    summary: 'По таблице оценок 8 зрителей и 12 фильмов модель находит «векторы вкуса» и советует, что посмотреть. Зрители оказываются рядом со своими фильмами.',
    uses: 'Рекомендации в онлайн-кинотеатрах, музыкальных сервисах, маркетплейсах и лентах соцсетей.',
    tags: ['рекомендации', 'эмбеддинги', 'матричная факторизация', 'коллаборативная фильтрация'],
    preview: { scatter: 4 },
  },

  type: 'scatter',
  resultTitle: 'Рекомендации',

  async setup({ rnd }) {
    const model = train(rnd);
    // Точки — векторы вкуса в 3D (масштабируем для наглядности)
    const S = 2.2;
    const points = [
      ...USERS.map((name, u) => ({ id: `u${u}`, label: name, pos: model.U[u].map(v => v * S), group: 'зрители' })),
      ...MOVIES.map(([title, genre], m) => ({ id: `m${m}`, label: title, pos: model.M[m].map(v => v * S), group: genre })),
    ];
    const groups = { 'зрители': { label: 'зрители', color: '#ffffff' }, 'боевики': {}, 'комедии': {}, 'драмы': {}, 'мультфильмы': {} };
    return { points, groups, model, status: `Модель обучена: ошибка RMSE ${model.history.at(-1).toFixed(2)} балла за 400 эпох` };
  },

  controls: [
    {
      id: 'user', kind: 'select', label: 'Что посоветовать зрителю?',
      options: [{ value: '', label: '— выберите зрителя —' }, ...USERS.map((u, i) => ({ value: String(i), label: u }))],
      run(state, v) {
        if (v === '') return { highlight: null, lines: [], markers: [], html: '' };
        const u = Number(v);
        const unseen = MOVIES.map((mv, m) => ({ m, title: mv[0], genre: mv[1], p: predict(state.model, u, m) })).filter(x => !R[u][x.m]);
        unseen.sort((a, b) => b.p - a.p);
        const top = unseen.slice(0, 3);
        const liked = R[u].map((r, m) => [r, m]).filter(([r]) => r >= 4).map(([, m]) => MOVIES[m][0]);
        return {
          highlight: [`u${u}`, ...top.map(t => `m${t.m}`)],
          lines: top.map((t, i) => ({ from: `u${u}`, to: `m${t.m}`, color: '#ffd166', width: 4 - i, label: t.p.toFixed(1) })),
          markers: [],
          html: `<p>${escapeHtml(USERS[u])} высоко оценил(а): ${liked.map(escapeHtml).join(', ') || '—'}.</p>
            <ul class="bars">${unseen.map((t, i) => `<li class="${i === 0 ? 'best' : ''}"><span class="name">${escapeHtml(t.title)}</span>
              <span class="bar"><span style="width:${(t.p / 5) * 100}%"></span></span><span class="num">${t.p.toFixed(1)}</span><span class="muted">${stars(t.p)}</span></li>`).join('')}</ul>
            <p class="small">Прогноз оценки = средняя оценка (${state.model.mu.toFixed(2)}) + скалярное произведение вектора вкуса зрителя и вектора фильма.
              Чем ближе фильм к зрителю в пространстве (и чем «в ту же сторону» он смотрит), тем выше прогноз.</p>`,
        };
      },
    },
    {
      id: 'movie', kind: 'select', label: 'Похожие фильмы',
      options: [{ value: '', label: '— выберите фильм —' }, ...MOVIES.map((mv, i) => ({ value: String(i), label: mv[0] }))],
      run(state, v) {
        if (v === '') return { highlight: null, lines: [], markers: [], html: '' };
        const m = Number(v), a = state.model.M[m];
        const cos = (x, y) => dot(x, y) / (Math.hypot(...x) * Math.hypot(...y) || 1);
        const sims = MOVIES.map((mv, j) => ({ j, title: mv[0], s: cos(a, state.model.M[j]) })).filter(x => x.j !== m).sort((p, q) => q.s - p.s).slice(0, 3);
        return {
          highlight: [`m${m}`, ...sims.map(s => `m${s.j}`)],
          lines: sims.map(s => ({ from: `m${m}`, to: `m${s.j}`, color: '#2f9bff', width: 3, label: s.s.toFixed(2) })),
          markers: [],
          html: `<p>Больше всего на «${escapeHtml(MOVIES[m][0])}» похожи: ${sims.map(s => `<b>${escapeHtml(s.title)}</b> (${s.s.toFixed(2)})`).join(', ')}.</p>
            <p class="small muted">Сходство — косинус угла между векторами фильмов. Модель не знает жанров: она нашла их сама, по тому, кто и как ставил оценки.</p>`,
        };
      },
    },
  ],

  describe(p, state) {
    if (p.id.startsWith('u')) {
      const u = Number(p.id.slice(1));
      return {
        tooltip: `Зритель ${p.label}`,
        html: `<h3>Зритель ${escapeHtml(p.label)}</h3>
          <table class="arch-table"><tbody>${MOVIES.map((mv, m) => `<tr><td>${escapeHtml(mv[0])}</td><td class="num">${R[u][m] ? stars(R[u][m]) : `<span class="muted">прогноз ${predict(state.model, u, m).toFixed(1)}</span>`}</td></tr>`).join('')}</tbody></table>`,
      };
    }
    const m = Number(p.id.slice(1));
    const rated = USERS.map((u, i) => [u, R[i][m]]).filter(([, r]) => r);
    return {
      tooltip: `${p.label} (${p.group})`,
      html: `<h3>${escapeHtml(p.label)}</h3><p>Жанр: ${p.group} · вектор (${p.pos.map(v => v.toFixed(2)).join('; ')})</p>
        <p>Оценки: ${rated.map(([u, r]) => `${u} — ${r}`).join(', ')}</p>`,
    };
  },

  legendHtml: `<ul class="legend">
      <li><span class="dot" style="background:#fff"></span><span><b>Белые точки — зрители</b>, цветные — фильмы (цвет — жанр, модель его не знает).</span></li>
      <li><span class="line pos"></span><span><b>Жёлтые линии</b> — рекомендации: подпись — прогноз оценки.</span></li>
      <li><span class="line neg"></span><span><b>Синие линии</b> — похожие фильмы.</span></li>
    </ul>`,

  intro: `<p>Таблица оценок почти пустая: каждый зритель видел лишь часть фильмов. Модель учится представлять и зрителей, и фильмы
    <b>векторами из трёх чисел</b> так, чтобы скалярное произведение векторов предсказывало оценку. Эти векторы и нарисованы в 3D.
    Обучение (400 эпох градиентного спуска) прошло при открытии страницы.</p>`,

  sections: [
    {
      title: 'Таблица оценок',
      open: false,
      html: `<div class="table-scroll"><table class="arch-table vocab"><thead><tr><th></th>${USERS.map(u => `<th>${u}</th>`).join('')}</tr></thead>
        <tbody>${MOVIES.map((mv, m) => `<tr><td>${mv[0]}</td>${R.map(row => `<td class="num ${row[m] ? '' : 'muted'}">${row[m] || '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="small muted">Точка — фильм не смотрели. Задача модели — заполнить эти пропуски.</p>`,
    },
  ],
};
