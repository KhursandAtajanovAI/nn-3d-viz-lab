// BERT (2018): энкодер трансформера, читающий текст в обе стороны; учится угадывать закрытые слова.
// Тексты — в словарях src/i18n/<язык>/spaces/bert.js (там же предложения и варианты слова).
import { tokensIn, embedding, positions, block } from '../src/engine/models/transformerLayers.js';
import { demoActivations } from '../src/engine/models/libraryHelpers.js';
import { scope, str } from '../src/i18n/i18n.js';

const S = scope('sp.bert');

const N = 10, D = 768;
const blocks = block({ n: N, d: D, heads: 12, repeat: 12 });
const layers = [
  tokensIn(N, S('n.tokens')),
  embedding(N, D, 30522),
  positions(N, D),
  ...blocks,
  { name: S('l.out'), kind: 'output', shape: [30522], params: D * D + 30522, note: S('n.out') },
];

// Вероятности вариантов; сами предложения и слова — ex.<i>.name и ex.<i>.c.<k> в словаре
const PROBS = [[0.9, 0.05, 0.02, 0.01, 0.01], [0.61, 0.27, 0.07, 0.02, 0.01], [0.58, 0.36, 0.03, 0.01, 0.01]];
const EXAMPLES = PROBS.map((ps, i) => ({ name: S(`ex.${i}.name`), cands: ps.map((p, k) => [S(`ex.${i}.c.${k}`), p]) }));

export default {
  meta: {
    id: 'bert',
    title: S('title'),
    category: 'library',
    order: 120,
    level: 3,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['NLP', 'BERT', 'Transformer', 'text-understanding', 'embeddings'],
    preview: { tokens: S.list('preview', 5) },
  },

  type: 'stack',
  layers,
  totalParams: 110000000,
  paramsNote: S('paramsNote'),
  groups: [{ from: 3, to: 3 + blocks.length - 1, label: S('group'), color: 0xff6fa3 }],
  inputs: EXAMPLES.map(e => ({ name: e.name })),
  resultClasses: EXAMPLES[0].cands.map(c => c[0]),

  demo(img, { preset, rnd }) {
    const ex = EXAMPLES.find(e => e.name === preset?.name) ?? EXAMPLES[0];
    return { classes: ex.cands.map(c => c[0]), probs: ex.cands.map(c => c[1]), vectors: { 0: demoActivations(rnd, 10), [layers.length - 1]: ex.cands.map(c => c[1]) }, example: ex };
  },

  explainResult(r) {
    const [[w1, p1], [w2, p2]] = r.example.cands;
    return S.h('explainHtml', { w1: str(w1), p1: Math.round(p1 * 100), w2: str(w2), p2: Math.round(p2 * 100) });
  },

  intro: S('introHtml'),
};
