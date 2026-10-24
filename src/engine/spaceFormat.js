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
//   "text": { "intro": "обычный текст", "sections": [{ "title", "text" }] }
// }
// Неизвестные поля отбрасываются (о них сообщается в warnings), строки обрезаются по лимитам.
// HTML в текстах не поддерживается: тексты показываются как обычный текст.

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
  if (!Array.isArray(layers)) return ['Архитектура должна быть списком чисел, например [2, 3, 1]'];
  const errors = [];
  if (layers.length < 2) errors.push('Нужно минимум 2 слоя: входной и выходной');
  if (layers.length > LIMITS.layers) errors.push(`Слоёв не больше ${LIMITS.layers} (сейчас ${layers.length})`);
  layers.forEach((n, l) => {
    if (!Number.isInteger(n) || n < 1 || n > LIMITS.neurons) {
      errors.push(`Слой ${l + 1}: число нейронов должно быть целым от 1 до ${LIMITS.neurons} (сейчас ${JSON.stringify(n)})`);
    }
  });
  return errors;
}

const gapName = l => `связи слоя ${l + 1} → ${l + 2}`;

/**
 * Проверить веса под архитектуру: weights[l][j][i] — от нейрона i слоя l к нейрону j слоя l+1,
 * biases[l][j] — смещение нейрона j слоя l+1. Возвращает список ошибок (пустой — всё верно).
 */
export function checkWeights(layers, weights, biases) {
  const errors = [];
  const push = msg => { if (errors.length < 20) errors.push(msg); };
  if (!Array.isArray(weights)) return ['weights: нужен список матриц весов — по одной на каждую пару соседних слоёв'];
  if (!Array.isArray(biases)) return ['biases: нужен список смещений — по одному на каждый слой, кроме входного'];
  const gaps = layers.length - 1;
  if (weights.length !== gaps) push(`weights: для ${layers.length} слоёв нужно матриц весов: ${gaps}, а задано: ${weights.length}`);
  if (biases.length !== gaps) push(`biases: для ${layers.length} слоёв нужно списков смещений: ${gaps}, а задано: ${biases.length}`);
  for (let l = 0; l < Math.min(gaps, weights.length); l++) {
    const W = weights[l], nIn = layers[l], nOut = layers[l + 1];
    if (!Array.isArray(W) || W.length !== nOut) {
      push(`weights, ${gapName(l)}: нужно строк: ${nOut} (по нейронам слоя ${l + 2}), а задано: ${Array.isArray(W) ? W.length : 'не список'}`);
      continue;
    }
    W.forEach((row, j) => {
      if (!Array.isArray(row) || row.length !== nIn) {
        push(`weights, ${gapName(l)}, строка ${j + 1}: нужно чисел: ${nIn} (по нейронам слоя ${l + 1}), а задано: ${Array.isArray(row) ? row.length : 'не список'}`);
        return;
      }
      row.forEach((w, i) => {
        if (!isNum(w)) push(`weights, ${gapName(l)}, вес ${i + 1} → ${j + 1}: не число (${JSON.stringify(w)})`);
        else if (Math.abs(w) > LIMITS.weightAbs) push(`weights, ${gapName(l)}, вес ${i + 1} → ${j + 1}: слишком большой (|w| ≤ ${LIMITS.weightAbs})`);
      });
    });
  }
  for (let l = 0; l < Math.min(gaps, biases.length); l++) {
    const B = biases[l], nOut = layers[l + 1];
    if (!Array.isArray(B) || B.length !== nOut) {
      push(`biases, слой ${l + 2}: нужно смещений: ${nOut}, а задано: ${Array.isArray(B) ? B.length : 'не список'}`);
      continue;
    }
    B.forEach((b, j) => {
      if (!isNum(b)) push(`biases, слой ${l + 2}, нейрон ${j + 1}: не число (${JSON.stringify(b)})`);
      else if (Math.abs(b) > LIMITS.weightAbs) push(`biases, слой ${l + 2}, нейрон ${j + 1}: слишком большое (|b| ≤ ${LIMITS.weightAbs})`);
    });
  }
  return errors;
}

const plural = (n, [one, few, many]) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

