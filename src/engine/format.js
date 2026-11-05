// Форматирование чисел и подписи слоёв для интерфейса (тексты — в словарях, lab.*).
import { t, L, fmtNum } from '../i18n/i18n.js';

/** Число со знаком для 3D-подписей: +0.73 / −0.41 (настоящий минус; всегда с точкой) */
export function formatValue(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return (v > 0 ? '+' : '−') + s;
}

/** Число со знаком для текста панели — по правилам языка: +0,73 (ru) / +0.73 (en) */
export function fmtSigned(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (Number(Math.abs(v).toFixed(digits)) === 0) return fmtNum(0, digits);
  return (v > 0 ? '+' : '−') + fmtNum(Math.abs(v), digits);
}

export function formatPercent(v) {
  return `${Math.round(v * 100)}%`;
}

/** Короткое имя слоя как L(...): «Вход», «Скрытый 1», «Выход» (для 3D-подписей — переводится на лету) */
export function layerShortL(l, total) {
  if (l === 0) return L('lab.layer.input');
  if (l === total - 1) return L('lab.layer.output');
  return total > 3 ? L('lab.layer.hiddenN', { n: l }) : L('lab.layer.hidden');
}

export const layerShortName = (l, total) => t(layerShortL(l, total));

/** Тип слоя: «входной», «скрытый», «выходной» */
export function layerKind(l, total) {
  if (l === 0) return t('lab.layerKind.input');
  if (l === total - 1) return t('lab.layerKind.output');
  return t('lab.layerKind.hidden');
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
