// Обучение и оценка модели блочного конструктора (используется блоками «Обучение» и результатов).
import { Network, rng } from './nn.js';
import { toXY } from './data.js';

/** Оценка на выборке: средняя потеря, точность (для классификации), предсказания */
export function evaluate(net, set, task, loss) {
  let sum = 0, correct = 0;
  const preds = [];
  for (let i = 0; i < set.X.length; i++) {
    const y = net.forward(set.X[i]);
    if (task === 'class') {
      let best = 0;
      for (let k = 1; k < y.length; k++) if (y[k] > y[best]) best = k;
      preds.push({ cls: best, conf: y[best], out: y });
      if (best === set.y[i]) correct++;
      sum += loss === 'ce' ? -Math.log(Math.max(y[set.y[i]], 1e-7)) : mse(y, oneHot(set.y[i], y.length));
    } else {
      preds.push({ value: y[0], out: y });
      sum += mse(y, set.y[i]);
    }
  }
  const n = set.X.length || 1;
  return { loss: sum / n, acc: task === 'class' ? correct / n : null, preds };
}

/** FNV-1a: подпись настроек и данных обучения — по ней сохранённые веса узнают «свою» модель */
function fnv(h, u32) {
  for (let i = 0; i < u32.length; i++) { h ^= u32[i]; h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function signature(spec, train, p) {
  const { epochs, lr, batch, optimizer, loss, autoOutput, seed } = p;
  const head = JSON.stringify({ spec, shape: train.inputShape, classes: train.classes, epochs, lr, batch, optimizer, loss, autoOutput, seed });
  let h = fnv(2166136261, Uint32Array.from(head, c => c.charCodeAt(0)));
  for (let i = 0; i < train.X.length; i++) {
    const x = train.X[i], y = train.y[i];
    h = fnv(h, new Uint32Array(x.buffer, x.byteOffset, x.length));
    h = typeof y === 'number' ? fnv(h, [y]) : fnv(h, new Uint32Array(y.buffer, y.byteOffset, y.length));
  }
  return h.toString(16) + train.X.length.toString(16);
}

/** Веса сети → списки чисел для файла (7 значащих цифр — точность float32) */
export function exportWeights(net) {
  return net.params.map(p => Array.from(p.w, v => Number(v.toPrecision(7))));
}

/** Почему сохранённые веса не подходят к сети (null — подходят) */
function savedMismatch(net, saved, sig) {
  if (saved.sig !== sig) return 'изменились слои, данные или настройки обучения';
  if (saved.weights.length !== net.params.length || saved.weights.some((w, i) => w.length !== net.params[i].w.length)) return 'не совпадают размеры слоёв';
  return null;
}

const mse = (y, t) => { let s = 0; for (let i = 0; i < y.length; i++) s += (y[i] - t[i]) ** 2; return s / y.length; };
const oneHot = (k, n) => { const v = new Float32Array(n); v[k] = 1; return v; };

/**
 * Обучить модель.
 * @param {{ spec: object[] }} model
 * @param {{ train: object, test: object }} split — таблицы данных
 * @param {object} p — epochs, lr, batch, optimizer, loss ('auto'|'ce'|'mse'), autoOutput, seed
 * @param {object} ctx — progress(f, text), tick() (уступает поток и проверяет отмену)
 * @param {{ sig, weights, history }|null} saved — сохранённые веса: если подходят, модель не обучается заново
 */
export async function trainModel(model, split, p, ctx, saved = null) {
  const train = toXY(split.train);
  const test = toXY(split.test, { classes: train.classes });
  const warnings = [...train.warnings, ...test.warnings.map(w => `тест: ${w}`)];
  const task = train.task;
  const nOut = task === 'class' ? train.classes.length : 1;
  if (task === 'class' && nOut < 2) throw new Error('В цели только один класс — учить нечему');

  const spec = model.spec.slice();
  if (p.autoOutput) spec.push({ type: 'dense', units: nOut, activation: task === 'class' ? 'softmax' : 'linear' });
  const net = new Network(spec, train.inputShape, p.seed);
  const outSize = net.outputShape.reduce((a, b) => a * b, 1);
  if (outSize !== nOut) {
    throw new Error(`Выход модели — ${outSize} ${outSize === 1 ? 'число' : 'чисел'}, а нужно ${nOut} (${task === 'class' ? 'по числу классов' : 'одно число'}). Включите «Выходной слой автоматически» или поправьте последний слой`);
  }
  const loss = p.loss === 'auto' ? (task === 'class' ? 'ce' : 'mse') : p.loss;
  if (loss === 'ce' && task !== 'class') throw new Error('Кросс-энтропия — только для классификации; для чисел выберите MSE');

  const sig = signature(spec, train, p);
  const base = { net, task, loss, classes: train.classes, featureNames: train.featureNames, inputShape: train.inputShape, train, test, testData: split.test, warnings, params: p, sig };
  let staleReason = null;
  if (saved) {
    staleReason = savedMismatch(net, saved, sig);
    if (!staleReason) {
      saved.weights.forEach((w, i) => net.params[i].w.set(w));
      return { ...base, history: saved.history, final: evaluate(net, test, task, loss), restored: true };
    }
  }

  const target = i => (loss === 'ce' ? train.y[i] : task === 'class' ? oneHot(train.y[i], nOut) : train.y[i]);
  const r = rng(p.seed + 7);
  const order = train.X.map((_, i) => i);
  const history = [];
  const total = p.epochs * train.X.length;
  let done = 0;
  for (let e = 0; e < p.epochs; e++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let lossSum = 0, correct = 0;
    for (let s = 0; s < order.length; s += p.batch) {
      const end = Math.min(order.length, s + p.batch);
      for (let k = s; k < end; k++) {
        const i = order[k];
        const res = net.trainSample(train.X[i], target(i), loss);
        if (!Number.isFinite(res.loss)) throw new Error(`Потеря стала ${res.loss} на эпохе ${e + 1} — уменьшите скорость обучения`);
        lossSum += res.loss;
        if (task === 'class') {
          let best = 0;
          for (let q = 1; q < res.y.length; q++) if (res.y[q] > res.y[best]) best = q;
          if (best === train.y[i]) correct++;
        }
      }
      net.apply(p.optimizer, p.lr, end - s);
      done += end - s;
      await ctx.tick(done / total, `Эпоха ${e + 1} из ${p.epochs}`);
    }
    const ev = evaluate(net, test, task, loss);
    history.push({
      epoch: e + 1,
      trainLoss: lossSum / order.length,
      trainAcc: task === 'class' ? correct / order.length : null,
      testLoss: ev.loss,
      testAcc: ev.acc,
    });
  }
  const final = evaluate(net, test, task, loss);
  return { ...base, history, final, restored: false, staleReason };
}
