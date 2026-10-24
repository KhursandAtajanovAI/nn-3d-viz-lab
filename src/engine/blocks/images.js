// Вывод картинок: примеры из датасета или ответы обученной сети на тестовых картинках.
import { imageCanvas, grid, note } from '../graph/view.js';

export default {
  id: 'images',
  title: 'Картинки',
  group: 'result',
  info: 'Сетка картинок с подписями. После обучения — ответ сети: зелёная рамка — верно, красная — ошибка.',
  inputs: [{ id: 'in', title: 'Данные или обученная', types: ['data', 'split', 'trained'] }],
  outputs: [],
  params: [{ id: 'count', title: 'Картинок', kind: 'number', min: 1, max: 100, step: 1, int: true, default: 24 }],
  summary: p => `${p.count} шт.`,
  run({ inputs, params: p }) {
    const v = inputs.in;
    if (v.net) {
      if (v.inputShape.length !== 3) return { view: note('Модель обучена не на картинках') };
      const [h, w] = v.inputShape;
      const n = Math.min(p.count, v.test.X.length);
      return {
        view: grid(Array.from({ length: n }, (_, i) => {
          const pr = v.final.preds[i], ok = pr.cls === v.test.y[i];
          return imageCanvas(v.test.X[i], w, h, { scale: Math.max(2, Math.round(48 / w)), caption: `${v.classes[pr.cls]}${ok ? '' : ` (верно ${v.classes[v.test.y[i]]})`}`, cls: ok ? 'ok' : 'bad' });
        })),
      };
    }
    const d = v.train ?? v;
    if (!d.image) return { view: note('Это не датасет картинок') };
    const { width: w, height: h } = d.image;
    const t = d.columns.indexOf(d.target);
    return {
      view: grid(d.rows.slice(0, p.count).map(r => imageCanvas(r.filter((_, c) => c !== t), w, h, { scale: Math.max(2, Math.round(48 / w)), caption: String(r[t] ?? '') }))),
    };
  },
};
