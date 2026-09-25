// Word2Vec: слова как точки в пространстве смыслов. Соседи и аналогии «король − мужчина + женщина ≈ королева».
import { escapeHtml } from '../src/engine/format.js';

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dist = (a, b) => Math.hypot(...sub(a, b));

// Векторы построены по смысловым направлениям: «пол», «королевский титул», «детёныш», «столица»…
function buildWords(rnd) {
  const jitter = p => p.map(v => v + (rnd() - 0.5) * 0.16);
  const P = [-3, 0.4, 0], GM = [-0.8, 0, 0], GF = [0.8, 0, 0], ROYAL = [0, 1.6, 0], YOUNG = [0, 0, 1.3];
  const people = {
    'мужчина': add(P, GM), 'женщина': add(P, GF), 'король': add(add(P, GM), ROYAL), 'королева': add(add(P, GF), ROYAL),
    'мальчик': add(add(P, GM), YOUNG), 'девочка': add(add(P, GF), YOUNG),
    'принц': add(add(add(P, GM), ROYAL), YOUNG), 'принцесса': add(add(add(P, GF), ROYAL), YOUNG),
  };
  const C = [2.4, -0.6, -2.2], CAP = [0, 1.5, 0.5];
  const countries = { 'Россия': [0, 0, 0], 'Франция': [1.3, 0, 0.3], 'Германия': [0.6, 0, -1], 'Япония': [1.9, 0, -0.5] };
  const capitals = { 'Россия': 'Москва', 'Франция': 'Париж', 'Германия': 'Берлин', 'Япония': 'Токио' };
  const A = [0.2, -2.6, 1.6], CUB = [0.2, -0.3, 1.2];
  const animals = { 'кот': [0, 0, 0], 'собака': [1.1, 0, 0.2], 'корова': [2.1, 0, -0.3], 'лошадь': [1.6, 0, 1] };
  const cubs = { 'кот': 'котёнок', 'собака': 'щенок', 'корова': 'телёнок', 'лошадь': 'жеребёнок' };
  const F = [-2.8, -2.6, -1.8];
  const food = { 'яблоко': [0, 0, 0], 'груша': [0.35, 0.1, 0.2], 'банан': [0.6, -0.1, -0.2], 'хлеб': [-0.4, 0.5, 0.7], 'сыр': [-0.2, 0.7, 0.3] };
  const T = [3.2, -2.2, 2.6];
  const transport = { 'машина': [0, 0, 0], 'автобус': [0.4, 0.2, 0.3], 'поезд': [0.8, 0.1, -0.2], 'самолёт': [0.3, 0.9, 0.2] };

  const points = [];
  const push = (label, pos, group) => points.push({ id: label, label, pos: jitter(pos), group });
  for (const [w, p] of Object.entries(people)) push(w, p, 'люди');
  for (const [w, off] of Object.entries(countries)) {
    push(w, add(C, off), 'страны');
    push(capitals[w], add(add(C, off), CAP), 'столицы');
  }
  for (const [w, off] of Object.entries(animals)) {
    push(w, add(A, off), 'животные');
    push(cubs[w], add(add(A, off), CUB), 'детёныши');
  }
  for (const [w, off] of Object.entries(food)) push(w, add(F, off), 'еда');
  for (const [w, off] of Object.entries(transport)) push(w, add(T, off), 'транспорт');
  return points;
}

const ANALOGIES = [
  ['король', 'мужчина', 'женщина'],
  ['принц', 'мальчик', 'девочка'],
  ['Париж', 'Франция', 'Россия'],
  ['Токио', 'Япония', 'Германия'],
  ['щенок', 'собака', 'кот'],
  ['телёнок', 'корова', 'лошадь'],
];

const vecOf = (state, w) => state.points.find(p => p.id === w).pos;

function nearest(state, target, exclude = []) {
  return state.points
    .filter(p => !exclude.includes(p.id))
    .map(p => ({ p, d: dist(p.pos, target) }))
    .sort((a, b) => a.d - b.d);
}

const fmt = v => `(${v.map(x => x.toFixed(1)).join('; ')})`;

