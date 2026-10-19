// Темы оформления: фон страницы, панели, подписей и 3D-сцены. Только оформление — модели не затрагиваются.
// CSS-цвета тем — в base.css (:root[data-theme=…]), здесь — цвета 3D-сцены и переключатель.
// Модуль без Three.js: его подключает и каталог.

const STORAGE_KEY = 'nnlab-theme';

/**
 * scene — цвета, которые 3D-сцена берёт из темы (остальные — тёплый/холодный и цвета типов слоёв — общие).
 * bloom — сила свечения; на светлом фоне свечение выключено, иначе фон «засвечивается».
 * glow — множитель «накала» активных нейронов: без bloom сильный накал выбеливает цвет (оранжевый → жёлтый).
 * links — связи в покое (прозрачность и яркость) и яркость активной связи: на светлом фоне связи плотнее и темнее.
 */
export const THEMES = {
  black: {
    title: 'Чёрный', swatch: '#0a0e17',
    scene: { background: 0x0a0e17, neutral: 0x4a5264, neuronIdle: 0x8a9ab3, pulse: 0xfff4d6, hover: 0xffffff, accent: 0xffd166, plate: 0x1a2130, axes: 0x3a4660, cell: 0x1b2436, bloom: 0.7, glow: 1,
      links: { restOpacity: 0.45, restGain: 0.55, activeGain: 1.9 } },
  },
  gray: {
    title: 'Серый', swatch: '#2b303a',
    scene: { background: 0x2b303a, neutral: 0x687286, neuronIdle: 0x9aa8bf, pulse: 0xfff4d6, hover: 0xffffff, accent: 0xffd166, plate: 0x222730, axes: 0x5a6478, cell: 0x3a4150, bloom: 0.55, glow: 1,
      links: { restOpacity: 0.6, restGain: 0.7, activeGain: 1.8 } },
  },
  green: {
    title: 'Зелёный', swatch: '#0f2a22',
    scene: { background: 0x0f2a22, neutral: 0x4f7064, neuronIdle: 0x93b3a7, pulse: 0xfff4d6, hover: 0xffffff, accent: 0xffd166, plate: 0x0b1f19, axes: 0x3f6457, cell: 0x1a3d31, bloom: 0.6, glow: 1,
      links: { restOpacity: 0.55, restGain: 0.65, activeGain: 1.8 } },
  },
  white: {
    title: 'Белый', swatch: '#f4f6f9',
    scene: { background: 0xf4f6f9, neutral: 0x5d6678, neuronIdle: 0x6f7c94, pulse: 0x1f2a44, hover: 0x1a2233, accent: 0xe09b00, plate: 0x1a2130, axes: 0x9aa4b6, cell: 0xdfe5ee, bloom: 0, glow: 0.3,
      links: { restOpacity: 0.9, restGain: 0.75, activeGain: 0.95 } },
  },
};

const DEFAULT = 'black';
const valid = id => Object.hasOwn(THEMES, id);

function storedTheme() {
  if (typeof localStorage === 'undefined') return null;
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function urlTheme() {
  if (typeof location === 'undefined') return null;
  try { return new URLSearchParams(location.search).get('theme'); } catch { return null; }
}

/** Параметр ?theme= перекрывает сохранённый выбор */
function initialTheme() {
  const fromUrl = urlTheme();
  if (valid(fromUrl)) return fromUrl;
  const saved = storedTheme();
  return valid(saved) ? saved : DEFAULT;
}

let current = initialTheme();
const listeners = new Set();

export function currentTheme() { return current; }
export function themeScene(id = current) { return THEMES[id].scene; }

/** Подписка на смену темы: fn(newId, oldId). Возвращает функцию отписки */
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function syncDom() {
  document.documentElement.dataset.theme = current;
  for (const b of document.querySelectorAll('[data-theme-set]')) {
    b.setAttribute('aria-pressed', String(b.dataset.themeSet === current));
  }
}

export function setTheme(id) {
  if (!valid(id) || id === current) return;
  const old = current;
  current = id;
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* приватный режим и т.п. — просто не запоминаем */ }
  // Явный выбор важнее параметра в адресе: обновляем его, чтобы при перезагрузке тема не откатилась
  try {
    const url = new URL(location.href);
    if (url.searchParams.has('theme')) {
      url.searchParams.set('theme', id);
      history.replaceState(history.state, '', url);
    }
  } catch { /* ignore */ }
  syncDom();
  for (const fn of listeners) fn(id, old);
}

/** Разметка переключателя: 4 цветных кружка. Обработчик кликов — общий, на документе */
export function themeSwitchHtml() {
  return `<div class="theme-switch" role="group" aria-label="Фон">${Object.entries(THEMES).map(([id, t]) =>
    `<button type="button" class="theme-dot" data-theme-set="${id}" style="--swatch:${t.swatch}" title="Фон: ${t.title}" aria-label="Фон: ${t.title}" aria-pressed="${id === current}"></button>`).join('')}</div>`;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('[data-theme-set]');
    if (b) setTheme(b.dataset.themeSet);
  });
  syncDom();
}
