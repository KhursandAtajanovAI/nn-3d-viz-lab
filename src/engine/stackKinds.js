// Типы слоёв для визуализатора архитектур (type: 'stack'): цвет блока, название и объяснение.
// Используется сценой, легендой, панелью и проверкой конфигов. Тексты — в словарях (kind.*).
import { L, t, fmtNum } from '../i18n/i18n.js';

const KIND_COLORS = {
  input: 0x8a9ab3,
  noise: 0x8a9ab3,
  conv: 0xff9f1c,
  dwconv: 0xffb347,
  deconv: 0xffc46b,
  pool: 0x2f9bff,
  norm: 0x5ad1b3,
  add: 0x2f9bff,
  concat: 0x5ad1b3,
  inception: 0xff9f1c,
  flatten: 0x6b7385,
  dense: 0xb48cff,
  dropout: 0x6b7385,
  embed: 0xffd166,
  posenc: 0xffd166,
  attention: 0xff6fa3,
  ffn: 0xb48cff,
  rnn: 0x5ad1b3,
  latent: 0xffd166,
  sample: 0xffd166,
  heads: 0x7ee081,
  output: 0x7ee081,
};

/** Встроенные виды: цвет + название и пояснение из словаря (kind.<id>.title / .info) */
export const KINDS = Object.fromEntries(Object.entries(KIND_COLORS).map(([id, color]) => [id, { title: L(`kind.${id}.title`), color, info: L(`kind.${id}.info`) }]));

/**
 * Описание вида слоя: сначала свои виды пространства (поле kinds в конфиге), затем встроенные.
 * Неизвестный вид рисуется как полносвязный — так старое поведение не меняется.
 */
export const kindInfo = (kind, custom = null) => customKind(custom, kind) ?? KINDS[kind] ?? KINDS.dense;

/** Свой вид слоя из конфига → { title, color (число 0xRRGGBB), info } или null */
function customKind(custom, kind) {
  const k = custom && Object.prototype.hasOwnProperty.call(custom, kind) ? custom[kind] : null;
  if (!k || typeof k !== 'object') return null;
  return { title: String(k.title ?? kind), color: parseColor(k.color) ?? 0x8a9ab3, info: String(k.info ?? '') };
}

/** Цвет: число 0xRRGGBB или строка «#rrggbb» / «#rgb» */
export function parseColor(c) {
  if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 0xffffff) return c;
  if (typeof c !== 'string') return null;
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return parseInt(m[1], 16);
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  return m ? parseInt(m[1] + m[1] + m[2] + m[2] + m[3] + m[3], 16) : null;
}

/**
 * Проверка своих видов слоёв (поле kinds конфига stack). Возвращает список ошибок.
 * Нужны: id латиницей, название; цвет — 0xRRGGBB или «#rrggbb»; пояснение — по желанию.
 */
export function checkCustomKinds(kinds) {
  if (kinds === undefined) return [];
  if (!kinds || typeof kinds !== 'object' || Array.isArray(kinds)) return [t('kind.errNotObject')];
  const errors = [];
  for (const [id, k] of Object.entries(kinds)) {
    if (!/^[a-z][a-zA-Z0-9-]{0,30}$/.test(id)) errors.push(t('kind.errId', { id }));
    else if (KINDS[id]) errors.push(t('kind.errBuiltin', { id }));
    if (!k || typeof k !== 'object') { errors.push(t('kind.errItem', { id })); continue; }
    if (typeof k.title !== 'string' || !k.title.trim()) errors.push(t('kind.errTitle', { id }));
    if (k.color !== undefined && parseColor(k.color) === null) errors.push(t('kind.errColor', { id }));
    if (k.info !== undefined && typeof k.info !== 'string') errors.push(t('kind.errInfo', { id }));
  }
  return errors;
}

/** Форма тензора по-человечески: [28, 28, 6] → «28×28×6» */
export const formatShape = shape => shape.join('×');

export const shapeSize = shape => shape.reduce((a, b) => a * b, 1);

/**
 * Число обучаемых параметров слоя по формам (если в конфиге не задано явно поле params).
 * conv: (k·k·C_in + 1)·C_out, dense: (N_in + 1)·N_out, остальные — 0.
 */
export function layerParams(layer, prev) {
  if (layer.params !== undefined) return layer.params;
  if (!prev) return 0;
  const out = layer.shape;
  switch (layer.kind) {
    case 'conv':
    case 'deconv': {
      const k = layer.kernel ?? 3, cin = prev.shape.at(-1), cout = out.at(-1);
      return (k * k * cin + 1) * cout;
    }
    case 'dwconv': {
      const k = layer.kernel ?? 3, cin = prev.shape.at(-1), cout = out.at(-1);
      return k * k * cin + (cin + 1) * cout;
    }
    case 'dense':
    case 'output':
      return (shapeSize(prev.shape) + 1) * shapeSize(out);
    case 'norm':
      return 2 * out.at(-1);
    default:
      return 0;
  }
}

/** 1234567 → «1,2 млн» / «1.2M» */
export function formatCount(n) {
  if (n >= 1e9) return t('kind.billions', { v: fmtNum(n / 1e9, 1) });
  if (n >= 1e6) return t('kind.millions', { v: fmtNum(n / 1e6, 1) });
  if (n >= 1e4) return t('kind.thousands', { v: Math.round(n / 1e3) });
  return fmtNum(n);
}
