// Отдельная функция активации (если слою она не задана).
import { L } from '../../i18n/i18n.js';

export default {
  id: 'activation',
  title: L('blk.activation.title'),
  group: 'model',
  info: L('blk.activation.info'),
  inputs: [{ id: 'model', title: L('blk.port.model'), types: ['model'] }],
  outputs: [{ id: 'model', title: L('blk.port.model'), type: 'model' }],
  params: [
    { id: 'fn', title: L('blk.activation.p.fn'), kind: 'select', options: [['relu', 'ReLU'], ['tanh', 'tanh'], ['sigmoid', 'sigmoid'], ['softmax', 'softmax']], default: 'relu' },
  ],
  summary: p => p.fn,
  run({ inputs, params: p }) {
    return { outputs: { model: { spec: [...inputs.model.spec, { type: 'activation', fn: p.fn }] } } };
  },
};
