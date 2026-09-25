// HTML-содержимое карточек боковой панели. Только строки — без побочных эффектов.
//
// Большинство функций принимают контекст ctx = { model, values, names }:
//   model  — модель сети (см. models/mlp.js)
//   values — текущие показанные активации view.values[l][i] (null — ещё не вычислено)
//   names  — необязательные имена нейронов по слоям (names[l][i])
import {
  formatValue, formatPercent, plural, layerKind, layerShortName, escapeHtml,
  NEURONS, LAYERS, WEIGHTS, LINKS,
} from './format.js';

const MAX_LIST = 6;

const signClass = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const num = (v, digits = 2) => `<b class="num ${signClass(v)}">${formatValue(v, digits)}</b>`;

/** Короткое имя нейрона: имя из конфига пространства или «Н3» */
function short(ctx, l, i) {
  const name = ctx.names?.[l]?.[i];
  return name ? `«${escapeHtml(name)}»` : `Н${i + 1}`;
}
const full = (ctx, l, i) => `${short(ctx, l, i)} слоя ${l + 1}`;

/** Карточка «Сцена»: что сейчас показано */
export function sceneHtml(ctx, { editable = false } = {}) {
  const { model } = ctx;
  const { layers } = model;
  const total = layers.reduce((a, b) => a + b, 0);
  const nWeights = model.weights.flat(2).length;
  const hidden = layers.length - 2;

  const rows = layers.map((n, l) => {
    const act = model.activationName(l);
    return `<li data-layer="${l}">
      <span class="chip">${l + 1}</span>
      <span class="grow">${layerShortName(l, layers.length)} <span class="muted">· ${layerKind(l, layers.length)}</span></span>
      <span>${n} ${plural(n, NEURONS)}${act ? ` <span class="muted">· ${act}</span>` : ''}</span>
    </li>`;
  }).join('');

  return `
    <p class="arch">${layers.join(' → ')}</p>
    <p>Полносвязная сеть: ${layers.length} ${plural(layers.length, LAYERS)}
      (${hidden} ${plural(hidden, ['скрытый', 'скрытых', 'скрытых'])}),
      ${total} ${plural(total, NEURONS)} и ${nWeights} ${plural(nWeights, WEIGHTS)}.
      Каждый нейрон связан со всеми нейронами следующего слоя.
      ${editable ? 'Веса случайные — сеть не обучена.' : ''}</p>
    <ol class="layers">${rows}</ol>`;
}

/** Карточка «Под курсором» */
export function hoverHtml(hover, ctx) {
  if (!hover) {
    return `<p class="muted">Наведите курсор на нейрон (шар) или связь (линию), чтобы увидеть подробности.</p>`;
  }
  return hover.type === 'neuron' ? neuronHtml(hover, ctx) : weightHtml(hover, ctx);
}

function neuronHtml({ layer: l, index: n }, ctx) {
  const { model, values } = ctx;
  const { layers, weights, biases } = model;
  const last = layers.length - 1;
  const a = values[l][n];
  const act = model.activationName(l);
  const name = ctx.names?.[l]?.[n];

  let html = `<h3>Нейрон ${n + 1} · слой ${l + 1} <span class="muted">(${layerShortName(l, layers.length).toLowerCase()})</span></h3>`;
  if (name) html += `<p>Означает: <b>${escapeHtml(name)}</b></p>`;

  html += a === null
    ? `<p>Активация: <span class="muted">ещё не вычислена — запустите forward pass</span></p>`
    : `<p>Активация: ${num(a, 3)}</p>`;

  if (l === 0) {
    html += `<p class="muted">Входной нейрон: его значение просто подаётся в сеть, он ничего не вычисляет.</p>`;
  } else {
    const z = model.lastZ?.[l]?.[n];
    if (a !== null && z !== undefined) {
      html += `<p class="muted">Взвешенная сумма z = Σ w·x + b = ${formatValue(z, 3)}
        (смещение b = ${formatValue(biases[l - 1][n], 2)}), затем ${act}(z) = ${formatValue(a, 3)}.</p>`;
    }
    const incoming = weights[l - 1][n].map((w, i) => ({ i, w, x: values[l - 1][i] }));
    html += linkList(
      `Входящие: ${incoming.length} ${plural(incoming.length, LINKS)} от слоя ${l}`,
      incoming.map(({ i, w, x }) => ({
        w,
        text: `от ${short(ctx, l - 1, i)}`,
        extra: x !== null ? `вклад w·x = ${formatValue(w * x)}` : '',
      })),
    );
  }

  if (l < last) {
    const outgoing = weights[l].map((row, j) => ({ j, w: row[n] }));
    html += linkList(
      `Исходящие: ${outgoing.length} ${plural(outgoing.length, LINKS)} к слою ${l + 2}`,
      outgoing.map(({ j, w }) => ({ w, text: `к ${short(ctx, l + 1, j)}` })),
    );
  }
  return html;
}

function linkList(title, items) {
  const sorted = [...items].sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
  const shown = sorted.slice(0, MAX_LIST);
  const rest = sorted.length - shown.length;
  return `<p class="list-title">${title}${rest > 0 ? ' <span class="muted">(самые сильные)</span>' : ''}</p>
    <ul class="links">${shown.map(({ w, text, extra }) => `
      <li><span class="grow">${text}</span>${extra ? `<span class="muted">${extra}</span>` : ''}<span>w = ${num(w)}</span></li>`).join('')}
    </ul>${rest > 0 ? `<p class="muted small">…и ещё ${rest}</p>` : ''}`;
}

