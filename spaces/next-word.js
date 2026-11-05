// Предсказание следующего слова с self-attention: последнее слово «смотрит» на контекст.
import { tokenize, softmax, dot, vocabularyTable } from '../src/engine/models/text.js';
import { scope, lang, fmtNum } from '../src/i18n/i18n.js';

// Тексты и слова модели — в словарях src/i18n/<язык>/spaces/next-word.js (sp.next-word.w.<id>: слово на языке; пусто — слова нет).
// Векторы и частые сочетания (биграммы) заданы по id и одинаковы для всех языков.
const S = scope('sp.next-word');

// Измерения: еда/питьё, животные, погода, время (утро+, вечер−), действие, место
const VEC = {
  cat: [0, 1, 0, 0, 0, 0],
  kitten: [0, 1, 0, 0, 0, 0],
  dog: [0, 1, 0, 0, 0, 0],
  bird: [0, 1, 0.2, 0, 0, 0],
  milk: [1, 0.8, 0, 0.2, 0, 0],
  coffee: [1, 0, 0, 1, 0, 0],
  tea: [1, 0, 0, -0.8, 0, 0],
  water: [1, 0.3, 0.3, 0, 0, 0],
  juice: [1, 0, 0, 0.5, 0, 0],
  fish: [1, 0.8, 0, 0, 0, 0],
  porridge: [1, 0, 0, 0.9, 0, 0],
  bone: [0.7, 1, 0, 0, 0, 0],
  grain: [0.7, 0.9, 0.2, 0, 0, 0],
  dinner: [1, 0, 0, -1, 0, 0],
  breakfast: [1, 0, 0, 1, 0, 0],
  kumis: [1, 0.5, 0.3, 0, 0, 0.5],
  baursaks: [1, 0, 0, 0.4, 0, 0.2],
  steppe: [0, 0.3, 0.6, 0, 0, 1],
  yurt: [0, 0.2, 0, -0.3, 0, 1],
  rain: [0, 0, 1, 0, 0, 0.3],
  snow: [0, 0, 1, -0.2, 0, 0.3],
  cold: [0, 0, 1, 0, 0, 0.2],
  warm: [0, 0, 0.9, 0.2, 0, 0.2],
  home: [0, 0.2, 0, -0.4, 0, 1],
  outside: [0, 0, 0.6, 0, 0, 1],
  park: [0, 0.3, 0.3, 0.3, 0, 1],
  work: [0, 0, 0, 0.8, 0, 1],
  homeward: [0, 0, 0, -0.6, 0, 1],
  morning: [0, 0, 0, 1, 0, 0],
  evening: [0, 0, 0, -1, 0, 0],
  night: [0, 0, 0, -1, 0, 0.2],
  day: [0, 0, 0.2, 0.5, 0, 0],
  drinks: [0.9, 0, 0, 0, 1, 0],
  drink: [0.9, 0, 0, 0, 1, 0],
  drinkThey: [0.9, 0, 0, 0, 1, 0],
  drinkWe: [0.9, 0, 0, 0, 1, 0],
  eats: [0.9, 0, 0, 0, 1, 0],
  eat: [0.9, 0, 0, 0, 1, 0],
  eatThey: [0.9, 0, 0, 0, 1, 0],
  sleeps: [0, 0.3, 0, -0.8, 1, 0.3],
  sleep: [0, 0, 0, -0.8, 1, 0.3],
  goes: [0, 0, 0.8, 0, 1, 0.3],
  go: [0, 0, 0, 0, 1, 0.8],
  walks: [0, 0.4, 0.3, 0.2, 1, 0.6],
  walk: [0, 0, 0.3, 0.2, 1, 0.6],
  purrs: [0, 1, 0, 0, 1, 0],
  barks: [0, 1, 0, 0, 1, 0],
  sings: [0, 0.8, 0, 0.5, 1, 0],
  i: [0, 0, 0, 0, 0, 0],
  we: [0, 0, 0, 0, 0, 0],
  on: [0, 0, 0, 0, 0, 0.8],
  in: [0, 0, 0, 0, 0, 0.6],
  and: [0, 0, 0, 0, 0, 0],
  the: [0, 0, 0, 0, 0, 0],
  it: [0, 0, 0, 0, 0, 0],
  is: [0, 0, 0, 0, 0, 0],
  a: [0, 0, 0, 0, 0, 0],
};
const FUNCTION_IDS = new Set(['i', 'we', 'on', 'in', 'and', 'the', 'it', 'is', 'a']);
const FOOD_NEXT = { morning: 0.6, evening: 0.6, home: 0.5 };
// Биграммы: какие слова обычно идут сразу после данного (бонус к оценке)
const B = {
  cat: { sleeps: 1.2, eats: 1.1, drinks: 1.0, purrs: 1.4, walks: 0.6 },
  kitten: { sleeps: 1.2, eats: 1.1, drinks: 1.0, purrs: 1.4 },
  dog: { barks: 1.4, eats: 1.1, sleeps: 1.0, walks: 1.0, drinks: 0.6 },
  bird: { sings: 1.4, eats: 0.9, drinks: 0.5 },
  drinks: { milk: 1.3, coffee: 1.3, tea: 1.3, water: 1.3, juice: 1.1, kumis: 1.1 },
  eats: { fish: 1.2, porridge: 1.2, bone: 1.0, grain: 1.0, breakfast: 0.8, dinner: 0.8, baursaks: 1.0 },
  goes: { rain: 1.5, snow: 1.5 },
  on: { outside: 1.5, work: 1.1 },
  in: { park: 1.3, yurt: 1.2, steppe: 1.1 },
  outside: { cold: 1.3, warm: 1.2, rain: 0.9, snow: 0.9 },
  i: { drink: 1.1, eat: 1.1, sleep: 0.9, go: 1.0 },
  we: { walk: 1.2, drinkWe: 1.0, eatThey: -1 },
  morning: { drink: 0.8, eat: 0.7, go: 0.6, walk: 0.5, goes: 0.6 },
  go: { homeward: 1.3, work: 0.9 },
  sleeps: { home: 1.1, day: 0.7, night: 0.8 },
  walks: { park: 1.0, evening: 0.7, morning: 0.6 },
};
for (const w of ['drink', 'drinkThey', 'drinkWe']) B[w] = B.drinks;
for (const w of ['eat', 'eatThey']) B[w] = B.eats;
for (const w of ['evening', 'day', 'night']) B[w] = B.morning;
for (const w of ['milk', 'coffee', 'tea', 'water', 'juice', 'fish', 'porridge', 'bone', 'grain', 'kumis', 'baursaks']) B[w] = FOOD_NEXT;
B.sleep = B.sleeps;
B.walk = B.walks;
B.is = B.outside; // «outside it is …» — то же, что «на улице …»

