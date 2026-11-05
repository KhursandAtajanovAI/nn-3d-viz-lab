// Shared logic for checking space configs: used by tools/check-spaces.mjs (Node, at deploy time)
// and tools/check-spaces.html (the same check in the browser). No dependencies on Node or the DOM.
// Developer-facing messages are in English; the interface texts live in src/i18n/<lang>/.
import { CATEGORIES, FIDELITY } from '../src/engine/catalog.js';
import { KINDS, checkCustomKinds } from '../src/engine/stackKinds.js';
import { checkModelSpec, checkInput } from '../src/engine/spaceFormat.js';
import { LANGS, lang as currentLang, setLang, loadDict, str } from '../src/i18n/i18n.js';

// Must match VISUALIZERS in src/engine/boot.js (graph is for user spaces only)
const KNOWN_TYPES = new Set(['mlp', 'stack', 'tokens', 'scatter', 'surface', 'train', 'gridworld']);

/** Keys that exist in only one of the dictionaries (every string must be translated into every language) */
export async function checkDictionaries() {
  const dicts = await Promise.all(LANGS.map(l => loadDict(l)));
  const errors = [];
  LANGS.forEach((l, i) => {
    for (const key of Object.keys(dicts[i])) {
      LANGS.forEach((other, j) => {
        if (i !== j && !(key in dicts[j])) errors.push(`i18n: key "${key}" is in "${l}" but missing in "${other}"`);
      });
    }
  });
  return errors;
}

/**
 * @param {string[]} ids — space ids from the manifest
 * @param {(id: string) => Promise<object>} load — load the config spaces/<id>.js (export default)
 * @returns {Promise<string[]>} list of errors
 */
export async function checkSpaces(ids, load) {
  const categories = new Set(CATEGORIES.filter(c => !c.user).map(c => c.id));
  const errors = await checkDictionaries();
  const startLang = currentLang;

  for (const id of ids) {
    const where = `spaces/${id}.js`;
    let space;
    try {
      space = await load(id);
    } catch (e) {
      errors.push(`${where}: cannot be imported — ${e.message}`);
      continue;
    }
    const m = space?.meta;
    if (!m) { errors.push(`${where}: no export default { meta: … }`); continue; }
    if (m.id !== id) errors.push(`${where}: meta.id = "${m.id}", but it must match the file name "${id}"`);
    if (!m.title) errors.push(`${where}: meta.title is empty`);
    if (!m.summary) errors.push(`${where}: meta.summary is empty`);
    if (!categories.has(m.category)) errors.push(`${where}: unknown category "${m.category}" (see src/engine/catalog.js)`);
    if (!m.uses) errors.push(`${where}: meta.uses is empty ("where it is used")`);
    if (m.fidelity && !FIDELITY[m.fidelity]) errors.push(`${where}: unknown meta.fidelity "${m.fidelity}"`);
    const type = space.type ?? 'mlp';
    if (!KNOWN_TYPES.has(type)) errors.push(`${where}: unknown type "${type}"`);
    if (type === 'stack') {
      if (!Array.isArray(space.layers) || space.layers.length < 2) errors.push(`${where}: type "stack" needs a layers array`);
      // Custom layer kinds (the kinds field): their description is checked, and a layer with such a kind counts as known
      checkCustomKinds(space.kinds).forEach(e => errors.push(`${where}: ${e}`));
      (space.layers ?? []).forEach((layer, i) => {
        if (!KINDS[layer.kind] && !space.kinds?.[layer.kind]) errors.push(`${where}: layer ${i} — unknown kind "${layer.kind}" (add it to kinds or use a built-in one)`);
        if (!Array.isArray(layer.shape) || !layer.shape.length || layer.shape.some(v => !(v > 0))) errors.push(`${where}: layer ${i} — invalid shape`);
      });
      for (const s of space.skips ?? []) {
        if (!space.layers?.[s.from] || !space.layers?.[s.to]) errors.push(`${where}: skip ${s.from}→${s.to} refers to a layer that does not exist`);
      }
    }
    // Smoke runs of the space logic (everything that does not need a browser), in every language
    try {
      for (const l of LANGS) {
        await setLang(l);
        if (type === 'tokens') {
          if (typeof space.process !== 'function') throw new Error('process(text) is required');
          for (const preset of space.presets ?? []) {
            const text = str(preset);
            const tr = space.process(text);
            if (!tr.tokens?.length || tr.embeddings?.length !== tr.tokens.length) throw new Error(`[${l}] process("${text}") returned an invalid trace`);
          }
        }
        if (type === 'scatter') {
          const state = await space.setup({ rnd: Math.random, onProgress() {} });
          if (!state.points?.length) throw new Error(`[${l}] setup() returned no points`);
          for (const c of space.controls ?? []) {
            if (c.kind === 'select') for (const o of c.options) c.run(state, o.value);
            else if (c.kind === 'range') c.run(state, c.value);
            else c.run(state);
          }
        }
      }
      if (type === 'surface') {
        for (const s of space.surfaces ?? []) {
          const v = s.f(...s.start);
          if (!Number.isFinite(v)) throw new Error(`surface ${s.id}: f(start) is not a number`);
        }
      }
      if (type === 'train') {
        if (!space.model?.layers) throw new Error('model.layers is required');
        if (space.mode === 'backprop' && !space.samples?.length) throw new Error('backprop mode needs samples');
      }
      if (type === 'gridworld') {
        const cells = (space.map ?? []).join('');
        if (!cells.includes('S') || !cells.includes('G')) throw new Error('map needs a start S and a goal G');
      }
    } catch (e) {
      errors.push(`${where}: error in the space logic — ${e.message}`);
    }
    if (type === 'mlp') {
      if (!space.model?.layers && !space.createModel) errors.push(`${where}: type "mlp" needs model.layers or createModel()`);
      // A model described by data (including custom weights model.weights / model.biases) goes through the same validator as import
      if (space.model && !space.createModel) {
        checkModelSpec(space.model).forEach(e => errors.push(`${where}: ${e}`));
        if (space.model.layers) {
          (space.inputs ?? []).forEach((p, k) => checkInput(p.values, space.model.layers[0])
            .forEach(e => errors.push(`${where}: inputs[${k}] — ${e}`)));
        }
      }
      if (space.createModel) {
        try {
          const model = space.createModel();
          model.forward(space.inputs?.[0]?.values ?? model.randomInput());
        } catch (e) {
          errors.push(`${where}: createModel()/forward() fails — ${e.message}`);
        }
      }
    }
  }
  await setLang(startLang);
  return errors;
}
