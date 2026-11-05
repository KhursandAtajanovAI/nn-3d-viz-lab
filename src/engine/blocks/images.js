// Вывод картинок: примеры из датасета или ответы обученной сети на тестовых картинках.
import { imageCanvas, grid, note } from '../graph/view.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'images',
  title: L('blk.images.title'),
  group: 'result',
  info: L('blk.images.info'),
  inputs: [{ id: 'in', title: L('blk.port.dataOrTrained'), types: ['data', 'split', 'trained'] }],
  outputs: [],
  params: [{ id: 'count', title: L('blk.images.p.count'), kind: 'number', min: 1, max: 100, step: 1, int: true, default: 24 }],
  summary: p => L('blk.images.summary', { n: p.count, count: String(p.count) }),
  run({ inputs, params: p }) {
    const v = inputs.in;
    if (v.net) {
      if (v.inputShape.length !== 3) return { view: note(L('blk.images.notImages')) };
      const [h, w] = v.inputShape;
      const n = Math.min(p.count, v.test.X.length);
      return {
        view: grid(Array.from({ length: n }, (_, i) => {
          const pr = v.final.preds[i], ok = pr.cls === v.test.y[i];
          return imageCanvas(v.test.X[i], w, h, { scale: Math.max(2, Math.round(48 / w)), caption: ok ? v.classes[pr.cls] : L('blk.images.wrong', { answer: v.classes[pr.cls], truth: v.classes[v.test.y[i]] }), cls: ok ? 'ok' : 'bad' });
        })),
      };
    }
    const d = v.train ?? v;
    if (!d.image) return { view: note(L('blk.images.noImageData')) };
    const { width: w, height: h } = d.image;
    const t = d.columns.indexOf(d.target);
    return {
      view: grid(d.rows.slice(0, p.count).map(r => imageCanvas(r.filter((_, c) => c !== t), w, h, { scale: Math.max(2, Math.round(48 / w)), caption: String(r[t] ?? '') }))),
    };
  },
};
