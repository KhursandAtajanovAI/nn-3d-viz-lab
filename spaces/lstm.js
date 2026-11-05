// RNN / LSTM: сеть с памятью читает отзыв слово за словом. Ворота забывания и отрицание видны по шагам.
import { tokenize, sigmoid, vocabularyTable, lookupForm } from '../src/engine/models/text.js';
import { scope, lang } from '../src/i18n/i18n.js';

// Тексты и слова модели — в словарях src/i18n/<язык>/spaces/lstm.js (sp.lstm.w.<id>: слово на языке; пусто — слова нет).
const S = scope('sp.lstm');

// [тональность −1..1, это отрицание?, это противопоставление?]
const VEC = {
  excellent: [1, 0, 0],
  great: [1, 0, 0],
  good: [0.8, 0, 0],
  nice: [0.8, 0, 0],
  lovely: [1, 0, 0],
  interesting: [0.7, 0, 0],
  interestingAdv: [0.7, 0, 0],
  like: [0.8, 0, 0],
  enjoyed: [0.8, 0, 0],
  love: [0.9, 0, 0],
  recommend: [0.9, 0, 0],
  funny: [0.6, 0, 0],
  beautiful: [0.7, 0, 0],
  kind: [0.7, 0, 0],
  bad: [-0.8, 0, 0],
  poor: [-0.8, 0, 0],
  terrible: [-1, 0, 0],
  awful: [-1, 0, 0],
  boring: [-0.7, 0, 0],
  dull: [-0.7, 0, 0],
  longAdv: [-0.5, 0, 0],
  silly: [-0.7, 0, 0],
  dragging: [-0.6, 0, 0],
  sluggish: [-0.5, 0, 0],
  hate: [-0.9, 0, 0],
  not: [0, 1, 0],
  no: [0, 1, 0],
  never: [0, 1, 0],
  but: [0, 0, 1],
  however: [0, 0, 1],
  yet: [0, 0, 1],
  taxi: [0, 0, 0],
  drove: [0, 0, 0],
  driver: [0, 0, 0],
  movie: [0, 0, 0],
  book: [0, 0, 0],
  actors: [0, 0, 0],
  plot: [0, 0, 0],
  ending: [0, 0, 0],
  first: [0, 0, 0],
  then: [0, 0, 0],
  was: [0, 0, 0],
  were: [0, 0, 0],
  totally: [0, 0, 0],
  very: [0, 0, 0],
  me: [0, 0, 0],
  i: [0, 0, 0],
  and: [0, 0, 0],
  dont: [0, 1, 0],
  doesnt: [0, 1, 0],
  isnt: [0, 1, 0],
  wasnt: [0, 1, 0],
  the: [0, 0, 0],
  a: [0, 0, 0],
  is: [0, 0, 0],
  are: [0, 0, 0],
  it: [0, 0, 0],
  at: [0, 0, 0],
};

const dims = () => [0, 1, 2].map(k => S.t(`dims.${k}`));

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
    id: 'lstm',
    title: S('title'),
    category: 'nlp',
    order: 30,
    level: 2,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['NLP', 'RNN', 'LSTM', 'memory', 'sequences'],
    preview: { tokens: S.list('prev', 3) },
  },

  type: 'tokens',
  mode: 'rnn',
  runLabel: S('runLabel'),
  resultTitle: S('resultTitle'),
  presets: S.list('presets', 6),

  process(text) {
    const V = lexicon();
    const DIMS = dims();
    const words = tokenize(text);
    const base = words.map(w => lookupForm(V, w));
    const tokens = words.map((w, i) => ({ text: w, known: !!base[i] }));
    const embeddings = base.map(b => (b ? V[b] : [0, 0, 0]));
    let c = 0, m = 0;
    const steps = embeddings.map(([s, n, b], i) => {
      // LSTM-подобная ячейка, веса заданы вручную:
      const f = sigmoid(-7 * b + 3.5);                // забывание: на «но» почти 0 — память стирается
      const inp = sigmoid(7 * Math.abs(s) - 3.5);     // запись: открыта только для оценочных слов
      const g = Math.tanh(2.5 * s * (1 - 2 * m));     // что записать: знак переворачивается, если помним «не»
      c = f * c + inp * g;
      const prevM = m;
      // «не» запоминается до ближайшего оценочного слова. В русском «никогда не», «совсем не» — одно отрицание, а не двойное
      m = n > 0.5 ? 1 : Math.abs(s) > 0.3 ? 0 : m * f;
      let note = '';
      if (b > 0.5) note = S.h('noteBut');
      else if (n > 0.5) note = S.h(prevM > 0.5 ? 'noteNot2' : 'noteNot');
      else if (Math.abs(s) > 0.3) note = prevM > 0.5 ? S.h('noteFlipped', { g: { num: g, d: 2 } }) : S.h('noteValue');
      else note = S.h('noteNeutral');
      return { h: [Math.tanh(c), m], c: [c], gates: { f, i: inp, o: 1, g }, note };
    });
    const hT = steps.at(-1)?.h[0] ?? 0;
    const p = sigmoid(4 * hT);
    const verdict = p > 0.6 ? S.t('verdictPosHtml') : p < 0.4 ? S.t('verdictNegHtml') : S.t('verdictNeutralHtml');
    return {
      tokens, dims: DIMS, embeddings, steps,
      stateDims: [S.t('state.0'), S.t('state.1')],
      outputs: [
        { label: S.t('positive'), value: p, note: S.h('outNote', { h: { num: hT, d: 3 } }) },
        { label: S.t('negative'), value: 1 - p },
      ],
      html: `<p>${S.t('resultHtml', { verdict, p: Math.round(p * 100), words: S.t('wordsCount', { n: tokens.length }) })}</p>
        <p class="small muted">${S.t('hoverNoteHtml')}</p>`,
    };
  },

  vocabularyHtml: () => vocabularyTable(lexicon(), dims(), { limit: 200 }),

  intro: S('introHtml'),

  sections: [{ title: S('formulasTitle'), open: false, html: S('formulasHtml') }],
};
