// Форматирование чисел и русские подписи для интерфейса.

/** Число со знаком: +0.73 / −0.41 (настоящий минус, а не дефис) */
export function formatValue(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return (v > 0 ? '+' : '−') + s;
}

export function formatPercent(v) {
  return `${Math.round(v * 100)}%`;
}

/** plural(5, ['нейрон', 'нейрона', 'нейронов']) → 'нейронов' */
export function plural(n, [one, few, many]) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

export const NEURONS = ['нейрон', 'нейрона', 'нейронов'];
export const LAYERS = ['слой', 'слоя', 'слоёв'];
export const WEIGHTS = ['вес', 'веса', 'весов'];
export const LINKS = ['связь', 'связи', 'связей'];

/** Короткое имя слоя для подписи в 3D: «Вход», «Скрытый 1», «Выход» */
export function layerShortName(l, total) {
  if (l === 0) return 'Вход';
  if (l === total - 1) return 'Выход';
  return total > 3 ? `Скрытый ${l}` : 'Скрытый';
}

/** Тип слоя в родительном контексте: «входной», «скрытый», «выходной» */
export function layerKind(l, total) {
  if (l === 0) return 'входной';
  if (l === total - 1) return 'выходной';
  return 'скрытый';
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
