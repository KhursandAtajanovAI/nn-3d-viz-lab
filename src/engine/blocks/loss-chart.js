// График потерь (и точности) по эпохам.
import { lineChart, classColor } from '../graph/view.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'loss-chart',
  title: L('blk.loss-chart.title'),
  group: 'result',
  info: L('blk.loss-chart.info'),
  inputs: [{ id: 'trained', title: L('blk.port.trained'), types: ['trained'] }],
  outputs: [],
  params: [{ id: 'showAcc', title: L('blk.loss-chart.p.showAcc'), kind: 'bool', default: true }],
  run({ inputs, params: p }) {
    const h = inputs.trained.history;
    const views = [lineChart([
      { name: L('blk.loss-chart.lossTrain'), values: h.map(e => e.trainLoss), color: classColor(0) },
      { name: L('blk.loss-chart.lossTest'), values: h.map(e => e.testLoss), color: classColor(1) },
    ], { yLabel: 'loss' })];
    if (p.showAcc && inputs.trained.task === 'class') {
      views.push(lineChart([
        { name: L('blk.loss-chart.accTrain'), values: h.map(e => e.trainAcc), color: classColor(0) },
        { name: L('blk.loss-chart.accTest'), values: h.map(e => e.testAcc), color: classColor(1) },
      ], { yLabel: L('blk.loss-chart.acc') }));
    }
    return { view: views };
  },
};
