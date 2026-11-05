// Transformer (2017): «Attention is all you need» — энкодер и декодер на внимании, без рекуррентности.
// Тексты — в словарях src/i18n/<язык>/spaces/transformer.js (там же фразы и варианты перевода).
import { tokensIn, embedding, positions, block } from '../src/engine/models/transformerLayers.js';
import { demoActivations } from '../src/engine/models/libraryHelpers.js';
import { scope, str } from '../src/i18n/i18n.js';

const S = scope('sp.transformer');

const N = 8, D = 512;
const encoder = block({ n: N, d: D, heads: 8, repeat: 6 });
const decoder = block({ n: N, d: D, heads: 8, repeat: 6, masked: true, cross: true, label: S('decoderLabel') });
const layers = [
  tokensIn(N, S('n.tokens')),
  embedding(N, D, 37000),
  positions(N, D),
  ...encoder,
  ...decoder,
  { name: 'Linear + softmax', kind: 'output', shape: [37000], params: D * 37000, note: S('n.out') },
];

// Вероятности вариантов; сами фразы и слова — ex.<i>.name и ex.<i>.c.<k> в словаре
const PROBS = [[0.78, 0.09, 0.03, 0.03, 0.02], [0.83, 0.06, 0.04, 0.03, 0.02], [0.91, 0.03, 0.02, 0.01, 0.01]];
const EXAMPLES = PROBS.map((ps, i) => ({ name: S(`ex.${i}.name`), cands: ps.map((p, k) => [S(`ex.${i}.c.${k}`), p]) }));

export default {
  meta: {
    id: 'transformer',
    title: S('title'),
    category: 'library',
    order: 100,
    level: 3,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['NLP', 'Transformer', 'attention', 'translation', 'encoder-decoder'],
    preview: { tokens: S.list('preview', 5) },
  },

  type: 'stack',
  layers,
  totalParams: 65000000,
  paramsNote: S('paramsNote'),
  groups: [
    { from: 3, to: 3 + encoder.length - 1, label: S('groupEnc'), color: 0xff6fa3 },
    { from: 3 + encoder.length, to: 3 + encoder.length + decoder.length - 1, label: S('groupDec'), color: 0xb48cff },
  ],
  skips: [{ from: 3 + encoder.length - 1, to: 3 + encoder.length + 1, label: S('skip') }],
  inputs: EXAMPLES.map(e => ({ name: e.name })),
  resultClasses: EXAMPLES[0].cands.map(c => c[0]),

  demo(img, { preset, rnd }) {
    const ex = EXAMPLES.find(e => e.name === preset?.name) ?? EXAMPLES[0];
    return { classes: ex.cands.map(c => c[0]), probs: ex.cands.map(c => c[1]), vectors: { 0: demoActivations(rnd, 8), [layers.length - 1]: ex.cands.map(c => c[1]) }, example: ex };
  },

  explainResult(r) {
    return S.h('explainHtml', { word: str(r.example.cands[0][0]), p: Math.round(r.example.cands[0][1] * 100) });
  },

  intro: S('introHtml'),
};
