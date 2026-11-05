// Max-пулинг: уменьшает карты признаков, оставляя максимум в каждом окне.
import { L } from '../../i18n/i18n.js';

export default {
  id: 'pool',
  title: L('blk.pool.title'),
  group: 'model',
  info: L('blk.pool.info'),
  inputs: [{ id: 'model', title: L('blk.port.model'), types: ['model'] }],
  outputs: [{ id: 'model', title: L('blk.port.model'), type: 'model' }],
  params: [{ id: 'size', title: L('blk.pool.p.size'), kind: 'select', options: [[2, '2 × 2'], [3, '3 × 3']], default: 2 }],
  summary: p => `${p.size}×${p.size}`,
  run({ inputs, params: p }) {
    return { outputs: { model: { spec: [...inputs.model.spec, { type: 'pool', size: Number(p.size) }] } } };
  },
};
