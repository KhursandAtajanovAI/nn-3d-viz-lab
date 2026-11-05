// Анализ тональности: текст → эмбеддинги слов → средний вектор → скрытый слой → «позитив/негатив».
import { tokenize, sigmoid, vocabularyTable, lookupForm } from '../src/engine/models/text.js';
import { escapeHtml } from '../src/engine/format.js';
import { scope, lang } from '../src/i18n/i18n.js';

// Тексты, слова модели и их формы — в словарях src/i18n/<язык>/spaces/sentiment.js (sp.sentiment.w.<id>: слово на языке;
// пусто — слова в этом языке нет). Здесь только числа: у каждого слова постоянный id.
const S = scope('sp.sentiment');

// Вручную заданные эмбеддинги: [позитив, негатив, сила эмоции, отрицание]
const VEC = {
  excellent: [1, 0, 0.6, 0],
  great: [1, 0, 0.6, 0],
  good: [0.8, 0, 0.2, 0],
  nice: [0.8, 0, 0.2, 0],
  lovely: [1, 0, 0.7, 0],
  wonderful: [1, 0, 0.6, 0],
  magnificent: [1, 0, 0.9, 0],
  amazing: [1, 0, 1, 0],
  like: [0.8, 0, 0.3, 0],
  love: [0.9, 0, 0.6, 0],
  enjoyedM: [0.8, 0, 0.3, 0],
  enjoyedN: [0.8, 0, 0.3, 0],
  interesting: [0.6, 0, 0.2, 0],
  interestingAdv: [0.6, 0, 0.2, 0],
  funny: [0.6, 0, 0.3, 0],
  kind: [0.7, 0, 0.2, 0],
  beautiful: [0.7, 0, 0.3, 0],
  convenient: [0.6, 0, 0.1, 0],
  fast: [0.4, 0, 0.1, 0],
  delicious: [0.8, 0, 0.3, 0],
  recommend: [0.9, 0, 0.4, 0],
  advise: [0.8, 0, 0.3, 0],
  delight: [1, 0, 1, 0],
  masterpiece: [1, 0, 0.9, 0],
  bad: [0, 0.8, 0.2, 0],
  poor: [0, 0.8, 0.2, 0],
  terrible: [0, 1, 0.8, 0],
  awful: [0, 1, 0.8, 0],
  disgusting: [0, 1, 1, 0],
  boring: [0, 0.7, 0.2, 0],
  dull: [0, 0.7, 0.2, 0],
  slowAdv: [0, 0.4, 0.1, 0],
  sad: [0, 0.5, 0.3, 0],
  hate: [0, 0.9, 0.8, 0],
  disappointed: [0, 0.8, 0.4, 0],
  disappointment: [0, 0.8, 0.4, 0],
  late: [0, 0.6, 0.2, 0],
  polite: [0.7, 0, 0.2, 0],
  cozy: [0.7, 0, 0.2, 0],
  broke: [0, 0.7, 0.3, 0],
  expensive: [0, 0.4, 0.1, 0],
  slow: [0, 0.4, 0.1, 0],
  inconvenient: [0, 0.6, 0.1, 0],
  nightmare: [0, 1, 0.9, 0],
  very: [0, 0, 0.8, 0],
  totally: [0, 0, 0.5, 0.2],
  simply: [0, 0, 0.3, 0],
  most: [0, 0, 0.6, 0],
  not: [0, 0.1, 0, 1],
  no: [0, 0.2, 0, 1],
  never: [0, 0.2, 0.3, 1],
  nor: [0, 0, 0, 0.8],
  movie: [0, 0, 0, 0],
  book: [0, 0, 0, 0],
  service: [0, 0, 0, 0],
  phone: [0, 0, 0, 0],
  food: [0, 0, 0, 0],
  courier: [0, 0, 0, 0],
  taxi: [0, 0, 0, 0],
  driver: [0, 0, 0, 0],
  arrived: [0, 0, 0, 0],
  cafe: [0, 0, 0, 0],
  coffee: [0, 0, 0, 0],
  actors: [0, 0, 0, 0],
  plot: [0, 0, 0, 0],
  delivery: [0, 0, 0, 0],
  was: [0, 0, 0, 0],
  were: [0, 0, 0, 0],
  this: [0, 0, 0, 0],
  me: [0, 0, 0, 0],
  i: [0, 0, 0, 0],
  and: [0, 0, 0, 0],
  but: [0, 0, 0, 0],
  while: [0, 0, 0, 0],
  dont: [0, 0.1, 0, 1],
  doesnt: [0, 0.1, 0, 1],
  didnt: [0, 0.1, 0, 1],
  isnt: [0, 0.1, 0, 1],
  wasnt: [0, 0.1, 0, 1],
  the: [0, 0, 0, 0],
  a: [0, 0, 0, 0],
  is: [0, 0, 0, 0],
  are: [0, 0, 0, 0],
  it: [0, 0, 0, 0],
};

