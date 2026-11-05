// Датасет пользователя из хранилища браузера (загружается в карточке «Датасеты»).
import { datasetToData } from '../graph/data.js';
import { fail } from '../graph/fail.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'data-file',
  title: L('blk.data-file.title'),
  group: 'data',
  info: L('blk.data-file.info'),
  inputs: [],
  outputs: [{ id: 'data', title: L('blk.port.data'), type: 'data' }],
  params: [
    { id: 'dataset', title: L('blk.data-file.p.dataset'), kind: 'dataset', default: '' },
    { id: 'target', title: L('blk.data-file.p.target'), kind: 'text', maxLength: 60, default: '' },
  ],
  summary: (p, ctx) => ctx?.datasetName?.(p.dataset) ?? L('graph.ds.none'),
  async run({ params: p, ctx }) {
    if (!p.dataset) throw fail('blk.data-file.err.choose');
    const ds = await ctx.getDataset(p.dataset);
    if (!ds) throw fail('blk.data-file.err.missing');
    if (p.target && ds.kind === 'table' && !ds.columns.includes(p.target)) {
      throw fail('blk.data-file.err.noColumn', { name: p.target, list: ds.columns.slice(0, 12).join(', ') });
    }
    return { outputs: { data: datasetToData(ds, p.target) } };
  },
};
