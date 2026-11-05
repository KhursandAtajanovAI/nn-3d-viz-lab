// Нормализация числовых признаков. Если на входе разбиение — статистика считается по обучающей части.
import { normalize } from '../graph/data.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'normalize',
  title: L('blk.normalize.title'),
  group: 'prep',
  info: L('blk.normalize.info'),
  inputs: [{ id: 'in', title: L('blk.port.data'), types: ['data', 'split'] }],
  outputs: [{ id: 'out', title: L('blk.port.data'), type: 'same:in' }],
  params: [
    { id: 'method', title: L('blk.normalize.p.method'), kind: 'select', options: [['minmax', L('blk.normalize.minmax')], ['zscore', L('blk.normalize.zscore')]], default: 'minmax' },
  ],
  summary: p => L(p.method === 'zscore' ? 'blk.normalize.zscoreShort' : 'blk.normalize.minmaxShort'),
  run({ inputs, params: p }) {
    const d = inputs.in;
    if (d.train) return { outputs: { out: { train: normalize(d.train, p.method), test: normalize(d.test, p.method, d.train) } } };
    return { outputs: { out: normalize(d, p.method) } };
  },
};
