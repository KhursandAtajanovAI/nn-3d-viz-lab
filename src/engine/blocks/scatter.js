// Диаграмма рассеяния двух признаков; после обучения — с областями решений сети.
import { scatter, note } from '../graph/view.js';
import { isNumericColumn, toXY } from '../graph/data.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'scatter',
  title: L('blk.scatter.title'),
  group: 'result',
  info: L('blk.scatter.info'),
  inputs: [{ id: 'in', title: L('blk.port.dataOrTrained'), types: ['data', 'split', 'trained'] }],
  outputs: [],
  params: [
    { id: 'x', title: L('blk.scatter.p.x'), kind: 'number', min: 1, max: 100, step: 1, int: true, default: 1 },
    { id: 'y', title: L('blk.scatter.p.y'), kind: 'number', min: 1, max: 100, step: 1, int: true, default: 2 },
  ],
  summary: p => L('blk.scatter.summary', { x: String(p.x), y: String(p.y) }),
  run({ inputs, params: p }) {
    const v = inputs.in;
    if (v.net) {
      if (v.inputShape.length !== 1) return { view: note(L('blk.scatter.noImages')) };
      const nf = v.inputShape[0], fx = p.x - 1, fy = p.y - 1;
      if (fx >= nf || fy >= nf) return { view: note(L('blk.scatter.featuresTotal', { n: String(nf) })) };
      const pts = v.test.X.map((x, i) => (v.task === 'class'
        ? { x: x[fx], y: x[fy], c: v.test.y[i], ok: v.final.preds[i].cls === v.test.y[i] }
        : { x: x[fx], y: v.test.y[i][0], c: 0 }));
      let background = null;
      if (v.task === 'class' && nf === 2) {
        const probe = new Float32Array(2);
        background = (a, b) => {
          probe[fx] = a; probe[fy] = b;
          const out = v.net.forward(probe);
          let best = 0;
          for (let k = 1; k < out.length; k++) if (out[k] > out[best]) best = k;
          return best;
        };
      }
      const views = [scatter(pts, { classes: v.classes ?? [], xLabel: v.featureNames[fx], yLabel: v.task === 'class' ? v.featureNames[fy] : L('blk.scatter.target'), background })];
      if (v.task === 'class') views.push(note(L(background ? 'blk.scatter.legendBg' : 'blk.scatter.legend')));
      return { view: views };
    }
    const d = v.train ?? v;
    if (d.image) return { view: note(L('blk.scatter.noImages')) };
    const t = d.columns.indexOf(d.target);
    const feats = d.columns.map((_, c) => c).filter(c => c !== t && isNumericColumn(d, c));
    if (!feats.length) return { view: note(L('blk.scatter.noNumeric')) };
    const cx = feats[Math.min(p.x, feats.length) - 1], cy = feats[Math.min(p.y, feats.length) - 1];
    let classes = [], cls = () => 0;
    try {
      const xy = toXY(d);
      if (xy.task === 'class') {
        classes = xy.classes;
        const idx = new Map(classes.map((c, i) => [c, i]));
        cls = r => idx.get(String(r[t])) ?? 0;
      }
    } catch { /* без цели — одним цветом */ }
    const pts = d.rows.filter(r => Number.isFinite(r[cx]) && Number.isFinite(r[cy])).slice(0, 5000).map(r => ({ x: r[cx], y: r[cy], c: cls(r) }));
    return { view: scatter(pts, { classes, xLabel: d.columns[cx], yLabel: d.columns[cy] }) };
  },
};
