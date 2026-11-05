// Разбиение на обучающую и тестовую выборки.
import { split } from '../graph/data.js';
import { fail } from '../graph/fail.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'split',
  title: L('blk.split.title'),
  group: 'prep',
  info: L('blk.split.info'),
  inputs: [{ id: 'data', title: L('blk.port.data'), types: ['data'] }],
  outputs: [{ id: 'split', title: L('blk.port.split'), type: 'split' }],
  params: [
    { id: 'test', title: L('blk.split.p.test'), kind: 'number', min: 0.05, max: 0.9, step: 0.05, default: 0.25 },
    { id: 'seed', title: L('blk.p.seed'), kind: 'number', min: 1, max: 99999, step: 1, int: true, default: 1 },
  ],
  summary: p => L('blk.split.summary', { p: String(Math.round(p.test * 100)) }),
  run({ inputs, params: p }) {
    if (inputs.data.rows.length < 4) throw fail('blk.split.err.tooFew');
    return { outputs: { split: split(inputs.data, p.test, p.seed) } };
  },
};
