// HTML-содержимое карточек боковой панели. Только строки — без побочных эффектов.
import {
  formatValue, formatPercent, plural, layerKind, layerShortName,
  NEURONS, LAYERS, WEIGHTS, LINKS,
} from './format.js';

const MAX_LIST = 6;

const signClass = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const num = (v, digits = 2) => `<b class="num ${signClass(v)}">${formatValue(v, digits)}</b>`;
const neuronName = (l, i) => `Н${i + 1} слоя ${l + 1}`;

/** Карточка «Сцена»: что сейчас показано */
export function sceneHtml(network) {
  const { layers } = network;
  const total = layers.reduce((a, b) => a + b, 0);
  const nWeights = network.weights.flat(2).length;
  const hidden = layers.length - 2;

  const rows = layers.map((n, l) => {
    const act = network.activationName(l);
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
      Каждый нейрон связан со всеми нейронами следующего слоя. Веса случайные — сеть не обучена.</p>
    <ol class="layers">${rows}</ol>`;
}

/** Карточка «Под курсором» */
export function hoverHtml(hover, network, values) {
  if (!hover) {
    return `<p class="muted">Наведите курсор на нейрон (шар) или связь (линию), чтобы увидеть подробности.</p>`;
  }
  return hover.type === 'neuron'
    ? neuronHtml(hover, network, values)
    : weightHtml(hover, network, values);
}

function neuronHtml({ layer: l, index: n }, network, values) {
  const { layers, weights, biases } = network;
  const last = layers.length - 1;
  const a = values[l][n];
  const act = network.activationName(l);

  let html = `<h3>Нейрон ${n + 1} · слой ${l + 1} <span class="muted">(${layerShortName(l, layers.length).toLowerCase()})</span></h3>`;

  html += a === null
    ? `<p>Активация: <span class="muted">ещё не вычислена — запустите forward pass</span></p>`
    : `<p>Активация: ${num(a, 3)}</p>`;

  if (l === 0) {
    html += `<p class="muted">Входной нейрон: его значение просто подаётся в сеть, он ничего не вычисляет.</p>`;
  } else {
    const z = network.lastZ?.[l]?.[n];
    if (a !== null && z !== undefined) {
      html += `<p class="muted">Взвешенная сумма z = Σ w·x + b = ${formatValue(z, 3)}
        (смещение b = ${formatValue(biases[l - 1][n], 2)}), затем ${act}(z) = ${formatValue(a, 3)}.</p>`;
    }
    const incoming = weights[l - 1][n].map((w, i) => ({ i, w, x: values[l - 1][i] }));
    html += linkList(
      `Входящие: ${incoming.length} ${plural(incoming.length, LINKS)} от слоя ${l}`,
      incoming.map(({ i, w, x }) => ({
        w,
        text: `от Н${i + 1}`,
        extra: x !== null ? `вклад w·x = ${formatValue(w * x)}` : '',
      })),
    );
  }

  if (l < last) {
    const outgoing = weights[l].map((row, j) => ({ j, w: row[n] }));
    html += linkList(
      `Исходящие: ${outgoing.length} ${plural(outgoing.length, LINKS)} к слою ${l + 2}`,
      outgoing.map(({ j, w }) => ({ w, text: `к Н${j + 1}` })),
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

function weightHtml({ gap, from, to }, network, values) {
  const w = network.weights[gap][to][from];
  const x = values[gap][from];
  const effect = w >= 0
    ? `Положительный вес <b class="pos">усиливает</b> сигнал: чем сильнее активен Н${from + 1}, тем больше он «толкает» Н${to + 1} вверх.`
    : `Отрицательный вес <b class="neg">подавляет</b> сигнал: активность Н${from + 1} уменьшает сумму на входе Н${to + 1}.`;
  return `
    <h3>Связь ${neuronName(gap, from)} → ${neuronName(gap + 1, to)}</h3>
    <p>Вес: ${num(w, 4)}</p>
    <p class="muted">${effect}</p>
    ${x !== null ? `<p>Вклад сейчас: w × x = ${formatValue(w)} × ${formatValue(x)} = ${num(w * x, 3)}</p>` : ''}`;
}

/** Короткий текст для всплывающей подсказки у курсора */
export function tooltipText(hover, network, values) {
  if (hover.type === 'neuron') {
    const a = values[hover.layer][hover.index];
    return `Слой ${hover.layer + 1} · нейрон ${hover.index + 1} · ${a === null ? 'не вычислен' : `a = ${formatValue(a, 3)}`}`;
  }
  const { gap, from, to } = hover;
  return `Н${from + 1} (сл. ${gap + 1}) → Н${to + 1} (сл. ${gap + 2}) · w = ${formatValue(network.weights[gap][to][from], 3)}`;
}

/** Описание текущего этапа анимации forward-pass */
export function stageText(stage, network) {
  const l = stage >> 1;
  const total = network.layers.length;
  if (stage % 2 === 1) {
    return `Сигнал идёт по связям: слой ${l + 1} → слой ${l + 2}. Каждое значение умножается на вес связи.`;
  }
  if (l === 0) return `Слой 1: входные значения подаются в сеть.`;
  return `Слой ${l + 1} из ${total}: нейроны складывают входящие сигналы и применяют ${network.activationName(l)}.`;
}

/** Карточка «Результат» после forward-pass */
export function resultHtml(network, activations) {
  const out = activations.at(-1);
  const input = activations[0];
  const L = activations.length - 1;
  const best = out.indexOf(Math.max(...out));
  const z = network.lastZ[L][best];

  // Какой нейрон предыдущего слоя сильнее всего «вытолкнул» победителя
  const contrib = network.weights[L - 1][best].map((w, i) => w * activations[L - 1][i]);
  const top = contrib.reduce((bi, c, i) => (c > contrib[bi] ? i : bi), 0);
  const hidden = network.layers.length - 2;

  const bars = out.map((v, j) => `
    <li class="${j === best ? 'best' : ''}">
      <span class="name">Н${j + 1}</span>
      <span class="bar"><span style="width:${(v * 100).toFixed(1)}%"></span></span>
      <span class="num">${v.toFixed(3)}</span>
      <span class="muted pct">${formatPercent(v)}</span>
    </li>`).join('');

  return `
    <ul class="bars">${bars}</ul>
    <p class="muted small">Вход: [${input.map(v => formatValue(v)).join(', ')}]</p>
    <p>Сеть получила ${input.length} ${plural(input.length, ['случайное число', 'случайных числа', 'случайных чисел'])}
      и провела их через ${hidden} ${plural(hidden, ['скрытый слой', 'скрытых слоя', 'скрытых слоёв'])}.
      Сильнее всего сработал выходной нейрон <b>Н${best + 1}</b> (${formatPercent(out[best])}):
      на него пришла наибольшая взвешенная сумма z = ${formatValue(z)},
      в основном благодаря Н${top + 1} предыдущего слоя (вклад ${formatValue(contrib[top])}).
      Выходы проходят через сигмоиду, поэтому всегда лежат между 0 и 1;
      веса случайные, так что сами числа пока ничего не «означают» — важно, как сигнал течёт слой за слоем.</p>`;
}
