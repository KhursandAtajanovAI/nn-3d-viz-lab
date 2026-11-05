// Матрица ошибок на тестовой выборке.
import { table, note } from '../graph/view.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'confusion',
  title: L('blk.confusion.title'),
  group: 'result',
  info: L('blk.confusion.info'),
  inputs: [{ id: 'trained', title: L('blk.port.trained'), types: ['trained'] }],
  outputs: [],
  params: [],
  run({ inputs }) {
    const t = inputs.trained;
    if (t.task !== 'class') return { view: note(L('blk.confusion.onlyClass')) };
    const k = t.classes.length;
    if (k > 20) return { view: note(L('blk.confusion.tooMany', { n: k })) };
    const m = Array.from({ length: k }, () => new Array(k).fill(0));
    t.final.preds.forEach((p, i) => { m[t.test.y[i]][p.cls]++; });
    const max = Math.max(1, ...m.flat());
    const rows = m.map((r, i) => [{ text: t.classes[i], cls: 'head' }, ...r.map((v, j) => ({
      text: String(v),
      cls: 'num',
      bg: v ? `color-mix(in srgb, var(${i === j ? '--ok' : '--error'}) ${Math.round(12 + 50 * v / max)}%, transparent)` : '',
      title: L('blk.confusion.cell', { truth: t.classes[i], answer: t.classes[j], n: String(v) }),
    }))]);
    return { view: table([L('blk.confusion.corner'), ...t.classes], rows) };
  },
};
