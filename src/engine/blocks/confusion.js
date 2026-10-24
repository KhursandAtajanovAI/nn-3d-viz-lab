// Матрица ошибок на тестовой выборке.
import { table, note } from '../graph/view.js';

export default {
  id: 'confusion',
  title: 'Матрица ошибок',
  group: 'result',
  info: 'Строки — верный класс, столбцы — ответ сети. На диагонали — правильные ответы.',
  inputs: [{ id: 'trained', title: 'Обученная', types: ['trained'] }],
  outputs: [],
  params: [],
  run({ inputs }) {
    const t = inputs.trained;
    if (t.task !== 'class') return { view: note('Матрица ошибок — только для классификации') };
    const k = t.classes.length;
    if (k > 20) return { view: note(`Классов ${k} — матрица слишком большая (до 20)`) };
    const m = Array.from({ length: k }, () => new Array(k).fill(0));
    t.final.preds.forEach((p, i) => { m[t.test.y[i]][p.cls]++; });
    const max = Math.max(1, ...m.flat());
    const rows = m.map((r, i) => [{ text: t.classes[i], cls: 'head' }, ...r.map((v, j) => ({
      text: String(v),
      cls: 'num',
      bg: v ? `color-mix(in srgb, var(${i === j ? '--ok' : '--error'}) ${Math.round(12 + 50 * v / max)}%, transparent)` : '',
      title: `верно: ${t.classes[i]}, ответ: ${t.classes[j]} — ${v}`,
    }))]);
    return { view: table(['верно ↓ / ответ →', ...t.classes], rows) };
  },
};
