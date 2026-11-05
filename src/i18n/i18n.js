// Переводы интерфейса (RU / EN). Все видимые строки — в словарях src/i18n/<язык>/, здесь — только механизм.
// Модуль без зависимостей и без обращения к DOM при импорте: работает и в браузере, и в Node (check-spaces).
//
//   t('graph.epoch', { n: 3, m: 40 })      → «Эпоха 3 из 40» / «Epoch 3 of 40» (строка)
//   T('graph.epoch', { n: 3, m: 40 })      → <span data-t="…">…</span> для HTML-шаблонов
//   setT(el, 'graph.epoch', { n: 3, m: 40 }) — текст элемента (и его перевод при смене языка)
//   L('perceptron.title')                   — «ленивый» текст для конфигов: в строку превращается на текущем языке
//
// Подстановки {имя}: числа форматируются по языку (0,5 / 0.5), num(x, 2) — с фиксированным числом знаков,
// вложенный L(...) переводится. Множественное число: значение-объект { one, few, many, other } и параметр n.
// Ключи, оканчивающиеся на Html, содержат разметку из словаря (доверенную); подстановки в них экранируются.
//
// Смена языка без перезагрузки: элементы с data-t / data-t-<атрибут> переводятся заново (relabel),
// подписчики onLangChange перерисовывают то, что нарисовано на canvas, и списки.

export const LANGS = ['ru', 'en'];
const KEY = 'nnlab-lang';
const PLURAL_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'content'];

const dicts = {};
const listeners = [];
export let lang = detectLang();

function stored() {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null; } catch { return null; }
}

/** ?lang= → сохранённый выбор → язык браузера (русский → ru, иначе en) */
export function detectLang() {
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
    if (LANGS.includes(q)) return q;
  } catch { /* нет location */ }
  const s = stored();
  if (LANGS.includes(s)) return s;
  const nav = typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language ?? '') : '';
  return /^ru\b/i.test(nav) ? 'ru' : (typeof navigator === 'undefined' ? 'ru' : 'en');
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const isPlural = v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length && Object.keys(v).every(x => PLURAL_KEYS.has(x));
    if (v && typeof v === 'object' && !isPlural) flatten(v, key, out); // массивы — ключи k.0, k.1, …
    else out[key] = v;
  }
  return out;
}

async function load(l) {
  if (!dicts[l]) dicts[l] = flatten((await import(`./${l}/index.js`)).default);
  return dicts[l];
}

/** Плоский словарь языка (ключ → значение) — для проверок и инструментов */
export const loadDict = l => load(l);

