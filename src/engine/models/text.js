// Простейшие текстовые утилиты для NLP-пространств. Языковые правила (окончания) — в словаре txt.*.
import { t, H } from '../../i18n/i18n.js';
import { escapeHtml as esc } from '../format.js';

/** Сколько слов максимум обрабатывают текстовые пространства (больше не помещается в сцену) */
export const MAX_TOKENS = 12;

// Любые буквы (латиница, кириллица…), внутри слова допустимы дефис и апостроф («don't»); «ё» приводится к «е»
const words = text => text.toLowerCase().replace(/\u0451/g, '\u0435').replace(/’/g, "'").match(/\p{L}+(?:['-]\p{L}+)?/gu) ?? [];

/** Сколько слов в тексте всего (до обрезки) */
export const countWords = text => words(text).length;

/** Разбить текст на слова: нижний регистр, ё → е, только буквы, дефис и апостроф; не больше MAX_TOKENS */
export function tokenize(text) {
  return words(text).slice(0, MAX_TOKENS);
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
    `<tr><td>${esc(w)}</td>${v.map(x => `<td class="num ${x > 0 ? 'pos' : x < 0 ? 'neg' : 'muted'}">${x === 0 ? '·' : x.toFixed(1)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table class="arch-table vocab">
    <thead><tr><th>${H('txt.word')}</th>${dims.map(d => `<th>${esc(d)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/**
 * Найти слово в словаре с учётом формы прилагательного: «хорошая», «хорошие» → «хороший»,
 * «интересная» → «интересный». Грубое правило, но для учебного словаря его достаточно.
 */
export function lookupForm(vocab, word) {
  if (word in vocab) return word;
  const list = k => t(k).split(' ').filter(Boolean);
  const bases = list('txt.adjBases');
  for (const e of list('txt.adjEndings')) {
    if (!word.endsWith(e)) continue;
    const stem = word.slice(0, -e.length);
    for (const base of bases) if (stem + base in vocab) return stem + base;
  }
  return null;
}
