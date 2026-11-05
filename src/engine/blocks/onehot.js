// One-hot: текстовые признаки → столбцы из 0 и 1.
import { oneHot } from '../graph/data.js';
import { note } from '../graph/view.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'onehot',
  title: L('blk.onehot.title'),
  group: 'prep',
  info: L('blk.onehot.info'),
  inputs: [{ id: 'data', title: L('blk.port.data'), types: ['data'] }],
  outputs: [{ id: 'data', title: L('blk.port.data'), type: 'data' }],
  params: [
    { id: 'max', title: L('blk.onehot.p.max'), kind: 'number', min: 2, max: 100, step: 1, int: true, default: 30 },
  ],
  summary: p => L('blk.onehot.summary', { n: p.max, max: String(p.max) }),
  run({ inputs, params: p }) {
    const { data, expanded } = oneHot(inputs.data, p.max);
    return {
      outputs: { data },
      view: note(expanded.length ? L('blk.onehot.expanded', { list: expanded.join(', '), n: data.columns.length }) : L('blk.onehot.none')),
    };
  },
};
