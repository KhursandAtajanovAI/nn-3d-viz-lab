// Word2Vec: слова как точки в пространстве смыслов. Соседи и аналогии «хан − мужчина + женщина ≈ ханша».
import { escapeHtml } from '../src/engine/format.js';
import { scope, str, fmtNum } from '../src/i18n/i18n.js';

// Тексты и сами слова — в словарях src/i18n/<язык>/spaces/word2vec.js; здесь у слов постоянные латинские id
const S = scope('sp.word2vec');
const W = id => S(`w.${id}`);
const w_ = id => str(W(id));
const e = x => escapeHtml(str(x));

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dist = (a, b) => Math.hypot(...sub(a, b));

// Сдвиги подписей в плотных кластерах (длинные слова иначе слипаются). Координаты точек не меняются.
const LABEL_OFFSETS = {
  apple: [-0.05, 0], flatbread: [-0.05, 0.22], baursak: [0, 0.28], kurt: [0, 0], beshbarmak: [0, -0.25],
  camelCalf: [-0.05, 0], khan: [0, 0.2], kg: [0, 0.2], kz: [-0.05, 0],
};

// Векторы построены по смысловым направлениям: «пол», «титул правителя», «детёныш», «столица»…
function buildWords(rnd) {
  const jitter = p => p.map(v => v + (rnd() - 0.5) * 0.16);
  const P = [-3, 0.4, 0], GM = [-0.8, 0, 0], GF = [0.8, 0, 0], ROYAL = [0, 1.6, 0], YOUNG = [0, 0, 1.3];
  const people = {
    man: add(P, GM), woman: add(P, GF), khan: add(add(P, GM), ROYAL), khanum: add(add(P, GF), ROYAL),
    boy: add(add(P, GM), YOUNG), girl: add(add(P, GF), YOUNG),
    sultan: add(add(add(P, GM), ROYAL), YOUNG), khanzada: add(add(add(P, GF), ROYAL), YOUNG),
  };
  const C = [2.4, -0.6, -2.2], CAP = [0, 1.5, 0.5];
  const countries = { kz: [0, 0, 0], uz: [1.3, 0, 0.3], kg: [0.6, 0, -1], tj: [1.9, 0, -0.5] };
  const capitals = { kz: 'astana', uz: 'tashkent', kg: 'bishkek', tj: 'dushanbe' };
  const A = [0.2, -2.6, 1.6], CUB = [0.2, -0.3, 1.2];
  const animals = { camel: [0, 0, 0], sheep: [1.1, 0, 0.2], eagle: [2.1, 0, -0.3], horse: [1.6, 0, 1] };
  const cubs = { camel: 'camelCalf', sheep: 'lamb', eagle: 'eaglet', horse: 'foal' };
  const F = [-2.8, -2.6, -1.8];
  const food = { apple: [0, 0, 0], kurt: [0.35, 0.1, 0.2], beshbarmak: [0.6, -0.1, -0.2], flatbread: [-0.4, 0.5, 0.7], baursak: [-0.2, 0.7, 0.3] };
  const T = [3.2, -2.2, 2.6];
  const transport = { car: [0, 0, 0], bus: [0.4, 0.2, 0.3], train: [0.8, 0.1, -0.2], plane: [0.3, 0.9, 0.2] };

  const points = [];
  const push = (id, pos, group) => points.push({ id, label: W(id), pos: jitter(pos), group, labelOffset: LABEL_OFFSETS[id] });
  for (const [w, p] of Object.entries(people)) push(w, p, 'people');
  for (const [w, off] of Object.entries(countries)) {
    push(w, add(C, off), 'countries');
    push(capitals[w], add(add(C, off), CAP), 'capitals');
  }
  for (const [w, off] of Object.entries(animals)) {
    push(w, add(A, off), 'animals');
    push(cubs[w], add(add(A, off), CUB), 'cubs');
  }
  for (const [w, off] of Object.entries(food)) push(w, add(F, off), 'food');
  for (const [w, off] of Object.entries(transport)) push(w, add(T, off), 'transport');
  return points;
}

const ANALOGIES = [
  ['khan', 'man', 'woman'],
  ['sultan', 'boy', 'girl'],
  ['astana', 'kz', 'uz'],
  ['bishkek', 'kg', 'tj'],
  ['lamb', 'sheep', 'camel'],
  ['foal', 'horse', 'eagle'],
];

const vecOf = (state, w) => state.points.find(p => p.id === w).pos;

function nearest(state, target, exclude = []) {
  return state.points
    .filter(p => !exclude.includes(p.id))
    .map(p => ({ p, d: dist(p.pos, target) }))
    .sort((a, b) => a.d - b.d);
}

