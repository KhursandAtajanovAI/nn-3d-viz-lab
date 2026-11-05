// Формат пользовательского пространства «nn3d-space» (version 1) и его проверка.
// Модуль без зависимостей: один и тот же валидатор работает в браузере (импорт файла, конструктор)
// и в Node (tools/check-spaces.mjs). Сообщения об ошибках — по-русски, с указанием места.
//
// Файл пространства:
// {
//   "format": "nn3d-space", "version": 1,
//   "mode": "standard",            // "code" зарезервирован: пространство с кодом пока в доработке
//   "type": "mlp" | "graph",
//   "meta": { "title", "summary", "uses", "tags": [] },
//   "model": { "layers": [2,3,1], "activation", "outputActivation", "weights"?, "biases"? },   // type mlp
//   "names": { "input": [], "output": [] }, "inputs": [{ "name", "values": [] }],                // type mlp
//   "graph": { "nodes": [...], "edges": [...], "view": {...} }, "datasets": [...],              // type graph
//   "trained": [{ "node", "sig", "weights": [[…]], "history": [{ epoch, trainLoss, … }] }],   // type graph, необязательно
//   "text": { "intro": "обычный текст", "sections": [{ "title", "text" }] }
// }
// Неизвестные поля отбрасываются (о них сообщается в warnings), строки обрезаются по лимитам.
// HTML в текстах не поддерживается: тексты показываются как обычный текст.

import { t } from '../i18n/i18n.js';

export const FORMAT = 'nn3d-space';
export const FORMAT_VERSION = 1;

export const LIMITS = {
  fileBytes: 10 * 1024 * 1024,   // размер файла при импорте
  layers: 32,                    // слоёв в полносвязной сети (вместе с входным и выходным)
  neurons: 64,                   // нейронов в одном слое
  weightAbs: 1e6,                // |вес| и |смещение|
  inputs: 50,                    // готовых входов
  title: 120, summary: 600, uses: 300, tag: 40, tags: 12,
  intro: 6000, sections: 12, sectionTitle: 120, sectionText: 6000, name: 60,
  graphNodes: 200, graphEdges: 600, paramString: 2000,
  datasets: 20, datasetRows: 20000, datasetColumns: 100, cell: 200,
  images: 2000, imageSide: 64,
  trainedValues: 1000000,        // чисел во всех сохранённых обученных весах
};

export const ACTIVATIONS_HIDDEN = ['tanh', 'relu', 'sigmoid'];
export const ACTIVATIONS_OUTPUT = ['sigmoid', 'linear', 'softmax', 'tanh', 'relu'];

/** id пользовательского пространства или датасета: u-/d- + 6…24 строчных латинских букв и цифр */
export const isValidUserId = id => /^u-[a-z0-9]{6,24}$/.test(id ?? '');
export const isValidDatasetId = id => /^d-[a-z0-9]{6,24}$/.test(id ?? '');

