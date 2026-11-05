// Свёрточный слой 2D (без дополнения краёв, шаг 1) — для датасетов картинок.
import { L } from '../../i18n/i18n.js';

export default {
  id: 'conv',
  title: L('blk.conv.title'),
  group: 'model',
  info: L('blk.conv.info'),
  inputs: [{ id: 'model', title: L('blk.port.model'), types: ['model'], optional: true }],
  outputs: [{ id: 'model', title: L('blk.port.model'), type: 'model' }],
  params: [
    { id: 'filters', title: L('blk.conv.p.filters'), kind: 'number', min: 1, max: 16, step: 1, int: true, default: 4 },
    { id: 'kernel', title: L('blk.conv.p.kernel'), kind: 'select', options: [[3, '3 × 3'], [5, '5 × 5']], default: 3 },
    { id: 'activation', title: L('blk.p.activation'), kind: 'select', options: [['relu', 'ReLU'], ['tanh', 'tanh'], ['linear', L('blk.opt.linear')]], default: 'relu' },
  ],
  summary: p => `${p.filters} × ${p.kernel}×${p.kernel} · ${p.activation}`,
  run({ inputs, params: p }) {
    return { outputs: { model: { spec: [...(inputs.model?.spec ?? []), { type: 'conv', filters: p.filters, kernel: Number(p.kernel), activation: p.activation }] } } };
  },
};