/** Проверить вектор входа под входной слой */
export function checkInput(values, n) {
  if (!Array.isArray(values)) return ['Вход должен быть списком чисел'];
  if (values.length !== n) return [`Во входном слое ${n} ${plural(n, ['нейрон', 'нейрона', 'нейронов'])}, а чисел во входе ${values.length}`];
  const bad = values.findIndex(v => !isNum(v));
  return bad >= 0 ? [`Вход, число ${bad + 1}: не конечное число (${JSON.stringify(values[bad])})`] : [];
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
  if (!isObj(model)) return ['model: нужен объект с полем layers'];
  const errors = checkLayers(model.layers);
  if (model.activation !== undefined && !ACTIVATIONS_HIDDEN.includes(model.activation)) {
    errors.push(`model.activation: допустимо ${ACTIVATIONS_HIDDEN.join(', ')} (сейчас ${JSON.stringify(model.activation)})`);
  }
  if (model.outputActivation !== undefined && !ACTIVATIONS_OUTPUT.includes(model.outputActivation)) {
    errors.push(`model.outputActivation: допустимо ${ACTIVATIONS_OUTPUT.join(', ')} (сейчас ${JSON.stringify(model.outputActivation)})`);
  }
  if (!errors.length && (model.weights !== undefined || model.biases !== undefined)) {
    errors.push(...checkWeights(model.layers, model.weights, model.biases));
  }
  return errors;
}

// ---------- Файл пространства ----------

function cleanText(raw, warn) {
  if (raw === undefined) return { intro: '', sections: [] };
  if (!isObj(raw)) { warn('text: ожидался объект — тексты пропущены'); return { intro: '', sections: [] }; }
  const sections = Array.isArray(raw.sections) ? raw.sections.slice(0, LIMITS.sections)
    .filter(isObj).map(s => ({ title: str(s.title, LIMITS.sectionTitle), text: str(s.text, LIMITS.sectionText) }))
    .filter(s => s.title || s.text) : [];
  return { intro: str(raw.intro, LIMITS.intro), sections };
}

function cleanMeta(raw, errors) {
  const m = isObj(raw) ? raw : {};
  const title = str(m.title, LIMITS.title).trim();
  if (!title) errors.push('meta.title: нужно название пространства');
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
    if (e.length) errors.push(`inputs[${k + 1}] «${str(p.name, 40)}»: ${e[0]}`);
    else out.inputs.push({ name: str(p.name, LIMITS.name) || `Вход ${k + 1}`, values: p.values.slice() });
  });
  return out;
}

const PARAM_OK = v => v === null || typeof v === 'boolean' || isNum(v) || typeof v === 'string';

function cleanGraph(raw, errors) {
  const g = isObj(raw.graph) ? raw.graph : null;
  if (!g) { errors.push('graph: нужен объект { nodes, edges }'); return null; }
  const nodes = Array.isArray(g.nodes) ? g.nodes : [];
  const edges = Array.isArray(g.edges) ? g.edges : [];
  if (nodes.length > LIMITS.graphNodes) errors.push(`graph.nodes: не больше ${LIMITS.graphNodes} блоков`);
  if (edges.length > LIMITS.graphEdges) errors.push(`graph.edges: не больше ${LIMITS.graphEdges} связей`);
  const ids = new Set();
  const outNodes = [];
  nodes.slice(0, LIMITS.graphNodes).forEach((n, k) => {
    if (!isObj(n) || typeof n.id !== 'string' || !/^n[0-9a-z]{1,16}$/.test(n.id) || ids.has(n.id)) {
      errors.push(`graph.nodes[${k + 1}]: неверный или повторяющийся id`);
      return;
    }
    if (typeof n.block !== 'string' || !/^[a-z][a-z0-9-]{0,40}$/.test(n.block)) {
      errors.push(`graph.nodes[${k + 1}]: неверное имя блока`);
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
      errors.push(`graph.edges[${k + 1}]: связь ссылается на несуществующий блок или порт`);
      return;
    }
    outEdges.push({ from: [e.from[0], e.from[1]], to: [e.to[0], e.to[1]] });
  });
  const v = isObj(g.view) ? g.view : {};
  const view = { x: isNum(v.x) ? v.x : 0, y: isNum(v.y) ? v.y : 0, k: isNum(v.k) ? Math.min(3, Math.max(0.2, v.k)) : 1 };
  return { graph: { nodes: outNodes, edges: outEdges, view } };
}

