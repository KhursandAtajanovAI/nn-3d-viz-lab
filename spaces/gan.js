// GAN: генератор рисует подделки, дискриминатор учится их отличать. Качество подделок растёт с эпохами.
// Тексты — в словарях src/i18n/<язык>/spaces/gan.js.
import { generateDigit } from '../src/engine/models/generators.js';
import { noiseImage, blendImages, blurImage, demoActivations } from '../src/engine/models/libraryHelpers.js';
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.gan');

const STAGES = [
  { name: S('stage.0'), q: 0, d: 0.03 },
  { name: S('stage.1'), q: 0.3, d: 0.12 },
  { name: S('stage.2'), q: 0.65, d: 0.31 },
  { name: S('stage.3'), q: 0.93, d: 0.47 },
];

export default {
  meta: {
    id: 'gan',
    title: S('title'),
    category: 'library',
    order: 70,
    level: 3,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['GAN', 'generation', 'DCGAN', 'unsupervised'],
    preview: { blocks: [[0.3, 0.1], [0.3, 0.5], [0.55, 0.4], [1, 0.1], [0.55, 0.4], [0.3, 0.5], [0.15, 0.1]] },
  },

  type: 'stack',
  layers: [
    { name: S('l.noise'), kind: 'noise', shape: [100], note: S('n.noise') },
    { name: 'G: dense + reshape', kind: 'dense', shape: [7, 7, 128], params: 633472 },
    { name: S('l.deconv'), kind: 'deconv', kernel: 4, shape: [14, 14, 64], params: 131136 },
    { name: S('l.fake'), kind: 'deconv', kernel: 4, shape: [28, 28, 1], maps: true, slices: 1, params: 1025, note: S('n.fake') },
    { name: S('l.conv'), kind: 'conv', kernel: 4, shape: [14, 14, 64], params: 1088 },
    { name: S('l.conv'), kind: 'conv', kernel: 4, shape: [7, 7, 128], params: 131200 },
    { name: S('l.real'), kind: 'output', shape: [1], params: 6273, note: S('n.real') },
  ],
  groups: [
    { from: 0, to: 3, label: S('groupG'), color: 0xff9f1c },
    { from: 4, to: 6, label: S('groupD'), color: 0x2f9bff },
  ],
  outputNames: [S('outName')],
  resultClasses: S.list('classes', 2),
  inputs: STAGES.map(s => ({ name: s.name })),

  demo(img, { preset, rnd }) {
    const st = STAGES.find(s => s.name === preset?.name) ?? STAGES[0];
    const digit = blurImage(generateDigit(Math.floor(rnd() * 10), rnd), st.q > 0.8 ? 0 : 1);
    const fake = blendImages(noiseImage(28, 28, rnd), digit, st.q);
    const p = Math.min(0.5, st.d + (rnd() - 0.5) * 0.04);
    const z = Array.from({ length: 12 }, () => (rnd() - 0.5) * 2);
    return { maps: { 3: fake }, vectors: { 0: z, 6: [p] }, probs: [p, 1 - p], stage: st };
  },

  explainResult(result) {
    const p = result.probs[0];
    return `<p>${S.h('explainHtml', { p: Math.round(p * 100) })}
      ${S.h(p < 0.2 ? 'easy' : p < 0.4 ? 'unsure' : 'fooled')}</p>`;
  },

  intro: S('introHtml'),

  sections: [{ title: S('howTitle'), open: false, html: S('howHtml') }],
};
