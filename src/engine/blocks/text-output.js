// Текстовый вывод чисел: сводка по данным, модели или обучению.
import { text, fmt } from '../graph/view.js';
import { isNumericColumn } from '../graph/data.js';

function dataLines(d, title = '') {
  const lines = [`${title}${d.name}: ${d.rows.length} строк × ${d.columns.length} столбцов${d.target ? `, цель — «${d.target}»` : ''}`];
  if (d.image) { lines.push(`Картинки ${d.image.width}×${d.image.height}, оттенки серого`); return lines; }
  d.columns.slice(0, 20).forEach((name, c) => {
    if (isNumericColumn(d, c)) {
      const v = d.rows.map(r => r[c]).filter(Number.isFinite);
      const mean = v.reduce((a, b) => a + b, 0) / (v.length || 1);
      lines.push(`  ${name}: min ${fmt(Math.min(...v))}, max ${fmt(Math.max(...v))}, среднее ${fmt(mean)}`);
    } else {
      lines.push(`  ${name}: текст, разных значений ${new Set(d.rows.map(r => r[c])).size}`);
    }
  });
  if (d.columns.length > 20) lines.push(`  … и ещё ${d.columns.length - 20} столбцов`);
  return lines;
}

function trainedLines(v) {
  const last = v.history.at(-1);
  const lines = [
    `Задача: ${v.task === 'class' ? `классификация, классов ${v.classes.length}` : 'регрессия'}`,
    `Функция потерь: ${v.loss === 'ce' ? 'кросс-энтропия' : 'MSE'}, эпох ${v.history.length}`,
    `Потеря: обучение ${fmt(last.trainLoss)}, тест ${fmt(v.final.loss)}`,
  ];
  if (v.task === 'class') lines.push(`Точность: обучение ${fmt(last.trainAcc)}, тест ${fmt(v.final.acc)}`);
  lines.push(`Параметров: ${v.net.paramCount}`, 'Слои:');
  for (const s of v.net.summary()) lines.push(`  ${s.name.padEnd(18)} → [${s.shape.join(' × ')}]${s.params ? `, параметров ${s.params}` : ''}`);
  const first = v.net.layers.find(L => L.type === 'dense');
  if (first && first.nIn <= 8) {
    lines.push('Веса первого полносвязного слоя (строка — нейрон):');
    for (let j = 0; j < Math.min(first.units, 8); j++) {
      const row = Array.from(first.W.w.slice(j * first.nIn, (j + 1) * first.nIn), x => fmt(x, 3));
      lines.push(`  [${row.join(', ')}]  b = ${fmt(first.b.w[j], 3)}`);
    }
  }
  return lines;
}

export default {
  id: 'text-output',
  title: 'Вывод чисел',
  group: 'result',
  info: 'Печатает числа текстом: статистику столбцов, слои модели или итог обучения с весами первого слоя.',
  inputs: [{ id: 'in', title: 'Что угодно', types: ['data', 'split', 'model', 'trained'] }],
  outputs: [],
  params: [],
  run({ inputs }) {
    const v = inputs.in;
    let lines;
    if (v.spec) lines = ['Слои модели (выходной слой добавит блок «Обучение»):', ...v.spec.map((s, i) => `  ${i + 1}. ${JSON.stringify(s)}`)];
    else if (v.net) lines = trainedLines(v);
    else if (v.train) lines = [...dataLines(v.train, 'Обучение — '), ...dataLines(v.test, 'Тест — ')];
    else lines = dataLines(v);
    return { view: text(lines) };
  },
};