/** Загрузить словарь (до первой отрисовки) */
export async function initI18n(l = lang) {
  lang = LANGS.includes(l) ? l : 'ru';
  await load(lang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}

export const locale = () => (lang === 'ru' ? 'ru-RU' : 'en-US');
export const has = key => dicts[lang]?.[key] !== undefined;

// ---------- Числа ----------

const nfCache = new Map();
/** Число по правилам языка: 0,5 / 0.5; digits — фиксированное число знаков после запятой */
export function fmtNum(x, digits) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return String(x ?? '—');
  const id = `${lang}|${digits}`;
  if (!nfCache.has(id)) {
    nfCache.set(id, new Intl.NumberFormat(locale(), digits === undefined
      ? { maximumFractionDigits: 6 }
      : { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  }
  return nfCache.get(id).format(x).replace('-', '−');
}

/** Число-параметр с фиксированным числом знаков: t('k', { v: num(0.5, 2) }) */
export const num = (x, d) => ({ num: x, d });

// ---------- Перевод ----------

/** «Ленивый» текст: превращается в строку на текущем языке; сохраняется как { k, p } */
export function L(key, params) {
  return { k: key, p: params, toString() { return t(key, params); }, toJSON() { return { k: key, p: params }; } };
}
export const isText = x => !!x && typeof x === 'object' && typeof x.k === 'string';

/**
 * Ключи с общим префиксом (тексты одного пространства):
 *   const S = scope('sp.perceptron');  S('title') → L('sp.perceptron.title'),  S.t('x', p) → строка,  S.h('x', p) → HTML
 */
export function scope(prefix) {
  const f = (k, p) => L(`${prefix}.${k}`, p);
  f.t = (k, p) => t(`${prefix}.${k}`, p);
  f.h = (k, p) => H(`${prefix}.${k}`, p);
  f.list = (k, n) => Array.from({ length: n }, (_, i) => L(`${prefix}.${k}.${i}`));
  return f;
}

/** Строка из текста-ключа, L(...) или обычной строки */
export const str = x => (isText(x) ? t(x.k, x.p) : x === null || x === undefined ? '' : String(x));

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function param(v) {
  if (typeof v === 'number') return fmtNum(v);
  if (v && typeof v === 'object' && 'num' in v) return fmtNum(v.num, v.d);
  if (isText(v)) return t(v.k, v.p);
  return v === null || v === undefined ? '' : String(v);
}

function pick(v, p) {
  if (v && typeof v === 'object') {
    const n = Number(p?.n ?? p?.count ?? 0);
    const cat = new Intl.PluralRules(locale()).select(n);
    return v[cat] ?? v.other ?? v.many ?? '';
  }
  return v;
}

function fill(s, p, escape) {
  return String(s).replace(/\{(\w+)\}/g, (m, name) => {
    if (!p || !(name in p)) return m;
    const v = param(p[name]);
    return escape ? esc(v) : v;
  });
}

/** Перевод по ключу; если ключа нет — сам ключ (видно сразу, что строка забыта) */
export function t(key, p) {
  if (isText(key)) return t(key.k, key.p);
  const v = dicts[lang]?.[key];
  if (v === undefined) {
    if (typeof console !== 'undefined' && dicts[lang]) console.warn(`i18n: missing key "${key}" (${lang})`);
    return key;
  }
  return fill(pick(v, p), p, false);
}

/** Есть ли в значении ключа разметка */
const isHtmlKey = key => /Html$/.test(key);

/** Содержимое для HTML: экранированный текст или разметка словаря с экранированными подстановками */
export function H(key, p) {
  if (isText(key)) return H(key.k, key.p);
  const v = dicts[lang]?.[key];
  if (v === undefined) return esc(t(key, p));
  return isHtmlKey(key) ? fill(pick(v, p), p, true) : esc(fill(pick(v, p), p, false));
}

const tp = p => (p && Object.keys(p).length ? ` data-tp="${esc(JSON.stringify(p))}"` : '');

/** Атрибуты элемента, весь текст которого — перевод: <option ${TA('k')}>${H('k')}</option> */
export function TA(key, p) {
  if (isText(key)) return TA(key.k, key.p);
  return `data-t="${esc(key)}"${tp(p)}`;
}

/** Перевод в обёртке <span> для HTML-шаблонов (переводится заново при смене языка) */
export function T(key, p, tag = 'span') {
  if (isText(key)) return T(key.k, key.p, tag);
  return `<${tag} ${TA(key, p)}>${H(key, p)}</${tag}>`;
}

/** Текст, который может быть и переводом L(...), и обычной строкой (например, из файла пользователя — экранируется) */
export const Tx = (x, tag) => (isText(x) ? T(x, undefined, tag) : esc(x ?? ''));

// Функции-шаблоны из Hx: перерисовываются при смене языка (по data-hx)
const hxFns = new Map();
let hxSeq = 0;

/** HTML, который может быть переводом L('…Html'), функцией () => html (перерисуется при смене языка) или готовой (уже безопасной) разметкой */
export const Hx = x => {
  if (typeof x === 'function') { hxFns.set(String(++hxSeq), x); return `<div data-hx="${hxSeq}">${x()}</div>`; }
  return isText(x) ? T(x, undefined, 'div') : String(x ?? '');
};

/** Атрибут из L(...) или обычной строки */
export const AtX = (attr, x) => (isText(x) ? At(attr, x) : `${attr}="${esc(x ?? '')}"`);

/** Атрибут с переводом: <button ${At('title', 'k')}> */
export function At(attr, key, p) {
  if (isText(key)) return At(attr, key.k, key.p);
  return `${attr}="${esc(t(key, p))}" data-t-${attr}="${esc(key)}"${p && Object.keys(p).length ? ` data-tp-${attr}="${esc(JSON.stringify(p))}"` : ''}`;
}

/** Текст элемента по ключу (или L(...)); переводится при смене языка */
export function setT(el, key, p) {
  if (!el) return el;
  if (isText(key)) return setT(el, key.k, key.p);
  el.dataset.t = key;
  if (p && Object.keys(p).length) el.dataset.tp = JSON.stringify(p); else delete el.dataset.tp;
  applyText(el);
  return el;
}

/** Обычный (непереводимый) текст элемента: снимает пометку перевода */
export function setText(el, text) {
  if (!el) return el;
  delete el.dataset.t;
  delete el.dataset.tp;
  el.textContent = text;
  return el;
}

/** Атрибут элемента по ключу */
export function setAttrT(el, attr, key, p) {
  if (!el) return el;
  if (isText(key)) return setAttrT(el, attr, key.k, key.p);
  el.setAttribute(`data-t-${attr}`, key);
  if (p && Object.keys(p).length) el.setAttribute(`data-tp-${attr}`, JSON.stringify(p)); else el.removeAttribute(`data-tp-${attr}`);
  el.setAttribute(attr, t(key, p));
  return el;
}

/** Элемент с переведённым текстом: el('button', 'cls', 'graph.run') */
export function elT(tag, cls, key, p) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return setT(e, key, p);
}

const parse = s => { try { return s ? JSON.parse(s) : undefined; } catch { return undefined; } };

function applyText(el) {
  const key = el.dataset.t, p = parse(el.dataset.tp);
  if (isHtmlKey(key)) el.innerHTML = H(key, p);
  else el.textContent = t(key, p);
}

/** Перевести заново всё помеченное внутри root */
export function relabel(root = document) {
  if (root.matches?.('[data-t]')) applyText(root);
  root.querySelectorAll('[data-t]').forEach(applyText);
  root.querySelectorAll('[data-hx]').forEach(el => { const fn = hxFns.get(el.dataset.hx); if (fn) el.innerHTML = fn(); });
  for (const a of ATTRS) {
    const sel = `[data-t-${a}]`;
    const list = [...root.querySelectorAll(sel)];
    if (root.matches?.(sel)) list.push(root);
    for (const el of list) el.setAttribute(a, t(el.getAttribute(`data-t-${a}`), parse(el.getAttribute(`data-tp-${a}`))));
  }
}

/** Подписка на смену языка (после перевода помеченных элементов) */
export function onLangChange(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); }

/** Сменить язык на лету: словарь, <html lang>, все помеченные элементы, подписчики */
export async function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  await load(l);
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* приватный режим — не запоминаем */ }
  if (typeof document === 'undefined') return;
  document.documentElement.lang = l;
  // ?lang= в адресе перекрывает сохранённый выбор — обновляем его, чтобы после перезагрузки язык не вернулся
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) { u.searchParams.set('lang', l); history.replaceState(history.state, '', u); }
  } catch { /* нет history */ }
  relabel(document);
  syncLangSwitch();
  for (const fn of [...listeners]) {
    try { fn(l); } catch (e) { console.error(e); }
  }
}

// ---------- Переключатель RU | EN ----------

/** Разметка переключателя языка; стиль — как у кружков тем (base.css .lang-switch) */
export function langSwitchHtml() {
  return `<div class="lang-switch" role="group" ${At('aria-label', 'common.langSwitch')}>${LANGS.map(l =>
    `<button type="button" class="lang-btn" data-lang-set="${l}" aria-pressed="${l === lang}" ${At('title', `common.lang.${l}`)}>${l.toUpperCase()}</button>`).join('')}</div>`;
}

function syncLangSwitch() {
  document.querySelectorAll('[data-lang-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.langSet === lang)));
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('[data-lang-set]');
    if (b) setLang(b.dataset.langSet);
  });
}
