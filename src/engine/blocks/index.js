// Реестр блоков визуального конструктора. Каждый блок — отдельный файл в этой папке:
//
//   export default {
//     id: 'my-block',                 // латиница, цифры и дефис (хранится в файле пространства)
//     title: L('blk.my-block.title'), group: 'data' | 'prep' | 'model' | 'train' | 'result',
//     info: L('blk.my-block.info'),   // подсказка в палитре; все тексты — L(...) из словарей src/i18n/<язык>/graph.js
//     inputs:  [{ id: 'data', title: L('blk.port.data'), types: ['data', 'split'], optional?: true }],
//     outputs: [{ id: 'out', title: L('blk.port.data'), type: 'data' }],   // type: 'same:<id входа>' — как у входа
//     params:  [{ id: 'units', title: L('…'), kind: 'number' | 'select' | 'text' | 'bool' | 'dataset', default, … }],
//     summary?: params => L('blk.my-block.summary', { … }),   // строка под заголовком (строка или L)
//     long?: true,                     // долгий блок: показывать прогресс (ctx.tick)
//     run({ inputs, params, ctx }) → { outputs?: { [portId]: value }, view?: Element | Element[] }
//   }
//
// Чтобы добавить блок, создайте файл и допишите его в список ниже — ядро (редактор и исполнитель) менять не нужно.
// Типы портов: data — таблица, split — train/test, model — описание слоёв, trained — обученная модель.

import { L } from '../../i18n/i18n.js';

const FILES = [
  'data-example', 'data-file',
  'normalize', 'split', 'onehot',
  'dense', 'activation', 'conv', 'pool',
  'train',
  'metrics', 'loss-chart', 'confusion', 'predictions', 'text-output', 'table', 'images', 'feature-maps', 'scatter',
];

export const GROUPS = [
  ['data', L('graph.group.data')],
  ['prep', L('graph.group.prep')],
  ['model', L('graph.group.model')],
  ['train', L('graph.group.train')],
  ['result', L('graph.group.result')],
];

export const PORT_TYPES = {
  data: L('graph.portType.data'),
  split: L('graph.portType.split'),
  model: L('graph.portType.model'),
  trained: L('graph.portType.trained'),
};

/** Загрузить все блоки; блок с ошибкой пропускается (с предупреждением в консоли) */
export async function loadBlocks() {
  const res = await Promise.allSettled(FILES.map(f => import(`./${f}.js`)));
  const blocks = new Map();
  res.forEach((r, i) => {
    const b = r.status === 'fulfilled' ? r.value.default : null;
    if (!b?.id || typeof b.run !== 'function') { console.warn(`Block ${FILES[i]} failed to load`, r.reason); return; }
    blocks.set(b.id, b);
  });
  return blocks;
}

/** Параметры блока по умолчанию + сохранённые значения (приводятся к допустимым) */
export function blockParams(block, saved = {}) {
  const out = {};
  for (const p of block.params) out[p.id] = cleanParam(p, saved[p.id]);
  return out;
}

export function cleanParam(p, v) {
  if (v === undefined || v === null) return p.default;
  switch (p.kind) {
    case 'number': {
      let n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n)) return p.default;
      if (p.int) n = Math.round(n);
      return Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, n));
    }
    case 'select': {
      const opt = p.options.find(o => String(o[0]) === String(v));
      return opt ? opt[0] : p.default;
    }
    case 'bool': return v === true || v === 'true';
    case 'text': return String(v).slice(0, p.maxLength ?? 200);
    case 'dataset': return /^d-[a-z0-9]{6,24}$/.test(String(v)) ? String(v) : '';
    default: return p.default;
  }
}