const ZERO = [0, 0, 0, 0, 0, 0];
const vec = id => VEC[id] ?? ZERO;

// Слова текущего языка: слово → id и id → слово (собирается один раз на язык)
const cache = {};
function lexicon() {
  if (!cache[lang]) {
    const idOf = new Map(), wordOf = {};
    for (const id of Object.keys(VEC)) {
      const w = S.t(`w.${id}`);
      if (w) { idOf.set(w, id); wordOf[id] = w; }
    }
    cache[lang] = { idOf, wordOf, candidates: Object.keys(wordOf).filter(id => !FUNCTION_IDS.has(id)) };
  }
  return cache[lang];
}

/** Запрос: что слово «ищет» в контексте. Глагол ищет «кто/когда/где», место ищет погоду и т.п. */
function query(x) {
  const [food, , weather, , action, place] = x;
  return [food * 0.3 + action * 0.3, action, action * 0.4 + place * 0.8, action + food * 0.8, 0, action * 0.4 + weather * 0.4];
}
function attend(ids, qi) {
  const q = query(vec(ids[qi]));
  const scores = ids.slice(0, qi + 1).map((id, j) => 2.2 * dot(q, vec(id)) - 0.15 * (qi - j) + (j === qi ? 0.5 : 0));
  return softmax(scores);
}

export default {
  meta: {
    id: 'next-word',
    title: S('title'),
    category: 'nlp',
    order: 20,
    level: 2,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['NLP', 'attention', 'Transformer', 'autocomplete', 'embeddings'],
    preview: { tokens: [S('prev.0'), S('prev.1'), S('prev.2'), '?'] },
  },

  type: 'tokens',
  mode: 'attention',
  runLabel: S('runLabel'),
  resultTitle: S('resultTitle'),
  presets: S.list('presets', 9),

  process(text) {
    const { idOf, wordOf, candidates } = lexicon();
    const words = tokenize(text);
    const ids = words.map(w => idOf.get(w) ?? null);
    const tokens = words.map((w, i) => ({ text: w, known: ids[i] !== null }));
    const embeddings = ids.map(vec);
    const qi = words.length - 1;
    const weights = attend(ids, qi);
    const matrix = ids.map((_, i) => attend(ids, i));
    const ctx = embeddings[0].map((_, k) => weights.reduce((s, w, j) => s + w * embeddings[j][k], 0));
    const last = words[qi], lastId = ids[qi];
    const isVerb = vec(lastId)[4] > 0.5;
    const raw = candidates.map(v => {
      const c = 1.8 * dot(ctx, vec(v));
      const b = B[lastId]?.[v] ?? 0;
      const pen = (ids.includes(v) ? -1.5 : 0) + (isVerb && vec(v)[4] > 0.5 ? -1 : 0);
      return { id: v, word: wordOf[v], score: c + b + pen, c, b };
    });
    const probs = softmax(raw.map(r => r.score));
    const cands = raw.map((r, i) => ({ ...r, p: probs[i] })).sort((a, b) => b.p - a.p).slice(0, 6);
    const topAttn = weights.map((w, j) => [w, j]).sort((a, b) => b[0] - a[0])[0];
    for (const c of cands) {
      const ctxText = S.t('whyContext', { v: c.c >= 0 ? `+${fmtNum(c.c, 2)}` : fmtNum(c.c, 2) });
      c.why = S.h('why', { ctx: ctxText, pair: c.b ? S.t('whyPair', { last, word: c.word, v: c.b > 0 ? `+${fmtNum(c.b, 1)}` : fmtNum(c.b, 1) }) : '' });
    }
    return {
      tokens, dims: [0, 1, 2, 3, 4, 5].map(k => S.t(`dims.${k}`)), embeddings,
      attention: { query: qi, weights, matrix },
      candidates: cands,
      html: S.h('resultHtml', { word: cands[0].word, p: Math.round(cands[0].p * 100), last, top: words[topAttn[1]], tp: Math.round(topAttn[0] * 100) }),
    };
  },

  vocabularyHtml: () => {
    const { wordOf } = lexicon();
    const V = {};
    for (const id of Object.keys(wordOf)) V[wordOf[id]] = VEC[id];
    return vocabularyTable(V, [0, 1, 2, 3, 4, 5].map(k => S.t(`dims.${k}`)), { limit: 200 });
  },

  intro: S('introHtml'),

  sections: [{ title: S('transformersTitle'), open: false, html: S('transformersHtml') }],
};
