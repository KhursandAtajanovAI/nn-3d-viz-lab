// Полносвязный слой: добавляется в конец модели.
import { L } from '../../i18n/i18n.js';

export default {
  id: 'dense',
  title: L('blk.dense.title'),
  group: 'model',
  info: L('blk.dense.info'),
  inputs: [{ id: 'model', title: L('blk.port.model'), types: ['model'], optional: true }],
  outputs: [{ id: 'model', title: L('blk.port.model'), type: 'model' }],
  params: [
    { id: 'units', title: L('blk.dense.p.units'), kind: 'number', min: 1, max: 256, step: 1, int: true, default: 16 },
    { id: 'activation', title: L('blk.p.activation'), kind: 'select', options: [['relu', 'ReLU'], ['tanh', 'tanh'], ['sigmoid', 'sigmoid'], ['softmax', 'softmax'], ['linear', L('blk.opt.linear')]], default: 'relu' },
  ],
  summary: p => `${p.units} · ${p.activation}`,
  run({ inputs, params: p }) {
    return { outputs: { model: { spec: [...(inputs.model?.spec ?? []), { type: 'dense', units: p.units, activation: p.activation }] } } };
  },
};