export function newId(prefix = 'u') {
  const rnd = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${prefix}-${Date.now().toString(36)}${rnd}`.slice(0, 2 + 24);
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// ---------- Полносвязная сеть: архитектура и веса ----------

/** Проверить архитектуру [n0, n1, …]; возвращает список ошибок */
export function checkLayers(layers) {
  if (!Array.isArray(layers)) return [t('fmt.layersNotList')];
  const errors = [];
  if (layers.length < 2) errors.push(t('fmt.layersMin'));
  if (layers.length > LIMITS.layers) errors.push(t('fmt.layersMax', { max: LIMITS.layers, n: layers.length }));
  layers.forEach((n, l) => {
    if (!Number.isInteger(n) || n < 1 || n > LIMITS.neurons) {
      errors.push(t('fmt.layerNeurons', { l: l + 1, max: LIMITS.neurons, v: JSON.stringify(n) }));
    }
  });
  return errors;
}

const gapName = l => t('fmt.gapName', { a: l + 1, b: l + 2 });
const notList = () => t('fmt.notList');

/**
 * Проверить веса под архитектуру: weights[l][j][i] — от нейрона i слоя l к нейрону j слоя l+1,
 * biases[l][j] — смещение нейрона j слоя l+1. Возвращает список ошибок (пустой — всё верно).
 */
export function checkWeights(layers, weights, biases) {
  const errors = [];
  const push = msg => { if (errors.length < 20) errors.push(msg); };
  if (!Array.isArray(weights)) return [t('fmt.weightsNotList')];
  if (!Array.isArray(biases)) return [t('fmt.biasesNotList')];
  const gaps = layers.length - 1;
  if (weights.length !== gaps) push(t('fmt.weightsCount', { layers: layers.length, need: gaps, got: weights.length }));
  if (biases.length !== gaps) push(t('fmt.biasesCount', { layers: layers.length, need: gaps, got: biases.length }));
  for (let l = 0; l < Math.min(gaps, weights.length); l++) {
    const W = weights[l], nIn = layers[l], nOut = layers[l + 1];
    if (!Array.isArray(W) || W.length !== nOut) {
      push(t('fmt.weightsRows', { gap: gapName(l), need: nOut, layer: l + 2, got: Array.isArray(W) ? W.length : notList() }));
      continue;
    }
    W.forEach((row, j) => {
      if (!Array.isArray(row) || row.length !== nIn) {
        push(t('fmt.weightsRow', { gap: gapName(l), row: j + 1, need: nIn, layer: l + 1, got: Array.isArray(row) ? row.length : notList() }));
        return;
      }
      row.forEach((w, i) => {
        if (!isNum(w)) push(t('fmt.weightNaN', { gap: gapName(l), i: i + 1, j: j + 1, v: JSON.stringify(w) }));
        else if (Math.abs(w) > LIMITS.weightAbs) push(t('fmt.weightBig', { gap: gapName(l), i: i + 1, j: j + 1, max: String(LIMITS.weightAbs) }));
      });
    });
  }
  for (let l = 0; l < Math.min(gaps, biases.length); l++) {
    const B = biases[l], nOut = layers[l + 1];
    if (!Array.isArray(B) || B.length !== nOut) {
      push(t('fmt.biasesRow', { layer: l + 2, need: nOut, got: Array.isArray(B) ? B.length : notList() }));
      continue;
    }
    B.forEach((b, j) => {
      if (!isNum(b)) push(t('fmt.biasNaN', { layer: l + 2, j: j + 1, v: JSON.stringify(b) }));
      else if (Math.abs(b) > LIMITS.weightAbs) push(t('fmt.biasBig', { layer: l + 2, j: j + 1, max: String(LIMITS.weightAbs) }));
    });
  }
  return errors;
}

/** Проверить вектор входа под входной слой */
export function checkInput(values, n) {
  if (!Array.isArray(values)) return [t('fmt.inputNotList')];
  if (values.length !== n) return [t('fmt.inputLength', { n, got: values.length })];
  const bad = values.findIndex(v => !isNum(v));
  return bad >= 0 ? [t('fmt.inputNaN', { i: bad + 1, v: JSON.stringify(values[bad]) })] : [];
}

/** Разобрать строку чисел «0.5, -1, 2e-3» (запятые, пробелы, точка с запятой). null вместо нечисел */
export function parseNumberList(text) {
  return String(text ?? '').split(/[\s,;]+/).filter(Boolean).map(t => {
    const v = Number(t.replace(/^\+/, ''));
    return Number.isFinite(v) ? v : null;
  });
}

/**
 * Полная проверка описания модели { layers, activation, outputActivation, weights?, biases? }.
 * Используется встроенными пространствами (model.weights) и импортом.
 */
export function checkModelSpec(model) {
  if (!isObj(model)) return [t('fmt.modelNotObject')];
  const errors = checkLayers(model.layers);
  if (model.activation !== undefined && !ACTIVATIONS_HIDDEN.includes(model.activation)) {
    errors.push(t('fmt.badActivation', { field: 'model.activation', list: ACTIVATIONS_HIDDEN.join(', '), v: JSON.stringify(model.activation) }));
  }
  if (model.outputActivation !== undefined && !ACTIVATIONS_OUTPUT.includes(model.outputActivation)) {
    errors.push(t('fmt.badActivation', { field: 'model.outputActivation', list: ACTIVATIONS_OUTPUT.join(', '), v: JSON.stringify(model.outputActivation) }));
  }
  if (!errors.length && (model.weights !== undefined || model.biases !== undefined)) {
    errors.push(...checkWeights(model.layers, model.weights, model.biases));
  }
  return errors;
}

// ---------- Файл пространства ----------

function cleanText(raw, warn) {
  if (raw === undefined) return { intro: '', sections: [] };
  if (!isObj(raw)) { warn(t('fmt.textNotObject')); return { intro: '', sections: [] }; }
  const sections = Array.isArray(raw.sections) ? raw.sections.slice(0, LIMITS.sections)
    .filter(isObj).map(s => ({ title: str(s.title, LIMITS.sectionTitle), text: str(s.text, LIMITS.sectionText) }))
    .filter(s => s.title || s.text) : [];
  return { intro: str(raw.intro, LIMITS.intro), sections };
}

function cleanMeta(raw, errors) {
  const m = isObj(raw) ? raw : {};
  const title = str(m.title, LIMITS.title).trim();
  if (!title) errors.push(t('fmt.noTitle'));
  return {
    title,
    summary: str(m.summary, LIMITS.summary),
    uses: str(m.uses, LIMITS.uses),
    tags: Array.isArray(m.tags) ? m.tags.filter(t => typeof t === 'string' && t.trim()).slice(0, LIMITS.tags).map(t => t.trim().slice(0, LIMITS.tag)) : [],
  };
}

function cleanMlp(raw, errors) {
  const model = isObj(raw.model) ? raw.model : null;
  const errs = checkModelSpec(model);
  if (errs.length) { errors.push(...errs); return null; }
  const out = {
    model: {
      layers: model.layers.slice(),
      activation: model.activation ?? 'tanh',
      outputActivation: model.outputActivation ?? 'sigmoid',
    },
  };
  if (model.weights !== undefined) {
    out.model.weights = model.weights.map(W => W.map(r => r.slice()));
    out.model.biases = model.biases.map(b => b.slice());
  }
  const names = isObj(raw.names) ? raw.names : {};
  const nameList = (list, n) => (Array.isArray(list) ? list.slice(0, n).map(v => str(v, LIMITS.name)) : []);
  out.names = { input: nameList(names.input, model.layers[0]), output: nameList(names.output, model.layers.at(-1)) };
  out.inputs = [];
  (Array.isArray(raw.inputs) ? raw.inputs.slice(0, LIMITS.inputs) : []).forEach((p, k) => {
    if (!isObj(p)) return;
    const e = checkInput(p.values, model.layers[0]);
    if (e.length) errors.push(t('fmt.inputItem', { k: k + 1, name: str(p.name, 40), err: e[0] }));
    else out.inputs.push({ name: str(p.name, LIMITS.name) || t('fmt.inputDefaultName', { n: k + 1 }), values: p.values.slice() });
  });
  return out;
}

const PARAM_OK = v => v === null || typeof v === 'boolean' || isNum(v) || typeof v === 'string';

function cleanGraph(raw, errors) {
  const g = isObj(raw.graph) ? raw.graph : null;
  if (!g) { errors.push(t('fmt.graphNotObject')); return null; }
  const nodes = Array.isArray(g.nodes) ? g.nodes : [];
  const edges = Array.isArray(g.edges) ? g.edges : [];
  if (nodes.length > LIMITS.graphNodes) errors.push(t('fmt.graphNodesMax', { n: LIMITS.graphNodes }));
  if (edges.length > LIMITS.graphEdges) errors.push(t('fmt.graphEdgesMax', { n: LIMITS.graphEdges }));
  const ids = new Set();
  const outNodes = [];
  nodes.slice(0, LIMITS.graphNodes).forEach((n, k) => {
    if (!isObj(n) || typeof n.id !== 'string' || !/^n[0-9a-z]{1,16}$/.test(n.id) || ids.has(n.id)) {
      errors.push(t('fmt.nodeBadId', { k: k + 1 }));
      return;
    }
    if (typeof n.block !== 'string' || !/^[a-z][a-z0-9-]{0,40}$/.test(n.block)) {
      errors.push(t('fmt.nodeBadBlock', { k: k + 1 }));
      return;
    }
    ids.add(n.id);
    const params = {};
    if (isObj(n.params)) {
      for (const [key, v] of Object.entries(n.params).slice(0, 40)) {
        if (/^[a-zA-Z][a-zA-Z0-9]{0,30}$/.test(key) && PARAM_OK(v)) params[key] = typeof v === 'string' ? v.slice(0, LIMITS.paramString) : v;
      }
    }
    outNodes.push({ id: n.id, block: n.block, x: isNum(n.x) ? n.x : 0, y: isNum(n.y) ? n.y : 0, params });
  });
  const port = p => typeof p === 'string' && /^[a-z][a-zA-Z0-9]{0,30}$/.test(p);
  const outEdges = [];
  edges.slice(0, LIMITS.graphEdges).forEach((e, k) => {
    if (!isObj(e) || !Array.isArray(e.from) || !Array.isArray(e.to) || !ids.has(e.from[0]) || !ids.has(e.to[0]) || !port(e.from[1]) || !port(e.to[1])) {
      errors.push(t('fmt.edgeBad', { k: k + 1 }));
      return;
    }
    outEdges.push({ from: [e.from[0], e.from[1]], to: [e.to[0], e.to[1]] });
  });
  const v = isObj(g.view) ? g.view : {};
  const view = { x: isNum(v.x) ? v.x : 0, y: isNum(v.y) ? v.y : 0, k: isNum(v.k) ? Math.min(3, Math.max(0.2, v.k)) : 1 };
  return { graph: { nodes: outNodes, edges: outEdges, view } };
}

/** Проверить встроенный в файл датасет (таблица или набор картинок) */
export function cleanDataset(d, errors, where = t('fmt.dataset')) {
  if (!isObj(d) || !isValidDatasetId(d.id)) { errors.push(t('fmt.dsBadId', { where })); return null; }
  const name = str(d.name, LIMITS.name) || t('fmt.untitled');
  if (d.kind === 'table') {
    const columns = Array.isArray(d.columns) ? d.columns.slice(0, LIMITS.datasetColumns).map(c => str(String(c ?? ''), LIMITS.name)) : [];
    if (!columns.length) { errors.push(t('fmt.dsNoColumns', { where, name })); return null; }
    if (!Array.isArray(d.rows) || d.rows.length > LIMITS.datasetRows) { errors.push(t('fmt.dsRowsMax', { where, name, n: LIMITS.datasetRows })); return null; }
    const rows = [];
    for (const r of d.rows) {
      if (!Array.isArray(r)) { errors.push(t('fmt.dsRowNotList', { where, name })); return null; }
      rows.push(columns.map((_, c) => {
        const v = r[c];
        return isNum(v) ? v : typeof v === 'string' ? v.slice(0, LIMITS.cell) : null;
      }));
    }
    return { id: d.id, name, kind: 'table', columns, rows };
  }
  if (d.kind === 'images') {
    const w = d.width, h = d.height;
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 2 || h < 2 || w > LIMITS.imageSide || h > LIMITS.imageSide) {
      errors.push(t('fmt.dsImageSide', { where, name, max: LIMITS.imageSide })); return null;
    }
    const items = Array.isArray(d.items) ? d.items : [];
    if (!items.length || items.length > LIMITS.images) { errors.push(t('fmt.dsImagesCount', { where, name, n: LIMITS.images })); return null; }
    const out = [];
    for (const it of items) {
      if (!isObj(it) || !Array.isArray(it.pixels) || it.pixels.length !== w * h || it.pixels.some(p => !isNum(p) || p < 0 || p > 255)) {
        errors.push(t('fmt.dsImagePixels', { where, name, n: w * h })); return null;
      }
      out.push({ label: str(it.label, LIMITS.name), pixels: it.pixels.map(Math.round) });
    }
    return { id: d.id, name, kind: 'images', width: w, height: h, items: out };
  }
  errors.push(t('fmt.dsBadKind', { where, name }));
  return null;
}

/**
 * Сохранённые обученные веса блоков «Обучение» (необязательное поле trained).
 * Испорченная запись не мешает открыть файл: она отбрасывается с предупреждением, модель просто обучится заново.
 */
function cleanTrained(raw, nodes, warn) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) { warn(t('fmt.trainedNotList')); return []; }
  const trainNodes = new Set(nodes.filter(n => n.block === 'train').map(n => n.id));
  const out = [];
  let total = 0;
  raw.slice(0, LIMITS.graphNodes).forEach((e, k) => {
    const where = `trained[${k + 1}]`;
    if (!isObj(e) || !trainNodes.has(e.node) || out.some(x => x.node === e.node)) { warn(t('fmt.trainedNoNode', { where })); return; }
    if (typeof e.sig !== 'string' || !/^[0-9a-f]{1,64}$/.test(e.sig)) { warn(t('fmt.trainedBadSig', { where })); return; }
    const W = e.weights;
    if (!Array.isArray(W) || !W.length || W.length > 1000 || W.some(a => !Array.isArray(a))) { warn(t('fmt.trainedBadWeights', { where })); return; }
    const n = W.reduce((a, w) => a + w.length, 0);
    if (total + n > LIMITS.trainedValues) { warn(t('fmt.trainedTooMany', { where, max: LIMITS.trainedValues })); return; }
    if (W.some(a => a.some(v => !isNum(v) || Math.abs(v) > LIMITS.weightAbs))) { warn(t('fmt.trainedBadValues', { where, max: String(LIMITS.weightAbs) })); return; }
    const num = v => (isNum(v) ? v : null);
    const history = (Array.isArray(e.history) ? e.history.slice(0, 500) : []).filter(isObj).map((h, i) => ({
      epoch: Number.isInteger(h.epoch) ? h.epoch : i + 1,
      trainLoss: num(h.trainLoss), trainAcc: num(h.trainAcc), testLoss: num(h.testLoss), testAcc: num(h.testAcc),
    }));
    if (!history.length) { warn(t('fmt.trainedNoHistory', { where })); return; }
    total += n;
    out.push({ node: e.node, sig: e.sig, weights: W.map(a => a.slice()), history });
  });
  return out;
}

const KNOWN_TOP = new Set(['format', 'version', 'mode', 'type', 'meta', 'model', 'names', 'inputs', 'graph', 'datasets', 'trained', 'text', 'settings', 'exportedAt']);

/**
 * Проверить и «очистить» файл пространства. Неизвестные поля отбрасываются.
 * @returns {{ ok: boolean, space: object|null, errors: string[], warnings: string[] }}
 */
export function validateSpaceFile(raw) {
  const errors = [], warnings = [];
  if (!isObj(raw)) return { ok: false, space: null, errors: [t('fmt.notObject')], warnings };
  if (raw.format !== FORMAT) return { ok: false, space: null, errors: [t('fmt.notFormat', { format: FORMAT })], warnings };
  if (raw.version !== FORMAT_VERSION) {
    return { ok: false, space: null, errors: [t('fmt.badVersion', { v: JSON.stringify(raw.version), need: FORMAT_VERSION })], warnings };
  }
  const mode = raw.mode ?? 'standard';
  if (mode === 'code') return { ok: false, space: null, errors: [t('fmt.codeMode')], warnings };
  if (mode !== 'standard') return { ok: false, space: null, errors: [t('fmt.badMode', { v: JSON.stringify(mode) })], warnings };
  const type = raw.type ?? 'mlp';
  if (type !== 'mlp' && type !== 'graph') return { ok: false, space: null, errors: [t('fmt.badType', { v: JSON.stringify(type) })], warnings };

  const unknown = Object.keys(raw).filter(k => !KNOWN_TOP.has(k));
  if (unknown.length) warnings.push(t('fmt.unknownFields', { list: unknown.slice(0, 10).join(', ') }));

  const space = { format: FORMAT, version: FORMAT_VERSION, mode, type, meta: cleanMeta(raw.meta, errors) };
  space.text = cleanText(raw.text, w => warnings.push(w));
  const settings = isObj(raw.settings) ? raw.settings : {};
  space.settings = {};
  if (Array.isArray(settings.customInput) && !checkInput(settings.customInput, raw.model?.layers?.[0] ?? -1).length) space.settings.customInput = settings.customInput.slice();
  if (isNum(settings.speed)) space.settings.speed = Math.min(4, Math.max(0.5, settings.speed));

  if (type === 'mlp') Object.assign(space, cleanMlp(raw, errors) ?? {});
  else {
    Object.assign(space, cleanGraph(raw, errors) ?? {});
    space.datasets = [];
    (Array.isArray(raw.datasets) ? raw.datasets.slice(0, LIMITS.datasets) : []).forEach((d, k) => {
      const ds = cleanDataset(d, errors, `datasets[${k + 1}]`);
      if (ds) space.datasets.push(ds);
    });
    const trained = cleanTrained(raw.trained, space.graph?.nodes ?? [], w => warnings.push(w));
    if (trained.length) space.trained = trained;
  }
  return { ok: errors.length === 0, space: errors.length ? null : space, errors: errors.slice(0, 20), warnings };
}

/** Прочитать текст файла: JSON + проверка + лимит размера */
export function parseSpaceFileText(text) {
  if (typeof text !== 'string') return { ok: false, space: null, errors: [t('fmt.readFailed')], warnings: [] };
  if (text.length > LIMITS.fileBytes) {
    return { ok: false, space: null, errors: [t('fmt.tooBig', { mb: { num: text.length / 1048576, d: 1 }, max: LIMITS.fileBytes / 1048576 })], warnings: [] };
  }
  let raw;
  try { raw = JSON.parse(text); } catch (e) {
    return { ok: false, space: null, errors: [t('fmt.badJson', { msg: e.message })], warnings: [] };
  }
  return validateSpaceFile(raw);
}

/** Текст → безопасный HTML: всё экранируется, пустая строка разделяет абзацы, одиночный перенос — <br> */
export function textToHtml(text) {
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return String(text ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${esc(p).replace(/\n/g, '<br />')}</p>`).join('');
}
