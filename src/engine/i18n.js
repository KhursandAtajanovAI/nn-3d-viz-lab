// Shared language state for the catalog and visualizer chrome.
const STORAGE_KEY = 'nnlab-language';
const LANGUAGES = {
  ru: { title: 'Русский', short: 'RU' },
  en: { title: 'English', short: 'EN' },
};

const STRINGS = {
  ru: {
    catalog: 'Каталог',
    all: 'Все',
    searchPlaceholder: 'Поиск: MNIST, свёртки, внимание, регрессия…',
    searchAria: 'Поиск по названию, описанию и тегам',
    mySpaces: 'Мои пространства',
    uploadFile: 'Загрузить файл',
    createSpace: '+ Создать пространство',
    localOnly: 'Свои сети и графы блоков. Хранятся только в этом браузере; встроенные пространства ниже не меняются.',
    tagFilter: 'Фильтр по тегам',
    nothingFound: 'Ничего не найдено по текущим фильтрам.',
    resetFilters: 'Сбросить фильтры',
    resetAll: 'Сбросить всё',
    openSpace: 'Открыть пространство →',
    whereUsed: 'Где применяется:',
    shownAll: n => `Показаны все ${n}`,
    found: (shown, total) => `Найдено: ${shown} из ${total}`,
    language: 'Язык',
    background: 'Фон',
    backToCatalog: '← Каталог',
    controls: 'Управление',
    hover: 'Под курсором',
    scene: 'Сцена',
    loading: 'Загрузка каталога…',
    loadError: 'Не удалось загрузить список пространств.',
  },
  en: {
    catalog: 'Catalog',
    all: 'All',
    searchPlaceholder: 'Search: MNIST, convolutions, attention, regression…',
    searchAria: 'Search by title, description, and tags',
    mySpaces: 'My spaces',
    uploadFile: 'Upload file',
    createSpace: '+ Create space',
    localOnly: 'Your networks and block graphs. Stored only in this browser; built-in spaces below are unchanged.',
    tagFilter: 'Filter by tags',
    nothingFound: 'Nothing matches the current filters.',
    resetFilters: 'Reset filters',
    resetAll: 'Reset all',
    openSpace: 'Open space →',
    whereUsed: 'Used for:',
    shownAll: n => `Showing all ${n}`,
    found: (shown, total) => `Found: ${shown} of ${total}`,
    language: 'Language',
    background: 'Background',
    backToCatalog: '← Catalog',
    controls: 'Controls',
    hover: 'Under cursor',
    scene: 'Scene',
    loading: 'Loading catalog…',
    loadError: 'Could not load the space list.',
  },
};

function readLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES[saved]) return saved;
  } catch { /* private browsing can disable storage */ }
  return 'ru';
}

let current = readLanguage();
const listeners = new Set();

export function language() { return current; }
export function localize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return value[current] ?? value.ru ?? value.en;
}
export function t(key, ...args) {
  const value = STRINGS[current][key] ?? STRINGS.ru[key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
}
export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function setLanguage(next) {
  if (!LANGUAGES[next] || next === current) return;
  current = next;
  try { localStorage.setItem(STORAGE_KEY, current); } catch { /* continue without persistence */ }
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  for (const fn of listeners) fn(current);
  syncLanguageSwitches();
}

function syncLanguageSwitches() {
  if (typeof document === 'undefined') return;
  for (const button of document.querySelectorAll('[data-language-set]')) {
    button.setAttribute('aria-pressed', String(button.dataset.languageSet === current));
  }
}

export function languageSwitchHtml() {
  return `<div class="language-switch" role="group" aria-label="${t('language')}">
    ${Object.entries(LANGUAGES).map(([id, value]) => `<button type="button" data-language-set="${id}"
      aria-pressed="${id === current}" title="${value.title}">${value.short}</button>`).join('')}
  </div>`;
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = current;
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-language-set]');
    if (button) setLanguage(button.dataset.languageSet);
  });
}
