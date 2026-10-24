// Обучение: модель + данные → обученная модель с историей потерь и точности.
import { trainModel } from '../graph/train.js';
import { note } from '../graph/view.js';

export default {
  id: 'train',
  title: 'Обучение',
  group: 'train',
  info: 'Градиентный спуск по обучающей выборке. Выходной слой под число классов добавляется автоматически. «Сохранять обученные веса» — веса попадут в пространство и в скачанный файл, и при открытии модель не будет обучаться заново.',
  inputs: [
    { id: 'model', title: 'Модель', types: ['model'] },
    { id: 'data', title: 'Данные', types: ['split', 'data'] },
  ],
  outputs: [{ id: 'trained', title: 'Обученная', type: 'trained' }],
  params: [
    { id: 'epochs', title: 'Эпох', kind: 'number', min: 1, max: 500, step: 1, int: true, default: 40 },
    { id: 'lr', title: 'Скорость обучения (lr)', kind: 'number', min: 0.00001, max: 2, step: 0.001, default: 0.01 },
    { id: 'batch', title: 'Размер батча', kind: 'number', min: 1, max: 512, step: 1, int: true, default: 16 },
    { id: 'optimizer', title: 'Оптимизатор', kind: 'select', options: [['adam', 'Adam'], ['sgd', 'SGD']], default: 'adam' },
    { id: 'loss', title: 'Функция потерь', kind: 'select', options: [['auto', 'Авто'], ['ce', 'Кросс-энтропия'], ['mse', 'MSE (средний квадрат)']], default: 'auto' },
    { id: 'autoOutput', title: 'Выходной слой автоматически', kind: 'bool', default: true },
    { id: 'seed', title: 'Зерно случайности', kind: 'number', min: 1, max: 99999, step: 1, int: true, default: 1 },
    { id: 'saveWeights', title: 'Сохранять обученные веса', kind: 'bool', default: false },
  ],
  summary: p => `${p.epochs} эп. · lr ${p.lr} · ${p.optimizer}`,
  long: true,
  async run({ inputs, params: p, ctx }) {
    const d = inputs.data;
    const split = d.train ? d : { train: d, test: d };
    if (!inputs.model.spec.length && !p.autoOutput) throw new Error('В модели нет слоёв');
    const saved = p.saveWeights && !ctx.retrain ? ctx.saved : null;
    const t0 = performance.now();
    const res = await trainModel(inputs.model, split, p, ctx, saved);
    const ms = performance.now() - t0;
    const took = ms < 1000 ? `${Math.round(ms)} мс` : `${(ms / 1000).toFixed(1)} с`;
    const views = res.restored
      ? [note(`Сохранённая модель: ${res.history.length} эп., без переобучения · параметров: ${res.net.paramCount}. Чтобы обучить снова — «Обучить заново».`)]
      : [note(`Обучено за ${took} · параметров: ${res.net.paramCount}`)];
    if (res.staleReason) views.push(note(`Сохранённые веса не подошли (${res.staleReason}) — модель обучена заново`, 'warn'));
    if (!d.train) views.push(note('Данные не разбиты на train/test — «тест» здесь совпадает с обучающей выборкой', 'warn'));
    for (const w of res.warnings) views.push(note(w, 'warn'));
    return { outputs: { trained: res }, view: views };
  },
};
