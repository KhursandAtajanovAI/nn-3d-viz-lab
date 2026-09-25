// Простейшие текстовые утилиты для NLP-пространств (без зависимостей).

/** Разбить текст на слова: нижний регистр, ё → е, только буквы и дефис */
export function tokenize(text) {
  return (text.toLowerCase().replace(/ё/g, 'е').match(/[a-zа-я]+(?:-[a-zа-я]+)?/g) ?? []).slice(0, 12);
}

export const sigmoid = x => 1 / (1 + Math.exp(-x));

export function softmax(z) {
  const m = Math.max(...z);
  const e = z.map(v => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}

export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

/** Таблица «слово → вектор» для справки в панели */
export function vocabularyTable(vocab, dims, { limit = 80 } = {}) {
  const rows = Object.entries(vocab).slice(0, limit).map(([w, v]) =>
    `<tr><td>${w}</td>${v.map(x => `<td class="num ${x > 0 ? 'pos' : x < 0 ? 'neg' : 'muted'}">${x === 0 ? '·' : x.toFixed(1)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table class="arch-table vocab">
    <thead><tr><th>слово</th>${dims.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/**
 * Найти слово в словаре с учётом формы прилагательного: «хорошая», «хорошие» → «хороший»,
 * «интересная» → «интересный». Грубое правило, но для учебного словаря его достаточно.
 */
export function lookupForm(vocab, word) {
  if (word in vocab) return word;
  const endings = ['ая', 'ое', 'ые', 'ую', 'ого', 'ому', 'ым', 'ыми', 'ых', 'ой', 'ее', 'ие', 'яя', 'юю', 'его', 'им', 'их'];
  for (const e of endings) {
    if (!word.endsWith(e)) continue;
    const stem = word.slice(0, -e.length);
    for (const base of ['ый', 'ий', 'ой']) if (stem + base in vocab) return stem + base;
  }
  return null;
}
