// Разбиение на обучающую и тестовую выборки.
import { split } from '../graph/data.js';

export default {
  id: 'split',
  title: 'Train / test',
  group: 'prep',
  info: 'Перемешивает строки и откладывает часть для проверки: на тесте видно, как сеть работает на новых данных.',
  inputs: [{ id: 'data', title: 'Данные', types: ['data'] }],
  outputs: [{ id: 'split', title: 'Разбиение', type: 'split' }],
  params: [
    { id: 'test', title: 'Доля теста', kind: 'number', min: 0.05, max: 0.9, step: 0.05, default: 0.25 },
    { id: 'seed', title: 'Зерно случайности', kind: 'number', min: 1, max: 99999, step: 1, int: true, default: 1 },
  ],
  summary: p => `тест ${Math.round(p.test * 100)} %`,
  run({ inputs, params: p }) {
    if (inputs.data.rows.length < 4) throw new Error('Слишком мало строк для разбиения');
    return { outputs: { split: split(inputs.data, p.test, p.seed) } };
  },
};
