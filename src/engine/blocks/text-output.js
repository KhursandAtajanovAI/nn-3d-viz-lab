// Текстовый вывод чисел: сводка по данным, модели или обучению.
import { text, numL, joinL } from '../graph/view.js';
import { isNumericColumn } from '../graph/data.js';
import { L } from '../../i18n/i18n.js';

const K = 'blk.text-output';

function dataLines(d, prefix = '') {
  const p = { prefix, name: d.name, rows: String(d.rows.length), cols: String(d.columns.length) };
  const lines = [d.target ? L(`${K}.dataTarget`, { ...p, target: d.target }) : L(`${K}.data`, p)];
  if (d.image) { lines.push(L(`${K}.images`, { w: d.image.width, h: d.image.height })); return lines; }
  d.columns.slice(0, 20).forEach((name, c) => {
    if (isNumericColumn(d, c)) {
      const v = d.rows.map(r => r[c]).filter(Number.isFinite);
      const mean = v.reduce((a, b) => a + b, 0) / (v.length || 1);
      lines.push(L(`${K}.colNum`, { name, min: numL(Math.min(...v)), max: numL(Math.max(...v)), mean: numL(mean) }));
    } else {
      lines.push(L(`${K}.colText`, { name, n: String(new Set(d.rows.map(r => r[c])).size) }));
    }
  });
  if (d.columns.length > 20) lines.push(L(`${K}.more`, { n: String(d.columns.length - 20) }));
  return lines;
}

function trainedLines(v) {
  const last = v.history.at(-1);
  const lines = [
    L(`${K}.${v.task === 'class' ? 'taskClass' : 'taskReg'}`, { n: String(v.classes?.length ?? 0) }),
    L(`${K}.lossFn`, { loss: L(`${K}.${v.loss === 'ce' ? 'ce' : 'mse'}`), epochs: String(v.history.length) }),
    L(`${K}.lossVals`, { train: numL(last.trainLoss), test: numL(v.final.loss) }),
  ];
  if (v.task === 'class') lines.push(L(`${K}.accVals`, { train: numL(last.trainAcc), test: numL(v.final.acc) }));
  lines.push(L(`${K}.paramCount`, { n: String(v.net.paramCount) }), L(`${K}.layers`));
  for (const s of v.net.summary()) {
    lines.push(L(`${K}.${s.params ? 'layerParams' : 'layer'}`, { name: s.name, shape: s.shape.join(' × '), n: String(s.params) }));
  }
  const first = v.net.layers.find(l => l.type === 'dense');
  if (first && first.nIn <= 8) {
    lines.push(L(`${K}.weights`));
    for (let j = 0; j < Math.min(first.units, 8); j++) {
      const row = Array.from(first.W.w.slice(j * first.nIn, (j + 1) * first.nIn), x => numL(x));
      lines.push(L(`${K}.weightRow`, { row: joinL(row, 'graph.comma'), b: numL(first.b.w[j]) }));
    }
  }
  return lines;
}

export default {
  id: 'text-output',
  title: L('blk.text-output.title'),
  group: 'result',
  info: L('blk.text-output.info'),
  inputs: [{ id: 'in', title: L('blk.port.any'), types: ['data', 'split', 'model', 'trained'] }],
  outputs: [],
  params: [],
  run({ inputs }) {
    const v = inputs.in;
    let lines;
    if (v.spec) lines = [L(`${K}.spec`), ...v.spec.map((s, i) => `  ${i + 1}. ${JSON.stringify(s)}`)];
    else if (v.net) lines = trainedLines(v);
    else if (v.train) lines = [...dataLines(v.train, L(`${K}.trainPrefix`)), ...dataLines(v.test, L(`${K}.testPrefix`))];
    else lines = dataLines(v);
    return { view: text(lines) };
  },
};