function weightHtml({ gap, from, to }, ctx) {
  const { model, values } = ctx;
  const w = model.weights[gap][to][from];
  const x = values[gap][from];
  const a = short(ctx, gap, from), b = short(ctx, gap + 1, to);
  const effect = w >= 0
    ? `Положительный вес <b class="pos">усиливает</b> сигнал: чем сильнее активен ${a}, тем больше он «толкает» ${b} вверх.`
    : `Отрицательный вес <b class="neg">подавляет</b> сигнал: активность ${a} уменьшает сумму на входе ${b}.`;
  return `
    <h3>Связь ${full(ctx, gap, from)} → ${full(ctx, gap + 1, to)}</h3>
    <p>Вес: ${num(w, 4)}</p>
    <p class="muted">${effect}</p>
    ${x !== null ? `<p>Вклад сейчас: w × x = ${formatValue(w)} × ${formatValue(x)} = ${num(w * x, 3)}</p>` : ''}`;
}

/** Короткий текст для всплывающей подсказки у курсора */
export function tooltipText(hover, ctx) {
  const plain = s => s.replace(/«|»/g, '');
  if (hover.type === 'neuron') {
    const { layer: l, index: i } = hover;
    const a = ctx.values[l][i];
    const name = ctx.names?.[l]?.[i];
    return `Слой ${l + 1} · нейрон ${i + 1}${name ? ` (${name})` : ''} · ${a === null ? 'не вычислен' : `a = ${formatValue(a, 3)}`}`;
  }
  const { gap, from, to } = hover;
  return `${plain(short(ctx, gap, from))} (сл. ${gap + 1}) → ${plain(short(ctx, gap + 1, to))} (сл. ${gap + 2}) · w = ${formatValue(ctx.model.weights[gap][to][from], 3)}`;
}

/** Описание текущего этапа анимации forward-pass */
export function stageText(stage, model) {
  const l = stage >> 1;
  const total = model.layers.length;
  if (stage % 2 === 1) {
    return `Сигнал идёт по связям: слой ${l + 1} → слой ${l + 2}. Каждое значение умножается на вес связи.`;
  }
  if (l === 0) return `Слой 1: входные значения подаются в сеть.`;
  return `Слой ${l + 1} из ${total}: нейроны складывают входящие сигналы и применяют ${model.activationName(l)}.`;
}

const OUTPUT_RANGE = {
  sigmoid: 'Выходы проходят через сигмоиду, поэтому всегда лежат между 0 и 1.',
  tanh: 'Выходы проходят через tanh, поэтому лежат между −1 и 1.',
  relu: 'Выходы проходят через ReLU: отрицательные суммы превращаются в 0.',
  linear: 'Выходной слой линейный: значение z выдаётся как есть, без ограничений диапазона.',
};

/** Полоски значений выходного слоя (переиспользуется пространствами в своих объяснениях) */
export function outputBarsHtml(ctx, out, { percent = true } = {}) {
  const best = out.indexOf(Math.max(...out));
  const max = Math.max(1, ...out.map(Math.abs));
  const L = ctx.model.layers.length - 1;
  return `<ul class="bars">${out.map((v, j) => `
    <li class="${j === best ? 'best' : ''}">
      <span class="name">${short(ctx, L, j).replace(/«|»/g, '')}</span>
      <span class="bar"><span style="width:${(Math.abs(v) / max * 100).toFixed(1)}%"></span></span>
      <span class="num">${v.toFixed(3)}</span>
      <span class="muted pct">${percent ? formatPercent(v) : ''}</span>
    </li>`).join('')}</ul>`;
}

/** Карточка «Результат» по умолчанию (пространство может заменить её своей explainResult) */
export function resultHtml(ctx, activations, { inputCaption } = {}) {
  const { model } = ctx;
  const out = activations.at(-1);
  const input = activations[0];
  const L = activations.length - 1;
  const best = out.indexOf(Math.max(...out));
  const z = model.lastZ[L][best];
  const outAct = model.activationName(L);

  // Какой нейрон предыдущего слоя сильнее всего «вытолкнул» победителя
  const contrib = model.weights[L - 1][best].map((w, i) => w * activations[L - 1][i]);
  const top = contrib.reduce((bi, c, i) => (c > contrib[bi] ? i : bi), 0);
  const hidden = model.layers.length - 2;

  return `
    ${outputBarsHtml(ctx, out, { percent: outAct === 'sigmoid' })}
    <p class="muted small">Вход${inputCaption ? ` (${escapeHtml(inputCaption)})` : ''}: [${input.map(v => formatValue(v)).join(', ')}]</p>
    <p>Сеть получила ${input.length} ${plural(input.length, ['число', 'числа', 'чисел'])}
      и провела их через ${hidden} ${plural(hidden, ['скрытый слой', 'скрытых слоя', 'скрытых слоёв'])}.
      Сильнее всего сработал выходной нейрон <b>${short(ctx, L, best)}</b> (${formatValue(out[best], 3)}):
      на него пришла наибольшая взвешенная сумма z = ${formatValue(z)},
      в основном благодаря ${short(ctx, L - 1, top)} предыдущего слоя (вклад ${formatValue(contrib[top])}).
      ${OUTPUT_RANGE[outAct] ?? ''}</p>`;
}
