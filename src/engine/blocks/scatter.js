// Диаграмма рассеяния двух признаков; после обучения — с областями решений сети.
import { scatter, note } from '../graph/view.js';
import { isNumericColumn, toXY } from '../graph/data.js';

export default {
  id: 'scatter',
  title: 'Диаграмма рассеяния',
  group: 'result',
  info: 'Точки по двум признакам, цвет — класс. Для обученной модели на 2 признаках закрашиваются области, где сеть отвечает тем или иным классом.',
  inputs: [{ id: 'in', title: 'Данные или обученная', types: ['data', 'split', 'trained'] }],
  outputs: [],
  params: [
    { id: 'x', title: 'Признак по X (номер)', kind: 'number', min: 1, max: 100, step: 1, int: true, default: 1 },
    { id: 'y', title: 'Признак по Y (номер)', kind: 'number', min: 1, max: 100, step: 1, int: true, default: 2 },
  ],
  summary: p => `признаки ${p.x} и ${p.y}`,
  run({ inputs, params: p }) {
    const v = inputs.in;
    if (v.net) {
      if (v.inputShape.length !== 1) return { view: note('Для картинок диаграмма рассеяния не строится') };
      const nf = v.inputShape[0], fx = p.x - 1, fy = p.y - 1;
      if (fx >= nf || fy >= nf) return { view: note(`Признаков всего ${nf}`) };
      const pts = v.test.X.map((x, i) => (v.task === 'class'
        ? { x: x[fx], y: x[fy], c: v.test.y[i], ok: v.final.preds[i].cls === v.test.y[i] }
        : { x: x[fx], y: v.test.y[i][0], c: 0 }));
      let background = null;
      if (v.task === 'class' && nf === 2) {
        const probe = new Float32Array(2);
        background = (a, b) => {
          probe[fx] = a; probe[fy] = b;
          const out = v.net.forward(probe);
          let best = 0;
          for (let k = 1; k < out.length; k++) if (out[k] > out[best]) best = k;
          return best;
        };
      }
      const views = [scatter(pts, { classes: v.classes ?? [], xLabel: v.featureNames[fx], yLabel: v.task === 'class' ? v.featureNames[fy] : 'цель', background })];
      if (v.task === 'class') views.push(note('Точки теста; обведены ошибки сети' + (background ? ', фон — ответ сети' : '')));
      return { view: views };
    }
    const d = v.train ?? v;
    if (d.image) return { view: note('Для картинок диаграмма рассеяния не строится') };
    const t = d.columns.indexOf(d.target);
    const feats = d.columns.map((_, c) => c).filter(c => c !== t && isNumericColumn(d, c));
    if (!feats.length) return { view: note('Нет числовых признаков') };
    const cx = feats[Math.min(p.x, feats.length) - 1], cy = feats[Math.min(p.y, feats.length) - 1];
    let classes = [], cls = () => 0;
    try {
      const xy = toXY(d);
      if (xy.task === 'class') {
        classes = xy.classes;
        const idx = new Map(classes.map((c, i) => [c, i]));
        cls = r => idx.get(String(r[t])) ?? 0;
      }
    } catch { /* без цели — одним цветом */ }
    const pts = d.rows.filter(r => Number.isFinite(r[cx]) && Number.isFinite(r[cy])).slice(0, 5000).map(r => ({ x: r[cx], y: r[cy], c: cls(r) }));
    return { view: scatter(pts, { classes, xLabel: d.columns[cx], yLabel: d.columns[cy] }) };
  },
};
