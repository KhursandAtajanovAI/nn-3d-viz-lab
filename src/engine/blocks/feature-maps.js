// Карты признаков: что видит каждый фильтр свёртки на одной тестовой картинке.
import { imageCanvas, grid, note } from '../graph/view.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'feature-maps',
  title: L('blk.feature-maps.title'),
  group: 'result',
  info: L('blk.feature-maps.info'),
  inputs: [{ id: 'trained', title: L('blk.port.trained'), types: ['trained'] }],
  outputs: [],
  params: [{ id: 'sample', title: L('blk.feature-maps.p.sample'), kind: 'number', min: 1, max: 2000, step: 1, int: true, default: 1 }],
  summary: p => L('blk.feature-maps.summary', { n: String(p.sample) }),
  run({ inputs, params: p }) {
    const t = inputs.trained;
    if (t.inputShape.length !== 3) return { view: note(L('blk.feature-maps.onlyImages')) };
    const i = Math.min(p.sample, t.test.X.length) - 1;
    const x = t.test.X[i];
    const [h, w] = t.inputShape;
    const trace = t.net.trace(x);
    const views = [imageCanvas(x, w, h, { scale: Math.max(2, Math.round(64 / w)), caption: L('blk.feature-maps.input', { cls: t.classes[t.test.y[i]] }) })];
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
        maps.push(imageCanvas(vals, ow, oh, { signed: true, scale: Math.max(2, Math.round(40 / ow)), caption: L('blk.feature-maps.filter', { n: String(f + 1) }) }));
      }
      const kind = { conv: 'conv', activation: 'convAct', pool: 'pool' }[o.layer.type];
      views.push(note(L(kind ? `blk.feature-maps.layer.${kind}` : 'blk.feature-maps.layer.other', { type: o.layer.type, h: String(oh), w: String(ow), c: String(c) })), grid(maps));
      shown++;
    });
    if (!shown) views.push(note(L('blk.feature-maps.noConv')));
    return { view: views };
  },
};
