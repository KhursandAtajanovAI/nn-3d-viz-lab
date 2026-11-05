// Ошибки блочного конструктора с переводом: текст на текущем языке (message) и L(...) для перевода на лету (l).
import { L, t, isText } from '../../i18n/i18n.js';

export class GraphError extends Error {
  constructor(key, params) {
    super(t(key, params));
    this.name = 'GraphError';
    this.l = L(key, params);
  }
}

/** throw fail('graph.err.noRows') — ошибка с переводимым сообщением */
export const fail = (key, params) => new GraphError(key, params);

/** Сообщение ошибки для показа: L(...), если оно есть, иначе обычная строка */
export const errorText = e => (isText(e?.l) ? e.l : (e?.message || String(e)));
