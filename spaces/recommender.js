// Рекомендательная система: матричная факторизация. Зрители и фильмы — точки в общем «пространстве вкусов».
import { escapeHtml } from '../src/engine/format.js';
import { scope, str, fmtNum } from '../src/i18n/i18n.js';

// Тексты, названия фильмов и имена зрителей — в словарях src/i18n/<язык>/spaces/recommender.js
const S = scope('sp.recommender');
const e = x => escapeHtml(str(x));

// Часть фильмов — казахстанские (той же жанровой группы, что и заменённые), часть — мировые хиты. [название, жанр]
const GENRES = ['action', 'action', 'action', 'comedy', 'comedy', 'comedy', 'drama', 'drama', 'drama', 'animation', 'animation', 'animation'];
const MOVIES = GENRES.map((g, i) => [S(`movies.${i}`), g]);
// Оценки 1–5, 0 — не смотрел. Вкусы: Айгерим — драмы и мультфильмы, Бауыржан — боевики, Динара — комедии и мультфильмы…
const USERS = S.list('users', 8);
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
// Сдвиги подписей (по номеру фильма), чтобы длинные названия не слипались с соседними (точки не двигаются)
const LABEL_OFFSETS = { 6: [-0.05, 0], 4: [0, -0.22], 10: [0, 0.2] };

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
    title: S('title'),
    category: 'tasks',
    order: 30,
    level: 2,
    fidelity: 'trained',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['recommendations', 'embeddings', 'matrix-factorization', 'collaborative-filtering'],
    preview: { scatter: 4 },
  },

  type: 'scatter',
  resultTitle: S('resultTitle'),

  async setup({ rnd }) {
    const model = train(rnd);
    // Точки — векторы вкуса в 3D (масштабируем для наглядности)
    const k = 2.2;
    const points = [
      ...USERS.map((name, u) => ({ id: `u${u}`, label: name, pos: model.U[u].map(v => v * k), group: 'viewers' })),
      ...MOVIES.map(([title, genre], m) => ({ id: `m${m}`, label: title, pos: model.M[m].map(v => v * k), group: genre, labelOffset: LABEL_OFFSETS[m] })),
    ];
    const groups = { viewers: { label: S('viewers'), color: '#ffffff' }, action: { label: S('genre.action') }, comedy: { label: S('genre.comedy') }, drama: { label: S('genre.drama') }, animation: { label: S('genre.animation') } };
    return { points, groups, model, status: S('trained', { rmse: { num: model.history.at(-1), d: 2 } }) };
  },

  controls: [
    {
      id: 'user', kind: 'select', label: S('userLabel'),
      options: [{ value: '', label: S('pickUser') }, ...USERS.map((u, i) => ({ value: String(i), label: u }))],
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
          html: () => `<p>${S.h('liked', { name: str(USERS[u]), list: liked.map(str).join(', ') || '—' })}</p>
            <ul class="bars">${unseen.map((t, i) => `<li class="${i === 0 ? 'best' : ''}"><span class="name">${e(t.title)}</span>
              <span class="bar"><span style="width:${(t.p / 5) * 100}%"></span></span><span class="num">${fmtNum(t.p, 1)}</span><span class="muted">${stars(t.p)}</span></li>`).join('')}</ul>
            <p class="small">${S.h('predictNote', { mu: { num: state.model.mu, d: 2 } })}</p>`,
        };
      },
    },
    {
      id: 'movie', kind: 'select', label: S('movieLabel'),
      options: [{ value: '', label: S('pickMovie') }, ...MOVIES.map((mv, i) => ({ value: String(i), label: mv[0] }))],
      run(state, v) {
        if (v === '') return { highlight: null, lines: [], markers: [], html: '' };
        const m = Number(v), a = state.model.M[m];
        const cos = (x, y) => dot(x, y) / (Math.hypot(...x) * Math.hypot(...y) || 1);
        const sims = MOVIES.map((mv, j) => ({ j, title: mv[0], s: cos(a, state.model.M[j]) })).filter(x => x.j !== m).sort((p, q) => q.s - p.s).slice(0, 3);
        return {
          highlight: [`m${m}`, ...sims.map(s => `m${s.j}`)],
          lines: sims.map(s => ({ from: `m${m}`, to: `m${s.j}`, color: '#2f9bff', width: 3, label: s.s.toFixed(2) })),
          markers: [],
          html: () => `<p>${S.t('similarHtml', { title: e(MOVIES[m][0]), list: sims.map(s => `<b>${e(s.title)}</b> (${fmtNum(s.s, 2)})`).join(', ') })}</p>
            <p class="small muted">${S.h('similarNote')}</p>`,
        };
      },
    },
  ],

  describe(p, state) {
    if (p.id.startsWith('u')) {
      const u = Number(p.id.slice(1));
      return {
        tooltip: S.t('viewer', { name: str(p.label) }),
        html: `<h3>${S.h('viewer', { name: str(p.label) })}</h3>
          <table class="arch-table"><tbody>${MOVIES.map((mv, m) => `<tr><td>${e(mv[0])}</td><td class="num">${R[u][m] ? stars(R[u][m]) : `<span class="muted">${S.h('forecast', { v: { num: predict(state.model, u, m), d: 1 } })}</span>`}</td></tr>`).join('')}</tbody></table>`,
      };
    }
    const m = Number(p.id.slice(1));
    const rated = USERS.map((u, i) => [u, R[i][m]]).filter(([, r]) => r);
    const genre = S.t(`genre.${p.group}`);
    return {
      tooltip: `${str(p.label)} (${genre})`,
      html: `<h3>${e(p.label)}</h3><p>${S.h('movieInfo', { genre, vec: p.pos.map(v => fmtNum(v, 2)).join('; ') })}</p>
        <p>${S.h('ratings', { list: rated.map(([u, r]) => `${str(u)} — ${r}`).join(', ') })}</p>`,
    };
  },

  legendHtml: S('legendHtml'),

  intro: S('introHtml'),

  sections: [{
    title: S('tableTitle'),
    open: false,
    html: () => `<div class="table-scroll"><table class="arch-table vocab"><thead><tr><th></th>${USERS.map(u => `<th>${e(u)}</th>`).join('')}</tr></thead>
        <tbody>${MOVIES.map((mv, m) => `<tr><td>${e(mv[0])}</td>${R.map(row => `<td class="num ${row[m] ? '' : 'muted'}">${row[m] || '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="small muted">${S.h('tableNote')}</p>`,
  }],
};
