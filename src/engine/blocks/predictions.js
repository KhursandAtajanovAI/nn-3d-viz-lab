// Предсказания на тестовой выборке таблицей.
import { table, fmt } from '../graph/view.js';

export default {
  id: 'predictions',
  title: 'Предсказания',
  group: 'result',
  info: 'Первые строки теста: признаки, верный ответ, ответ сети и её уверенность.',
  inputs: [{ id: 'trained', title: 'Обученная', types: ['trained'] }],
  outputs: [],
  params: [{ id: 'rows', title: 'Строк', kind: 'number', min: 1, max: 200, step: 1, int: true, default: 20 }],
  summary: p => `${p.rows} строк`,
  run({ inputs, params: p }) {
    const t = inputs.trained;
    const showFeats = t.inputShape.length === 1 ? t.featureNames.slice(0, 4) : [];
    const n = Math.min(p.rows, t.test.X.length);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const pr = t.final.preds[i];
      const feats = showFeats.map((_, f) => t.test.X[i][f]);
      if (t.task === 'class') {
        const ok = pr.cls === t.test.y[i];
        rows.push([i + 1, ...feats, t.classes[t.test.y[i]], { text: t.classes[pr.cls], cls: ok ? 'ok' : 'bad' }, `${(pr.conf * 100).toFixed(0)} %`]);
      } else {
        const truth = t.test.y[i][0];
        rows.push([i + 1, ...feats, truth, pr.value, fmt(pr.value - truth)]);
      }
    }
    const cols = t.task === 'class' ? ['№', ...showFeats, 'верно', 'ответ', 'уверенность'] : ['№', ...showFeats, 'верно', 'ответ', 'ошибка'];
    return { view: table(cols, rows) };
  },
};