export default {
  meta: {
    id: 'word2vec',
    title: 'Word2Vec: слова как точки в пространстве',
    category: 'nlp',
    order: 40,
    level: 1,
    fidelity: 'demo',
    fidelityNote: 'Векторы трёхмерные и заданы вручную по смысловым направлениям, а не выучены на текстах. Арифметика векторов и поиск соседей — настоящие.',
    summary: 'Похожие по смыслу слова оказываются рядом, а разница векторов кодирует отношения: король − мужчина + женщина ≈ королева.',
    uses: 'Поиск по смыслу, рекомендации, подсказки синонимов; эмбеддинги — входной слой почти любой языковой модели.',
    tags: ['NLP', 'эмбеддинги', 'Word2Vec', 'аналогии'],
    preview: { scatter: 4 },
  },

  type: 'scatter',
  resultTitle: 'Вычисление',

  async setup({ rnd }) {
    const points = buildWords(rnd);
    const groups = {};
    for (const p of points) groups[p.group] = { label: p.group };
    return { points, groups, status: `${points.length} слов в 3D-пространстве смыслов` };
  },

  controls: [
    {
      id: 'analogy', kind: 'select', label: 'Аналогия: A − B + C ≈ ?',
      options: [{ value: '', label: '— выберите —' }, ...ANALOGIES.map((a, i) => ({ value: String(i), label: `${a[0]} − ${a[1]} + ${a[2]}` }))],
      run(state, value) {
        if (value === '') return { highlight: null, lines: [], markers: [], html: '' };
        const [a, b, c] = ANALOGIES[Number(value)];
        const target = add(sub(vecOf(state, a), vecOf(state, b)), vecOf(state, c));
        const [best, second] = nearest(state, target, [a, b, c]);
        return {
          highlight: [a, b, c, best.p.id],
          lines: [
            { from: b, to: a, color: '#ff9f1c', width: 3, arrow: true, label: `${a} − ${b}` },
            { from: c, to: target, color: '#ff9f1c', width: 3, arrow: true },
            { from: target, to: best.p.id, color: '#7ee081', width: 2 },
          ],
          markers: [{ id: 'target', pos: target, label: '?', color: '#ffd166', wire: true, info: { tooltip: `A − B + C = ${fmt(target)}`, html: `<h3>Результат вычисления</h3><p>${escapeHtml(a)} − ${escapeHtml(b)} + ${escapeHtml(c)} = <b class="num">${fmt(target)}</b></p><p>Ближайшее слово: <b>${escapeHtml(best.p.label)}</b></p>` } }],
          html: `<p><b>${a}</b> − <b>${b}</b> + <b>${c}</b> = ${fmt(target)}</p>
            <p>Ближайшее слово к этой точке — <b class="pos">«${best.p.label}»</b> (расстояние ${best.d.toFixed(2)}),
            следующее — «${second.p.label}» (${second.d.toFixed(2)}).</p>
            <p class="small muted">Оранжевые стрелки параллельны: «${b} → ${a}» и «${c} → ?» — это одно и то же смысловое направление.
            Именно так эмбеддинги «понимают» отношения между словами.</p>`,
        };
      },
    },
    {
      id: 'word', kind: 'select', label: 'Соседи слова',
      options: [{ value: '', label: '— выберите слово —' }, ...['король', 'Москва', 'кот', 'яблоко', 'поезд', 'девочка', 'щенок'].map(w => ({ value: w, label: w }))],
      run(state, w) {
        if (!w) return { highlight: null, lines: [], markers: [], html: '' };
        const near = nearest(state, vecOf(state, w), [w]).slice(0, 5);
        return {
          highlight: [w, ...near.map(n => n.p.id)],
          lines: near.map((n, i) => ({ from: w, to: n.p.id, color: '#2f9bff', width: 3 - i * 0.4, label: n.d.toFixed(1) })),
          markers: [],
          html: `<p>Ближайшие к «${w}» слова: ${near.map(n => `<b>${n.p.label}</b> (${n.d.toFixed(2)})`).join(', ')}.</p>
            <p class="small muted">Близость = расстояние между точками. В настоящих моделях чаще считают косинусное сходство — угол между векторами.</p>`,
        };
      },
    },
  ],

  describe(p, state) {
    const near = nearest(state, p.pos, [p.id]).slice(0, 3);
    return {
      tooltip: `${p.label} ${fmt(p.pos)}`,
      html: `<h3>«${escapeHtml(p.label)}»</h3>
        <p>Группа: <b>${escapeHtml(p.group)}</b></p>
        <p>Вектор: <b class="num">${fmt(p.pos)}</b></p>
        <p>Ближайшие: ${near.map(n => `${escapeHtml(n.p.label)} (${n.d.toFixed(2)})`).join(', ')}</p>`,
    };
  },

  legendHtml: `<ul class="legend">
      <li><span class="dot glow-pos"></span><span><b>Точка — слово</b>, цвет — смысловая группа (люди, страны, столицы, животные…).</span></li>
      <li><span class="line pos"></span><span><b>Оранжевые стрелки</b> — разность векторов (например, «мужчина → король» = «королевский титул»).</span></li>
      <li><span class="line neg"></span><span><b>Синие линии</b> — ближайшие соседи выбранного слова.</span></li>
    </ul>`,

  intro: `<p>Word2Vec (Google, 2013) учится по огромному корпусу текстов: слова, которые встречаются в похожих контекстах, получают похожие векторы.
    Здесь 33 слова в трёх измерениях, чтобы их можно было нарисовать. Выберите аналогию или слово в «Управлении».</p>`,

  sections: [
    {
      title: 'Что здесь упрощено',
      open: false,
      html: `<p>Настоящие векторы Word2Vec имеют 100–300 измерений и выучиваются на миллиардах слов; их нельзя нарисовать без сжатия (PCA, t-SNE),
        и аналогии в них выполняются приблизительно. Здесь векторы трёхмерные и построены вручную по смысловым направлениям
        («пол», «титул», «детёныш», «столица») с небольшим шумом — но арифметика и поиск соседей настоящие.</p>`,
    },
  ],
};
