// One-hot: текстовые признаки → столбцы из 0 и 1.
import { oneHot } from '../graph/data.js';
import { note } from '../graph/view.js';

export default {
  id: 'onehot',
  title: 'One-hot',
  group: 'prep',
  info: 'Каждое значение текстового признака становится отдельным столбцом 0/1 («цвет=красный»). Цель не меняется.',
  inputs: [{ id: 'data', title: 'Данные', types: ['data'] }],
  outputs: [{ id: 'data', title: 'Данные', type: 'data' }],
  params: [
    { id: 'max', title: 'Не больше значений на столбец', kind: 'number', min: 2, max: 100, step: 1, int: true, default: 30 },
  ],
  summary: p => `до ${p.max} значений`,
  run({ inputs, params: p }) {
    const { data, expanded } = oneHot(inputs.data, p.max);
    return {
      outputs: { data },
      view: note(expanded.length ? `Развёрнуты столбцы: ${expanded.join(', ')} → всего ${data.columns.length} столбцов` : 'Текстовых признаков нет — данные без изменений'),
    };
  },
};