const fmt = v => `(${v.map(x => fmtNum(x, 1)).join('; ')})`;

export default {
  meta: {
    id: 'word2vec',
    title: S('title'),
    category: 'nlp',
    order: 40,
    level: 1,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['NLP', 'embeddings', 'Word2Vec', 'analogies'],
    preview: { scatter: 4 },
  },

  type: 'scatter',
  resultTitle: S('resultTitle'),

  async setup({ rnd }) {
    const points = buildWords(rnd);
    const groups = {};
    for (const p of points) groups[p.group] = { label: S(`group.${p.group}`) };
    return { points, groups, status: S('status', { n: points.length }) };
  },

  controls: [
    {
      id: 'analogy', kind: 'select', label: S('analogyLabel'),
      options: [{ value: '', label: S('pick') }, ...ANALOGIES.map((a, i) => ({ value: String(i), label: S('analogy', { a: W(a[0]), b: W(a[1]), c: W(a[2]) }) }))],
      run(state, value) {
        if (value === '') return { highlight: null, lines: [], markers: [], html: '' };
        const [a, b, c] = ANALOGIES[Number(value)];
        const target = add(sub(vecOf(state, a), vecOf(state, b)), vecOf(state, c));
        const [best, second] = nearest(state, target, [a, b, c]);
        return {
          highlight: [a, b, c, best.p.id],
          lines: [
            { from: b, to: a, color: '#ff9f1c', width: 3, arrow: true, label: S('diff', { a: W(a), b: W(b) }) },
            { from: c, to: target, color: '#ff9f1c', width: 3, arrow: true },
            { from: target, to: best.p.id, color: '#7ee081', width: 2 },
          ],
          markers: [{
            id: 'target', pos: target, label: '?', color: '#ffd166', wire: true,
            info: () => ({
              tooltip: `A − B + C = ${fmt(target)}`,
              html: `<h3>${S.h('calcTitle')}</h3><p>${e(W(a))} − ${e(W(b))} + ${e(W(c))} = <b class="num">${fmt(target)}</b></p><p>${S.h('nearestWord', { w: w_(best.p.id) })}</p>`,
            }),
          }],
          html: () => `<p><b>${e(W(a))}</b> − <b>${e(W(b))}</b> + <b>${e(W(c))}</b> = ${fmt(target)}</p>
            <p>${S.t('analogyHtml', { best: e(W(best.p.id)), d: fmtNum(best.d, 2), second: e(W(second.p.id)), d2: fmtNum(second.d, 2) })}</p>
            <p class="small muted">${S.h('parallelNote', { a: w_(a), b: w_(b), c: w_(c) })}</p>`,
        };
      },
    },
    {
      id: 'word', kind: 'select', label: S('wordLabel'),
      options: [{ value: '', label: S('pickWord') }, ...['khan', 'astana', 'camel', 'baursak', 'train', 'girl', 'lamb'].map(w => ({ value: w, label: W(w) }))],
      run(state, w) {
        if (!w) return { highlight: null, lines: [], markers: [], html: '' };
        const near = nearest(state, vecOf(state, w), [w]).slice(0, 5);
        return {
          highlight: [w, ...near.map(n => n.p.id)],
          lines: near.map((n, i) => ({ from: w, to: n.p.id, color: '#2f9bff', width: 3 - i * 0.4, label: fmtNum(n.d, 1) })),
          markers: [],
          html: () => `<p>${S.t('neighborsHtml', { w: e(W(w)), list: near.map(n => `<b>${e(n.p.label)}</b> (${fmtNum(n.d, 2)})`).join(', ') })}</p>
            <p class="small muted">${S.h('distNote')}</p>`,
        };
      },
    },
  ],

  describe(p, state) {
    const near = nearest(state, p.pos, [p.id]).slice(0, 3);
    return {
      tooltip: `${str(p.label)} ${fmt(p.pos)}`,
      html: `<h3>${S.h('quoted', { w: str(p.label) })}</h3>
        <p>${S.h('groupInfo', { g: S.t(`group.${p.group}`) })}</p>
        <p>${S.h('vector')} <b class="num">${fmt(p.pos)}</b></p>
        <p>${S.h('nearest', { list: near.map(n => `${str(n.p.label)} (${fmtNum(n.d, 2)})`).join(', ') })}</p>`,
    };
  },

  legendHtml: S('legendHtml'),
  intro: S('introHtml'),
  sections: [{ title: S('simplifiedTitle'), open: false, html: S('simplifiedHtml') }],
};