const dims = () => [0, 1, 2, 3].map(k => S.t(`dims.${k}`));

// Слово текущего языка → вектор (словарь собирается один раз на язык)
const cache = {};
function lexicon() {
  if (!cache[lang]) {
    const V = {};
    for (const id of Object.keys(VEC)) {
      const w = S.t(`w.${id}`);
      if (w) V[w] = VEC[id];
    }
    cache[lang] = V;
  }
  return cache[lang];
}

export default {
  meta: {
    id: 'sentiment',
    title: S('title'),
    category: 'nlp',
    order: 10,
    level: 1,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['NLP', 'embeddings', 'classification', 'bag-of-words'],
    preview: { tokens: S.list('prev', 3) },
  },

  type: 'tokens',
  mode: 'pool',
  runLabel: S('runLabel'),
  resultTitle: S('resultTitle'),
  presets: S.list('presets', 6),

  process(text) {
    const V = lexicon();
    const DIMS = dims();
    const words = tokenize(text);
    const base = words.map(w => lookupForm(V, w));
    const tokens = words.map((w, i) => ({ text: w, known: !!base[i], note: base[i] && base[i] !== w ? S.h('formNote', { base: base[i] }) : '' }));
    const embeddings = base.map(b => (b ? V[b] : [0, 0, 0, 0]));
    const pooled = DIMS.map((_, k) => embeddings.reduce((s, e) => s + e[k], 0) / Math.max(1, embeddings.length));
    const [pos, neg, strength, not] = pooled;
    // Скрытый слой (ReLU) с заданными вручную весами
    const hPos = Math.max(0, 3 * pos + 1.2 * strength * pos - 0.05);
    const hNeg = Math.max(0, 3 * neg + 1.2 * strength * neg - 0.05);
    const hNot = Math.max(0, 2 * not - 0.1);
    const z = 2.6 * hPos - 2.6 * hNeg - 1.8 * hNot;
    const p = sigmoid(z);
    const unknown = tokens.filter(t => !t.known).map(t => escapeHtml(S.t('quoted', { w: t.text })));
    const verdict = p > 0.6 ? S.t('verdictPosHtml') : p < 0.4 ? S.t('verdictNegHtml') : S.t('verdictNeutralHtml');
    return {
      tokens,
      dims: DIMS,
      embeddings,
      pooled,
      hidden: [
        { label: S.t('hidden.pos'), value: hPos, note: S.h('hiddenPosNote') },
        { label: S.t('hidden.neg'), value: hNeg, note: S.h('hiddenNegNote') },
        { label: S.t('hidden.not'), value: hNot, note: S.h('hiddenNotNote') },
      ],
      outputs: [
        { label: S.t('positive'), value: p, note: S.h('outNote', { z: { num: z, d: 2 } }) },
        { label: S.t('negative'), value: 1 - p },
      ],
      html: `
        <p>${S.t('resultHtml', { verdict, p: Math.round(p * 100), words: S.t('wordsCount', { n: tokens.length }), pos: { num: pos, d: 2 }, neg: { num: neg, d: 2 } })}</p>
        ${unknown.length ? `<p class="muted small">${S.t('unknownHtml', { list: unknown.join(', ') })}</p>` : ''}
        ${not > 0 ? `<p class="small">${S.t('notNoteHtml')}</p>` : ''}`,
    };
  },

  vocabularyHtml: () => vocabularyTable(lexicon(), dims(), { limit: 200 }),

  intro: () => {
    const n = Object.keys(lexicon()).length;
    return S.t('introHtml', { n, words: S.t('baseWords', { n }) });
  },

  sections: [{ title: S('realTitle'), open: false, html: S('realHtml') }],
};
