// HTML-содержимое карточек боковой панели. Только строки — без побочных эффектов.
//
// Большинство функций принимают контекст ctx = { model, values, names }:
//   model  — модель сети (см. models/mlp.js)
//   values — текущие показанные активации view.values[l][i] (null — ещё не вычислено)
//   names  — необязательные имена нейронов по слоям (names[l][i])
import { fmtSigned as formatValue, formatPercent, layerKind, layerShortName, escapeHtml } from './format.js';
import { t, H, str, fmtNum } from '../i18n/i18n.js';

const MAX_LIST = 6;

const signClass = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const num = (v, digits = 2) => `<b class="num ${signClass(v)}">${formatValue(v, digits)}</b>`;

/** Короткое имя нейрона: имя из конфига пространства (L(...) или строка) или «Н3» / «N3» */
function short(ctx, l, i) {
  const name = str(ctx.names?.[l]?.[i]);
  return name ? t('lab.quoted', { s: escapeHtml(name) }) : t('lab.neuronShort', { n: i + 1 });
}
const full = (ctx, l, i) => t('lab.neuronOfLayer', { name: short(ctx, l, i), l: l + 1 });
const unq = s => s.replace(/[«»"]/g, '');

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
      <span>${t('lab.neurons', { n })}${act ? ` <span class="muted">· ${act}</span>` : ''}</span>
    </li>`;
  }).join('');

  return `
    <p class="arch">${layers.join(' → ')}</p>
    <p>${H('lab.sceneSummary', { layers: t('lab.layers', { n: layers.length }), hidden: t('lab.hiddenCount', { n: hidden }), neurons: t('lab.neurons', { n: total }), weights: t('lab.weights', { n: nWeights }) })}
      ${editable ? H('lab.randomWeights') : ''}</p>
    <ol class="layers">${rows}</ol>`;
}

/** Карточка «Под курсором» */
export function hoverHtml(hover, ctx) {
  if (!hover) {
    return `<p class="muted">${H('lab.hoverNeuronHint')}</p>`;
  }
  return hover.type === 'neuron' ? neuronHtml(hover, ctx) : weightHtml(hover, ctx);
}

function neuronHtml({ layer: l, index: n }, ctx) {
  const { model, values } = ctx;
  const { layers, weights, biases } = model;
  const last = layers.length - 1;
  const a = values[l][n];
  const act = model.activationName(l);
  const name = str(ctx.names?.[l]?.[n]);

  let html = `<h3>${H('lab.neuronTitle', { n: n + 1, l: l + 1 })} <span class="muted">(${escapeHtml(layerShortName(l, layers.length).toLowerCase())})</span></h3>`;
  if (name) html += `<p>${H('lab.means')} <b>${escapeHtml(name)}</b></p>`;

  html += a === null
    ? `<p>${H('lab.activation')} <span class="muted">${H('lab.notComputed')}</span></p>`
    : `<p>${H('lab.activation')} ${num(a, 3)}</p>`;
  // Пространство может перевести значение в понятные единицы (например, нормированную цену → млн ₸)
  const unit = a !== null ? ctx.valueText?.(l, n, a) : null;
  if (unit) html += `<p>${unit}</p>`;

  if (l === 0) {
    html += `<p class="muted">${H('lab.inputNeuron')}</p>`;
  } else {
    const z = model.lastZ?.[l]?.[n];
    if (a !== null && z !== undefined) {
      html += `<p class="muted">${H('lab.weightedSum', { z: formatValue(z, 3), b: formatValue(biases[l - 1][n], 2), act, a: formatValue(a, 3) })}</p>`;
    }
    const incoming = weights[l - 1][n].map((w, i) => ({ i, w, x: values[l - 1][i] }));
    html += linkList(
      t('lab.incoming', { links: t('lab.links', { n: incoming.length }), l }),
      incoming.map(({ i, w, x }) => ({
        w,
        text: t('lab.from', { name: short(ctx, l - 1, i) }),
        extra: x !== null ? t('lab.contribution', { v: formatValue(w * x) }) : '',
      })),
    );
  }

  if (l < last) {
    const outgoing = weights[l].map((row, j) => ({ j, w: row[n] }));
    html += linkList(
      t('lab.outgoing', { links: t('lab.links', { n: outgoing.length }), l: l + 2 }),
      outgoing.map(({ j, w }) => ({ w, text: t('lab.to', { name: short(ctx, l + 1, j) }) })),
    );
  }
  return html;
}

function linkList(title, items) {
  const sorted = [...items].sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
  const shown = sorted.slice(0, MAX_LIST);
  const rest = sorted.length - shown.length;
  return `<p class="list-title">${title}${rest > 0 ? ` <span class="muted">${H('lab.strongest')}</span>` : ''}</p>
    <ul class="links">${shown.map(({ w, text, extra }) => `
      <li><span class="grow">${text}</span>${extra ? `<span class="muted">${extra}</span>` : ''}<span>w = ${num(w)}</span></li>`).join('')}
    </ul>${rest > 0 ? `<p class="muted small">${H('lab.andMore', { n: rest })}</p>` : ''}`;
}

function weightHtml({ gap, from, to }, ctx) {
  const { model, values } = ctx;
  const w = model.weights[gap][to][from];
  const x = values[gap][from];
  const a = short(ctx, gap, from), b = short(ctx, gap + 1, to);
  const effect = w >= 0 ? t('lab.posWeightHtml', { a, b }) : t('lab.negWeightHtml', { a, b });
  return `
    <h3>${t('lab.linkTitle', { a: full(ctx, gap, from), b: full(ctx, gap + 1, to) })}</h3>
    <p>${H('lab.weight')} ${num(w, 4)}</p>
    <p class="muted">${effect}</p>
    ${x !== null ? `<p>${H('lab.contributionNow', { w: formatValue(w), x: formatValue(x) })} ${num(w * x, 3)}</p>` : ''}`;
}

/** Короткий текст для всплывающей подсказки у курсора */
export function tooltipText(hover, ctx) {
  const plain = s => unq(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  if (hover.type === 'neuron') {
    const { layer: l, index: i } = hover;
    const a = ctx.values[l][i];
    const name = str(ctx.names?.[l]?.[i]);
    const unit = a !== null ? ctx.valueText?.(l, i, a) : null;
    return `${t('lab.tipNeuron', { l: l + 1, n: i + 1 })}${name ? ` (${name})` : ''} · ${a === null ? t('lab.tipNotComputed') : `a = ${formatValue(a, 3)}`}${unit ? ` · ${String(unit).replace(/<[^>]+>/g, '')}` : ''}`;
  }
  const { gap, from, to } = hover;
  return t('lab.tipLink', { a: plain(short(ctx, gap, from)), la: gap + 1, b: plain(short(ctx, gap + 1, to)), lb: gap + 2, w: formatValue(ctx.model.weights[gap][to][from], 3) });
}

/** Описание текущего этапа анимации forward-pass */
export function stageText(stage, model) {
  const l = stage >> 1;
  const total = model.layers.length;
  if (stage % 2 === 1) {
    return t('lab.stageLinks', { a: l + 1, b: l + 2 });
  }
  if (l === 0) return t('lab.stageInput');
  return t('lab.stageLayer', { l: l + 1, total, act: model.activationName(l) });
}

const OUTPUT_RANGE = ['sigmoid', 'tanh', 'relu', 'linear'];

/** Полоски значений выходного слоя (переиспользуется пространствами в своих объяснениях) */
export function outputBarsHtml(ctx, out, { percent = true } = {}) {
  const best = out.indexOf(Math.max(...out));
  const max = Math.max(1, ...out.map(Math.abs));
  const L = ctx.model.layers.length - 1;
  return `<ul class="bars">${out.map((v, j) => `
    <li class="${j === best ? 'best' : ''}">
      <span class="name">${unq(short(ctx, L, j))}</span>
      <span class="bar"><span style="width:${(Math.abs(v) / max * 100).toFixed(1)}%"></span></span>
      <span class="num">${fmtNum(v, 3)}</span>
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
    <p class="muted small">${H('lab.inputLabel')}${inputCaption ? ` (${escapeHtml(str(inputCaption))})` : ''}: [${input.map(v => formatValue(v)).join('; ')}]</p>
    <p>${t('lab.resultTextHtml', {
      numbers: t('lab.numbers', { n: input.length }), hidden: t('lab.hiddenLayers', { n: hidden }),
      best: short(ctx, L, best), out: formatValue(out[best], 3), z: formatValue(z), top: short(ctx, L - 1, top), c: formatValue(contrib[top]),
    })}
      ${OUTPUT_RANGE.includes(outAct) ? H(`lab.outRange.${outAct}`) : ''}</p>`;
}
