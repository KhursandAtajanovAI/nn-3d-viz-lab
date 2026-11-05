// U-Net (2015): сегментация — для каждого пикселя сказать, что на нём. Энкодер, декодер и «мостики» между ними.
// Тексты — в словарях src/i18n/<язык>/spaces/unet.js.
import { blurImage } from '../src/engine/models/libraryHelpers.js';
import { scope } from '../src/i18n/i18n.js';

const T = scope('sp.unet');
const S = 64;

/** Синтетический «микроскопный снимок»: светлые клетки на шумном тёмном фоне */
function cells(cls, rnd) {
  const n = cls === 0 ? 3 + Math.floor(rnd() * 3) : 8 + Math.floor(rnd() * 5);
  const blobs = Array.from({ length: n }, () => ({ x: 6 + rnd() * (S - 12), y: 6 + rnd() * (S - 12), r: 3 + rnd() * 5, b: 0.55 + rnd() * 0.4 }));
  const data = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0.12 + rnd() * 0.12;
    for (const c of blobs) {
      const d = Math.hypot(x - c.x, y - c.y) / c.r;
      if (d < 1.25) v = Math.max(v, c.b * Math.min(1, 1.25 - d) * 1.6 * (0.85 + rnd() * 0.15));
    }
    data[y * S + x] = Math.min(1, v);
  }
  return { w: S, h: S, c: 1, data };
}

/** Маска: сглаживание + порог — «правильная» разметка, которую U-Net учится воспроизводить */
function mask(img) {
  const b = blurImage(img, 2);
  const mean = b.data.reduce((a, v) => a + v, 0) / b.data.length;
  return { w: S, h: S, data: b.data.map(v => (v > mean + 0.12 ? 1 : 0)) };
}

export default {
  meta: {
    id: 'unet',
    title: T('title'),
    category: 'library',
    order: 60,
    level: 3,
    fidelity: 'demo',
    fidelityNote: T('fidelityNote'),
    summary: T('summary'),
    uses: T('uses'),
    tags: ['CNN', 'U-Net', 'segmentation', 'medicine', 'encoder-decoder'],
    preview: { blocks: [[1, 0.2], [1, 0.3], [0.6, 0.45], [0.35, 0.6], [0.2, 0.8], [0.35, 0.6], [0.6, 0.45], [1, 0.3], [1, 0.15]], skips: [[1, 7], [2, 6], [3, 5]] },
  },

  type: 'stack',
  layers: [
    { name: T('l.input'), kind: 'input', shape: [64, 64, 1], maps: true, slices: 1, note: T('n.input') },
    { name: T('l.enc', { n: 1 }), kind: 'conv', repeat: 2, shape: [64, 64, 32], params: 9568 },
    { name: T('l.enc', { n: 2 }), kind: 'conv', repeat: 2, shape: [32, 32, 64], params: 55424, note: T('n.enc2') },
    { name: T('l.enc', { n: 3 }), kind: 'conv', repeat: 2, shape: [16, 16, 128], params: 221440 },
    { name: T('l.bottom'), kind: 'conv', repeat: 2, shape: [8, 8, 256], params: 885248, note: T('n.bottom') },
    { name: T('l.dec', { n: 3 }), kind: 'deconv', repeat: 2, shape: [16, 16, 128], params: 573824, note: T('n.dec3') },
    { name: T('l.dec', { n: 2 }), kind: 'deconv', repeat: 2, shape: [32, 32, 64], params: 143552 },
    { name: T('l.dec', { n: 1 }), kind: 'deconv', repeat: 2, shape: [64, 64, 32], params: 35936 },
    { name: T('l.mask'), kind: 'output', shape: [64, 64, 1], maps: true, slices: 1, params: 33, note: T('n.mask') },
  ],
  totalParams: 1925025,
  skips: [
    { from: 1, to: 7, label: T('skipDetails') },
    { from: 2, to: 6, label: T('skip') },
    { from: 3, to: 5, label: T('skip') },
  ],
  groups: [
    { from: 0, to: 4, label: T('groupEnc'), color: 0xff9f1c },
    { from: 5, to: 8, label: T('groupDec'), color: 0x2f9bff },
  ],
  input: { kind: 'image', size: 64, channels: 1, classes: T.list('classes', 2), generate: cells },

  demo(img) {
    const m = mask(img);
    const share = m.data.reduce((a, v) => a + v, 0) / m.data.length;
    return { maps: { 8: [m] }, probs: [], share };
  },

  explainResult(result) {
    return T.h('explainHtml', { p: Math.round(result.share * 100) });
  },

  intro: T('introHtml'),

  sections: [{ title: T('whyTitle'), open: false, html: T('whyHtml') }],
};
