// Метрики обученной модели: точность и потеря на обучении и тесте.
import { numbers, numL } from '../graph/view.js';
import { L, num } from '../../i18n/i18n.js';

const pct = v => (v === null || v === undefined ? '—' : L('graph.pct', { v: num(v * 100, 1) }));

export default {
  id: 'metrics',
  title: L('blk.metrics.title'),
  group: 'result',
  info: L('blk.metrics.info'),
  inputs: [{ id: 'trained', title: L('blk.port.trained'), types: ['trained'] }],
  outputs: [],
  params: [],
  run({ inputs }) {
    const t = inputs.trained, last = t.history.at(-1);
    const pairs = t.task === 'class'
      ? [[L('blk.metrics.testAcc'), pct(t.final.acc)], [L('blk.metrics.trainAcc'), pct(last.trainAcc)], [L('blk.metrics.testLoss'), numL(t.final.loss)], [L('blk.metrics.trainLoss'), numL(last.trainLoss)]]
      : [[L('blk.metrics.mseTest'), numL(t.final.loss)], [L('blk.metrics.mseTrain'), numL(last.trainLoss)], [L('blk.metrics.rmseTest'), numL(Math.sqrt(t.final.loss))], [L('blk.metrics.testCount'), String(t.test.X.length)]];
    return { view: numbers(pairs) };
  },
};
