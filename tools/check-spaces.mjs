// Проверка конфигов пространств перед деплоем: node tools/check-spaces.mjs
// Импортирует каждый spaces/<id>.js из манифеста и проверяет обязательные поля.
// Конфиги не должны импортировать Three.js — иначе импорт здесь упадёт (и каталог станет тяжёлым).
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES, FIDELITY } from '../src/engine/catalog.js';
import { KINDS } from '../src/engine/stackKinds.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const ids = JSON.parse(await readFile(`${root}spaces/manifest.json`, 'utf8'));
const categories = new Set(CATEGORIES.map(c => c.id));
// Должен совпадать с VISUALIZERS в src/engine/boot.js
const KNOWN_TYPES = new Set(['mlp', 'stack', 'tokens', 'scatter', 'surface', 'train', 'gridworld']);
const errors = [];

for (const id of ids) {
  const where = `spaces/${id}.js`;
  let space;
  try {
    space = (await import(pathToFileURL(`${root}${where}`).href)).default;
  } catch (e) {
    errors.push(`${where}: не импортируется — ${e.message}`);
    continue;
  }
  const m = space?.meta;
  if (!m) { errors.push(`${where}: нет export default { meta: … }`); continue; }
  if (m.id !== id) errors.push(`${where}: meta.id = "${m.id}", а должен совпадать с именем файла "${id}"`);
  if (!m.title) errors.push(`${where}: не заполнен meta.title`);
  if (!m.summary) errors.push(`${where}: не заполнен meta.summary`);
  if (!categories.has(m.category)) errors.push(`${where}: неизвестная категория "${m.category}" (см. src/engine/catalog.js)`);
  if (!m.uses) errors.push(`${where}: не заполнен meta.uses («где применяется»)`);
  if (m.fidelity && !FIDELITY[m.fidelity]) errors.push(`${where}: неизвестный meta.fidelity "${m.fidelity}"`);
  const type = space.type ?? 'mlp';
  if (!KNOWN_TYPES.has(type)) errors.push(`${where}: неизвестный type "${type}"`);
  if (type === 'stack') {
    if (!Array.isArray(space.layers) || space.layers.length < 2) errors.push(`${where}: для type "stack" нужен массив layers`);
    (space.layers ?? []).forEach((L, i) => {
      if (!KINDS[L.kind]) errors.push(`${where}: слой ${i} — неизвестный kind "${L.kind}"`);
      if (!Array.isArray(L.shape) || !L.shape.length || L.shape.some(v => !(v > 0))) errors.push(`${where}: слой ${i} — неверная shape`);
    });
    for (const s of space.skips ?? []) {
      if (!space.layers?.[s.from] || !space.layers?.[s.to]) errors.push(`${where}: skip ${s.from}→${s.to} ссылается на несуществующий слой`);
    }
  }
  // «Дымовые» прогоны логики пространств (всё, что не требует браузера)
  try {
    if (type === 'tokens') {
      if (typeof space.process !== 'function') throw new Error('нужна функция process(text)');
      for (const text of space.presets ?? []) {
        const tr = space.process(text);
        if (!tr.tokens?.length || tr.embeddings?.length !== tr.tokens.length) throw new Error(`process("${text}") вернул некорректную трассу`);
      }
    }
    if (type === 'scatter') {
      const state = await space.setup({ rnd: Math.random, onProgress() {} });
      if (!state.points?.length) throw new Error('setup() не вернул точки');
      for (const c of space.controls ?? []) {
        if (c.kind === 'select') for (const o of c.options) c.run(state, o.value);
        else if (c.kind === 'range') c.run(state, c.value);
        else c.run(state);
      }
    }
    if (type === 'surface') {
      for (const s of space.surfaces ?? []) {
        const v = s.f(...s.start);
        if (!Number.isFinite(v)) throw new Error(`поверхность ${s.id}: f(start) не число`);
      }
    }
    if (type === 'train') {
      if (!space.model?.layers) throw new Error('нужен model.layers');
      if (space.mode === 'backprop' && !space.samples?.length) throw new Error('для режима backprop нужны samples');
    }
    if (type === 'gridworld') {
      const cells = (space.map ?? []).join('');
      if (!cells.includes('S') || !cells.includes('G')) throw new Error('в map нужны старт S и цель G');
    }
  } catch (e) {
    errors.push(`${where}: ошибка в логике пространства — ${e.message}`);
  }
  if (type === 'mlp' && !space.model?.layers && !space.createModel) {
    errors.push(`${where}: для type "mlp" нужен model.layers или createModel()`);
  }
  if (type === 'mlp' && space.createModel) {
    try {
      const model = space.createModel();
      model.forward(space.inputs?.[0]?.values ?? model.randomInput());
    } catch (e) {
      errors.push(`${where}: createModel()/forward() падает — ${e.message}`);
    }
  }
}

if (errors.length) {
  console.error(`Ошибки в пространствах (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Пространства в порядке: ${ids.length} (${ids.join(', ')})`);
