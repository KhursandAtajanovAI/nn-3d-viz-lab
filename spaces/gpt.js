// GPT (на примере GPT-2 small): только декодер трансформера, предсказывает следующий токен.
// Тексты — в словарях src/i18n/<язык>/spaces/gpt.js (там же начала текстов и варианты продолжения).
import { tokensIn, embedding, positions, block } from '../src/engine/models/transformerLayers.js';
import { demoActivations } from '../src/engine/models/libraryHelpers.js';
import { scope, str } from '../src/i18n/i18n.js';

const S = scope('sp.gpt');

const N = 10, D = 768;
const blocks = block({ n: N, d: D, heads: 12, repeat: 12, masked: true });
const layers = [
  tokensIn(N),
  embedding(N, D, 50257),
  positions(N, D),
  ...blocks,
  { name: S('l.norm'), kind: 'norm', shape: [N, D], params: 2 * D },
  { name: S('l.out'), kind: 'output', shape: [50257], params: 0, note: S('n.out') },
];

// Вероятности вариантов; сами тексты и слова — ex.<i>.name и ex.<i>.c.<k> в словаре
const PROBS = [[0.74, 0.09, 0.05, 0.04, 0.03], [0.86, 0.06, 0.03, 0.02, 0.01], [0.82, 0.05, 0.04, 0.03, 0.02]];
const EXAMPLES = PROBS.map((ps, i) => ({ name: S(`ex.${i}.name`), cands: ps.map((p, k) => [S(`ex.${i}.c.${k}`), p]) }));

export default {
  meta: {
    id: 'gpt',
    title: S('title'),
    category: 'library',
    order: 110,
    level: 3,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['NLP', 'GPT', 'Transformer', 'text-generation', 'LLM'],
    preview: { tokens: S.list('preview', 4) },
  },

  type: 'stack',
  layers,
  totalParams: 124439808,
  paramsNote: S('paramsNote'),
  groups: [{ from: 3, to: 3 + blocks.length - 1, label: S('group'), color: 0xff6fa3 }],
  inputs: EXAMPLES.map(e => ({ name: e.name })),
  resultClasses: EXAMPLES[0].cands.map(c => c[0]),

  demo(img, { preset, rnd }) {
    const ex = EXAMPLES.find(e => e.name === preset?.name) ?? EXAMPLES[0];
    return { classes: ex.cands.map(c => c[0]), probs: ex.cands.map(c => c[1]), vectors: { 0: demoActivations(rnd, 10), [layers.length - 1]: ex.cands.map(c => c[1]) }, example: ex };
  },

  explainResult(r) {
    return S.h('explainHtml', { word: str(r.example.cands[0][0]), p: Math.round(r.example.cands[0][1] * 100) });
  },

  intro: S('introHtml'),

  sections: [{ title: S('chatTitle'), open: false, html: S('chatHtml') }],
};