/** Проверить встроенный в файл датасет (таблица или набор картинок) */
export function cleanDataset(d, errors, where = 'датасет') {
  if (!isObj(d) || !isValidDatasetId(d.id)) { errors.push(`${where}: неверный id`); return null; }
  const name = str(d.name, LIMITS.name) || 'Без названия';
  if (d.kind === 'table') {
    const columns = Array.isArray(d.columns) ? d.columns.slice(0, LIMITS.datasetColumns).map(c => str(String(c ?? ''), LIMITS.name)) : [];
    if (!columns.length) { errors.push(`${where} «${name}»: нет столбцов`); return null; }
    if (!Array.isArray(d.rows) || d.rows.length > LIMITS.datasetRows) { errors.push(`${where} «${name}»: строк должно быть до ${LIMITS.datasetRows}`); return null; }
    const rows = [];
    for (const r of d.rows) {
      if (!Array.isArray(r)) { errors.push(`${where} «${name}»: строка не список`); return null; }
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
      errors.push(`${where} «${name}»: размер картинок от 2 до ${LIMITS.imageSide} пикселей`); return null;
    }
    const items = Array.isArray(d.items) ? d.items : [];
    if (!items.length || items.length > LIMITS.images) { errors.push(`${where} «${name}»: картинок должно быть от 1 до ${LIMITS.images}`); return null; }
    const out = [];
    for (const it of items) {
      if (!isObj(it) || !Array.isArray(it.pixels) || it.pixels.length !== w * h || it.pixels.some(p => !isNum(p) || p < 0 || p > 255)) {
        errors.push(`${where} «${name}»: картинка должна быть списком из ${w * h} чисел 0…255`); return null;
      }
      out.push({ label: str(it.label, LIMITS.name), pixels: it.pixels.map(Math.round) });
    }
    return { id: d.id, name, kind: 'images', width: w, height: h, items: out };
  }
  errors.push(`${where} «${name}»: неизвестный вид (нужно table или images)`);
  return null;
}

const KNOWN_TOP = new Set(['format', 'version', 'mode', 'type', 'meta', 'model', 'names', 'inputs', 'graph', 'datasets', 'text', 'settings', 'exportedAt']);

/**
 * Проверить и «очистить» файл пространства. Неизвестные поля отбрасываются.
 * @returns {{ ok: boolean, space: object|null, errors: string[], warnings: string[] }}
 */
export function validateSpaceFile(raw) {
  const errors = [], warnings = [];
  if (!isObj(raw)) return { ok: false, space: null, errors: ['Файл не похож на пространство: ожидался JSON-объект'], warnings };
  if (raw.format !== FORMAT) return { ok: false, space: null, errors: [`Это не файл пространства: поле format должно быть "${FORMAT}"`], warnings };
  if (raw.version !== FORMAT_VERSION) {
    return { ok: false, space: null, errors: [`Версия формата ${JSON.stringify(raw.version)} не поддерживается (нужна ${FORMAT_VERSION})`], warnings };
  }
  const mode = raw.mode ?? 'standard';
  if (mode === 'code') return { ok: false, space: null, errors: ['Пространства с кодом пока в доработке: такой файл открыть нельзя'], warnings };
  if (mode !== 'standard') return { ok: false, space: null, errors: [`Неизвестный режим mode: ${JSON.stringify(mode)}`], warnings };
  const type = raw.type ?? 'mlp';
  if (type !== 'mlp' && type !== 'graph') return { ok: false, space: null, errors: [`Неизвестный тип: ${JSON.stringify(type)} (поддерживаются mlp и graph)`], warnings };

  const unknown = Object.keys(raw).filter(k => !KNOWN_TOP.has(k));
  if (unknown.length) warnings.push(`Пропущены неизвестные поля: ${unknown.slice(0, 10).join(', ')}`);

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
  }
  return { ok: errors.length === 0, space: errors.length ? null : space, errors: errors.slice(0, 20), warnings };
}

/** Прочитать текст файла: JSON + проверка + лимит размера */
export function parseSpaceFileText(text) {
  if (typeof text !== 'string') return { ok: false, space: null, errors: ['Не удалось прочитать файл'], warnings: [] };
  if (text.length > LIMITS.fileBytes) {
    return { ok: false, space: null, errors: [`Файл слишком большой: ${(text.length / 1048576).toFixed(1)} МБ, допустимо до ${LIMITS.fileBytes / 1048576} МБ`], warnings: [] };
  }
  let raw;
  try { raw = JSON.parse(text); } catch (e) {
    return { ok: false, space: null, errors: [`Файл повреждён: это не корректный JSON (${e.message})`], warnings: [] };
  }
  return validateSpaceFile(raw);
}

/** Текст → безопасный HTML: всё экранируется, пустая строка разделяет абзацы, одиночный перенос — <br> */
export function textToHtml(text) {
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return String(text ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${esc(p).replace(/\n/g, '<br />')}</p>`).join('');
}
