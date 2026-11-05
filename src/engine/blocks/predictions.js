// Предсказания на тестовой выборке таблицей.
import { table } from '../graph/view.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'predictions',
  title: L('blk.predictions.title'),
  group: 'result',
  info: L('blk.predictions.info'),
  inputs: [{ id: 'trained', title: L('blk.port.trained'), types: ['trained'] }],
  outputs: [],
  params: [{ id: 'rows', title: L('blk.p.rows'), kind: 'number', min: 1, max: 200, step: 1, int: true, default: 20 }],
  summary: p => L('blk.rowsSummary', { n: p.rows, rows: String(p.rows) }),
  run({ inputs, params: p }) {
    const t = inputs.trained;
    const showFeats = t.inputShape.length === 1 ? t.featureNames.slice(0, 4) : [];
    const n = Math.min(p.rows, t.test.X.length);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const pr = t.final.preds[i];
      const feats = showFeats.map((_, f) => t.test.X[i][f]);
      if (t.task === 'class') {
        const ok = pr.cls === t.test.y[i];
        rows.push([i + 1, ...feats, t.classes[t.test.y[i]], { text: t.classes[pr.cls], cls: ok ? 'ok' : 'bad' }, L('graph.pct', { v: String(Math.round(pr.conf * 100)) })]);
      } else {
        const truth = t.test.y[i][0];
        rows.push([i + 1, ...feats, truth, pr.value, pr.value - truth]);
      }
    }
    const cols = t.task === 'class'
      ? ['№', ...showFeats, L('blk.predictions.truth'), L('blk.predictions.answer'), L('blk.predictions.conf')]
      : ['№', ...showFeats, L('blk.predictions.truth'), L('blk.predictions.answer'), L('blk.predictions.error')];
    return { view: table(cols, rows) };
  },
};
