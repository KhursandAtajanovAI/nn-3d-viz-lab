// Таблица данных: первые строки и столбцы.
import { table, note } from '../graph/view.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'table',
  title: L('blk.table.title'),
  group: 'result',
  info: L('blk.table.info'),
  inputs: [{ id: 'data', title: L('blk.port.data'), types: ['data', 'split'] }],
  outputs: [],
  params: [
    { id: 'rows', title: L('blk.p.rows'), kind: 'number', min: 1, max: 200, step: 1, int: true, default: 15 },
    { id: 'part', title: L('blk.table.p.part'), kind: 'select', options: [['train', L('blk.table.train')], ['test', L('blk.table.test')]], default: 'train' },
  ],
  summary: p => L('blk.rowsSummary', { n: p.rows, rows: String(p.rows) }),
  run({ inputs, params: p }) {
    const d = inputs.data.train ? inputs.data[p.part] : inputs.data;
    const maxCols = 12;
    const cols = d.columns.slice(0, maxCols);
    const more = d.columns.length > maxCols ? L('blk.table.first', { n: String(maxCols) }) : '';
    const views = [note(L('blk.table.head', { name: d.name, rows: String(d.rows.length), cols: String(d.columns.length), more }))];
    views.push(table(cols.map(c => (c === d.target ? `${c} ★` : c)), d.rows.slice(0, p.rows).map(r => r.slice(0, maxCols))));
    return { view: views };
  },
};
