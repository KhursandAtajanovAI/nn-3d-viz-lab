// Датасет пользователя из хранилища браузера (загружается в карточке «Датасеты»).
import { datasetToData } from '../graph/data.js';

export default {
  id: 'data-file',
  title: 'Мой датасет',
  group: 'data',
  info: 'CSV, JSON или картинки, загруженные в карточке «Датасеты». Для таблицы укажите столбец-цель.',
  inputs: [],
  outputs: [{ id: 'data', title: 'Данные', type: 'data' }],
  params: [
    { id: 'dataset', title: 'Датасет', kind: 'dataset', default: '' },
    { id: 'target', title: 'Столбец-цель (пусто — последний)', kind: 'text', maxLength: 60, default: '' },
  ],
  summary: (p, ctx) => ctx?.datasetName?.(p.dataset) ?? 'не выбран',
  async run({ params: p, ctx }) {
    if (!p.dataset) throw new Error('Выберите датасет в параметрах блока (сначала загрузите его в карточке «Датасеты»)');
    const ds = await ctx.getDataset(p.dataset);
    if (!ds) throw new Error('Датасет не найден в этом браузере — загрузите его заново');
    if (p.target && ds.kind === 'table' && !ds.columns.includes(p.target)) {
      throw new Error(`Нет столбца «${p.target}». Есть: ${ds.columns.slice(0, 12).join(', ')}`);
    }
    return { outputs: { data: datasetToData(ds, p.target) } };
  },
};
