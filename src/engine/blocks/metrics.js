// Метрики обученной модели: точность и потеря на обучении и тесте.
import { numbers, fmt } from '../graph/view.js';

const pct = v => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)} %`);

export default {
  id: 'metrics',
  title: 'Метрики',
  group: 'result',
  info: 'Точность (доля верных ответов) и потеря на обучающей и тестовой выборках после последней эпохи.',
  inputs: [{ id: 'trained', title: 'Обученная', types: ['trained'] }],
  outputs: [],
  params: [],
  run({ inputs }) {
    const t = inputs.trained, last = t.history.at(-1);
    const pairs = t.task === 'class'
      ? [['Точность на тесте', pct(t.final.acc)], ['Точность на обучении', pct(last.trainAcc)], ['Потеря на тесте', fmt(t.final.loss)], ['Потеря на обучении', fmt(last.trainLoss)]]
      : [['MSE на тесте', fmt(t.final.loss)], ['MSE на обучении', fmt(last.trainLoss)], ['RMSE на тесте', fmt(Math.sqrt(t.final.loss))], ['Примеров в тесте', String(t.test.X.length)]];
    return { view: numbers(pairs) };
  },
};
