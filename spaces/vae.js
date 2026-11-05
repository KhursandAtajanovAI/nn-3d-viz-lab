// Вариационный автоэнкодер (VAE): сжимает картинку не в точку, а в распределение, из которого можно генерировать новое.
// Тексты — в словарях src/i18n/<язык>/spaces/vae.js.
import { generateDigit, DIGIT_CLASSES } from '../src/engine/models/generators.js';
import { blurImage, demoActivations } from '../src/engine/models/libraryHelpers.js';
import { scope, fmtNum } from '../src/i18n/i18n.js';

const S = scope('sp.vae');

// Условные «центры» цифр в двумерном латентном пространстве
const CENTERS = [[-1.6, 0.4], [1.8, 1.2], [-0.3, -1.5], [0.6, -0.8], [1.4, -1.6], [-0.9, -0.4], [-1.5, 1.4], [2, 0.1], [0.1, 0.4], [0.9, 1.6]];

const vec = a => a.map(v => fmtNum(v, 2)).join('; ');

export default {
  meta: {
    id: 'vae',
    title: S('title'),
    category: 'library',
    order: 80,
    level: 3,
    fidelity: 'demo',
    fidelityNote: S('fidelityNote'),
    summary: S('summary'),
    uses: S('uses'),
    tags: ['VAE', 'autoencoder', 'generation', 'latent-space'],
    preview: { blocks: [[1, 0.1], [0.55, 0.3], [0.3, 0.5], [0.4, 0.12], [0.2, 0.12], [0.15, 0.12], [0.3, 0.5], [0.55, 0.3], [1, 0.1]] },
  },

  type: 'stack',
  layers: [
    { name: S('l.input'), kind: 'input', shape: [28, 28, 1], maps: true, slices: 1 },
    { name: S('l.conv'), kind: 'conv', kernel: 3, shape: [14, 14, 32], params: 320 },
    { name: S('l.conv'), kind: 'conv', kernel: 3, shape: [7, 7, 64], params: 18496 },
    { name: 'Dense', kind: 'dense', shape: [16], params: 50192 },
    { name: S('l.musigma'), kind: 'latent', shape: [4], params: 68, note: S('n.musigma') },
    { name: 'z = μ + σ·ε', kind: 'sample', shape: [2], note: S('n.z') },
    { name: 'Dense + reshape', kind: 'dense', shape: [7, 7, 64], params: 9408 },
    { name: S('l.deconv'), kind: 'deconv', kernel: 3, shape: [14, 14, 32], params: 18464 },
    { name: S('l.recon'), kind: 'deconv', kernel: 3, shape: [28, 28, 1], maps: true, slices: 1, params: 289 },
  ],
  totalParams: 97237,
  groups: [
    { from: 0, to: 4, label: S('groupEnc'), color: 0xff9f1c },
    { from: 5, to: 8, label: S('groupDec'), color: 0x2f9bff },
  ],
  input: { kind: 'image', size: 28, channels: 1, classes: DIGIT_CLASSES, generate: generateDigit },

  demo(img, { sample, rnd }) {
    const c = CENTERS[sample?.label ?? 0];
    const mu = c.map(v => v + (rnd() - 0.5) * 0.3);
    const sigma = [0.15 + rnd() * 0.15, 0.15 + rnd() * 0.15];
    const z = mu.map((m, i) => m + sigma[i] * (rnd() * 2 - 1));
    return { maps: { 8: blurImage(img, 1) }, vectors: { 3: demoActivations(rnd, 12), 4: [...mu, ...sigma], 5: z }, probs: [], mu, sigma, z };
  },

  explainResult(r) {
    return S.h('explainHtml', { mu: vec(r.mu), sigma: vec(r.sigma), z: vec(r.z) });
  },

  intro: S('introHtml'),
};
