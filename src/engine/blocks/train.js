// Обучение: модель + данные → обученная модель с историей потерь и точности.
import { trainModel } from '../graph/train.js';
import { note } from '../graph/view.js';
import { fail } from '../graph/fail.js';
import { L, num } from '../../i18n/i18n.js';

export default {
  id: 'train',
  title: L('blk.train.title'),
  group: 'train',
  info: L('blk.train.info'),
  inputs: [
    { id: 'model', title: L('blk.port.model'), types: ['model'] },
    { id: 'data', title: L('blk.port.data'), types: ['split', 'data'] },
  ],
  outputs: [{ id: 'trained', title: L('blk.port.trained'), type: 'trained' }],
  params: [
    { id: 'epochs', title: L('blk.train.p.epochs'), kind: 'number', min: 1, max: 500, step: 1, int: true, default: 40 },
    { id: 'lr', title: L('blk.train.p.lr'), kind: 'number', min: 0.00001, max: 2, step: 0.001, default: 0.01 },
    { id: 'batch', title: L('blk.train.p.batch'), kind: 'number', min: 1, max: 512, step: 1, int: true, default: 16 },
    { id: 'optimizer', title: L('blk.train.p.optimizer'), kind: 'select', options: [['adam', 'Adam'], ['sgd', 'SGD']], default: 'adam' },
    { id: 'loss', title: L('blk.train.p.loss'), kind: 'select', options: [['auto', L('blk.train.lossAuto')], ['ce', L('blk.train.lossCe')], ['mse', L('blk.train.lossMse')]], default: 'auto' },
    { id: 'autoOutput', title: L('blk.train.p.autoOutput'), kind: 'bool', default: true },
    { id: 'seed', title: L('blk.p.seed'), kind: 'number', min: 1, max: 99999, step: 1, int: true, default: 1 },
    { id: 'saveWeights', title: L('blk.train.p.saveWeights'), kind: 'bool', default: false },
  ],
  summary: p => L('blk.train.summary', { epochs: String(p.epochs), lr: String(p.lr), opt: p.optimizer }),
  long: true,
  async run({ inputs, params: p, ctx }) {
    const d = inputs.data;
    const split = d.train ? d : { train: d, test: d };
    if (!inputs.model.spec.length && !p.autoOutput) throw fail('blk.train.err.noLayers');
    const saved = p.saveWeights && !ctx.retrain ? ctx.saved : null;
    const t0 = performance.now();
    const res = await trainModel(inputs.model, split, p, ctx, saved);
    const ms = performance.now() - t0;
    const took = ms < 1000 ? L('blk.train.ms', { n: Math.round(ms) }) : L('blk.train.sec', { n: num(ms / 1000, 1) });
    const views = res.restored
      ? [note(L('blk.train.restored', { n: res.history.length, params: res.net.paramCount }))]
      : [note(L('blk.train.done', { took, params: res.net.paramCount }))];
    if (res.staleReason) views.push(note(L('blk.train.stale', { reason: res.staleReason }), 'warn'));
    if (!d.train) views.push(note(L('blk.train.noSplit'), 'warn'));
    for (const w of res.warnings) views.push(note(w, 'warn'));
    return { outputs: { trained: res }, view: views };
  },
};
