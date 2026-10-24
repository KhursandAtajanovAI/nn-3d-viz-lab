// Таблица данных: первые строки и столбцы.
import { table, note } from '../graph/view.js';

export default {
  id: 'table',
  title: 'Таблица',
  group: 'result',
  info: 'Показывает первые строки данных. Столбец-цель отмечен звёздочкой.',
  inputs: [{ id: 'data', title: 'Данные', types: ['data', 'split'] }],
  outputs: [],
  params: [
    { id: 'rows', title: 'Строк', kind: 'number', min: 1, max: 200, step: 1, int: true, default: 15 },
    { id: 'part', title: 'Часть разбиения', kind: 'select', options: [['train', 'Обучение'], ['test', 'Тест']], default: 'train' },
  ],
  summary: p => `${p.rows} строк`,
  run({ inputs, params: p }) {
    const d = inputs.data.train ? inputs.data[p.part] : inputs.data;
    const maxCols = 12;
    const cols = d.columns.slice(0, maxCols);
    const views = [note(`${d.name}: ${d.rows.length} строк × ${d.columns.length} столбцов${d.columns.length > maxCols ? ` (показаны первые ${maxCols})` : ''}`)];
    views.push(table(cols.map(c => (c === d.target ? `${c} ★` : c)), d.rows.slice(0, p.rows).map(r => r.slice(0, maxCols))));
    return { view: views };
  },
};
