// Карты признаков: что видит каждый фильтр свёртки на одной тестовой картинке.
import { imageCanvas, grid, note } from '../graph/view.js';

export default {
  id: 'feature-maps',
  title: 'Карты признаков',
  group: 'result',
  info: 'Выходы свёрточных слоёв для одной тестовой картинки: оранжевое — фильтр сработал, синее — подавлен.',
  inputs: [{ id: 'trained', title: 'Обученная', types: ['trained'] }],
  outputs: [],
  params: [{ id: 'sample', title: 'Номер тестовой картинки', kind: 'number', min: 1, max: 2000, step: 1, int: true, default: 1 }],
  summary: p => `картинка № ${p.sample}`,
  run({ inputs, params: p }) {
    const t = inputs.trained;
    if (t.inputShape.length !== 3) return { view: note('Карты признаков есть только у моделей для картинок') };
    const i = Math.min(p.sample, t.test.X.length) - 1;
    const x = t.test.X[i];
    const [h, w] = t.inputShape;
    const trace = t.net.trace(x);
    const views = [imageCanvas(x, w, h, { scale: Math.max(2, Math.round(64 / w)), caption: `вход: ${t.classes[t.test.y[i]]}` })];
    let shown = 0;
    trace.forEach((o, k) => {
      if (o.shape.length !== 3) return;
      const next = trace[k + 1]?.layer;
      if (o.layer.type === 'conv' && next?.type === 'activation') return; // показываем уже после активации
      const [oh, ow, c] = o.shape;
      const maps = [];
      for (let f = 0; f < Math.min(c, 16); f++) {
        const vals = new Float32Array(oh * ow);
        for (let q = 0; q < oh * ow; q++) vals[q] = o.values[q * c + f];
        maps.push(imageCanvas(vals, ow, oh, { signed: true, scale: Math.max(2, Math.round(40 / ow)), caption: `ф${f + 1}` }));
      }
      const title = { conv: 'Свёртка', activation: 'Свёртка + активация', pool: 'Пулинг' }[o.layer.type] ?? o.layer.type;
      views.push(note(`${title}: ${oh}×${ow}, карт ${c}`), grid(maps));
      shown++;
    });
    if (!shown) views.push(note('В модели нет свёрточных слоёв'));
    return { view: views };
  },
};
