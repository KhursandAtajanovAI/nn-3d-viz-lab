// График потерь (и точности) по эпохам.
import { lineChart, classColor } from '../graph/view.js';

export default {
  id: 'loss-chart',
  title: 'График loss',
  group: 'result',
  info: 'Как менялась потеря по эпохам на обучении и тесте. Если тест растёт, а обучение падает — переобучение.',
  inputs: [{ id: 'trained', title: 'Обученная', types: ['trained'] }],
  outputs: [],
  params: [{ id: 'showAcc', title: 'Показать и точность', kind: 'bool', default: true }],
  run({ inputs, params: p }) {
    const h = inputs.trained.history;
    const views = [lineChart([
      { name: 'loss (обучение)', values: h.map(e => e.trainLoss), color: classColor(0) },
      { name: 'loss (тест)', values: h.map(e => e.testLoss), color: classColor(1) },
    ], { yLabel: 'loss' })];
    if (p.showAcc && inputs.trained.task === 'class') {
      views.push(lineChart([
        { name: 'точность (обучение)', values: h.map(e => e.trainAcc), color: classColor(0) },
        { name: 'точность (тест)', values: h.map(e => e.testAcc), color: classColor(1) },
      ], { yLabel: 'точность' }));
    }
    return { view: views };
  },
};
