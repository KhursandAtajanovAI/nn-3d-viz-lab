// Нормализация числовых признаков. Если на входе разбиение — статистика считается по обучающей части.
import { normalize } from '../graph/data.js';

export default {
  id: 'normalize',
  title: 'Нормализация',
  group: 'prep',
  info: 'Приводит признаки к одному масштабу: min-max (0…1) или z-оценка (среднее 0, разброс 1). Цель не меняется.',
  inputs: [{ id: 'in', title: 'Данные', types: ['data', 'split'] }],
  outputs: [{ id: 'out', title: 'Данные', type: 'same:in' }],
  params: [
    { id: 'method', title: 'Способ', kind: 'select', options: [['minmax', 'Min-max (0…1)'], ['zscore', 'Z-оценка']], default: 'minmax' },
  ],
  summary: p => (p.method === 'zscore' ? 'z-оценка' : 'min-max'),
  run({ inputs, params: p }) {
    const d = inputs.in;
    if (d.train) return { outputs: { out: { train: normalize(d.train, p.method), test: normalize(d.test, p.method, d.train) } } };
    return { outputs: { out: normalize(d, p.method) } };
  },
};
