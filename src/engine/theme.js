// Оформление: темы фона и масштаб интерфейса. Только внешний вид — модели не затрагиваются.
// CSS-цвета тем — в base.css (:root[data-theme=…]), здесь — цвета 3D-сцены, переключатель тем и масштаб шрифтов.
// Модуль без Three.js: его подключает и каталог.
//
//   ?theme=black|gray|green|white  — тема (перекрывает сохранённую); клавиша T — следующая тема
//   ?scale=1                       — масштаб интерфейса (0.75…3, по умолчанию 2); клавиши + и − меняют его
//   Выбор запоминается в localStorage (nnlab-theme, nnlab-scale) и общий для всех страниц.

const THEME_KEY = 'nnlab-theme';
const SCALE_KEY = 'nnlab-scale';

/**
 * scene — цвета, которые 3D-сцена берёт из темы (остальные — тёплый/холодный и цвета типов слоёв — общие).
 * bloom — сила свечения; на светлом/ярком фоне свечение выключено или ослаблено, иначе фон «засвечивается».
 * glow — множитель «накала» активных нейронов: без bloom сильный накал выбеливает цвет (оранжевый → жёлтый).
 * links — связи в покое (прозрачность и яркость) и яркость активной связи: на светлом фоне связи плотнее и темнее.
 * remap — подмена цветов: hex → hex. Нужна неоновой теме, где светлые объекты (зелёные, жёлтые, оранжевые, голубые)
 *         сливаются с фоном и получают более тёмный оттенок (см. palette.js).
 */
export const THEMES = {
  black: {
    title: 'Чёрный', swatch: '#0a0e17',
    scene: { background: 0x0a0e17, neutral: 0x4a5264, neuronIdle: 0x8a9ab3, pulse: 0xfff4d6, hover: 0xffffff, accent: 0xffd166, plate: 0x1a2130, axes: 0x3a4660, cell: 0x1b2436, bloom: 0.7, glow: 1,
      links: { restOpacity: 0.45, restGain: 0.55, activeGain: 1.9 } },
  },
  // Средне-серый фон: светлые и тёмные объекты видны одинаково; тёмные нейроны и связи, светлые импульсы и подсветка
  gray: {
    title: 'Серый', swatch: '#8d939e',
    scene: { background: 0x8d939e, neutral: 0x3e4658, neuronIdle: 0x4d5870, pulse: 0xffffff, hover: 0xffffff, accent: 0xffd166, plate: 0x363d4a, axes: 0x5a6272, cell: 0x727a88, bloom: 0.3, glow: 0.7,
      links: { restOpacity: 0.8, restGain: 1, activeGain: 1.3 } },
  },
  // Неоновая: основной цвет #37fd12. Свечение выключено, объекты — более тёмных оттенков
  green: {
    title: 'Зелёный', swatch: '#37fd12',
    scene: { background: 0x37fd12, neutral: 0x24501f, neuronIdle: 0x2f6a3a, pulse: 0x06240a, hover: 0x06240a, accent: 0xa85a00, plate: 0x0d3a14, axes: 0x1c7a10, cell: 0x2fb50e, bloom: 0, glow: 0.3,
      links: { restOpacity: 0.9, restGain: 1, activeGain: 1 },
      remap: {
        0x7ee081: 0x0b7a22, 0x5ad1b3: 0x0a6e5c,   // зелёные: оптимизатор Adam, нормализация, выход, рекуррентный слой
        0xffd166: 0xa85a00, 0xffc46b: 0xb86a10,   // жёлтые: эмбеддинги, цель, подсветка рекомендаций
        0xff9f1c: 0xcc5200, 0x2f9bff: 0x0a52d1,   // тёплый и холодный: темнее, чтобы читались на ярком зелёном
        0xb48cff: 0x5b2fb8, 0xc9a7ff: 0x6a3fc8, 0x9fb4ff: 0x2a4bb0,
      } },
  },
  white: {
    title: 'Белый', swatch: '#f4f6f9',
    scene: { background: 0xf4f6f9, neutral: 0x5d6678, neuronIdle: 0x6f7c94, pulse: 0x1f2a44, hover: 0x1a2233, accent: 0xe09b00, plate: 0x1a2130, axes: 0x9aa4b6, cell: 0xdfe5ee, bloom: 0, glow: 0.3,
      links: { restOpacity: 0.9, restGain: 0.75, activeGain: 0.95 } },
  },
};

const DEFAULT = 'black';
const ORDER = Object.keys(THEMES);
const valid = id => Object.hasOwn(THEMES, id);

function stored(key) {
  if (typeof localStorage === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch { /* приватный режим и т.п. — просто не запоминаем */ }
}
function urlParam(name) {
  if (typeof location === 'undefined') return null;
  try { return new URLSearchParams(location.search).get(name); } catch { return null; }
}

/** Параметр ?theme= перекрывает сохранённый выбор */
function initialTheme() {
  const fromUrl = urlParam('theme');
  if (valid(fromUrl)) return fromUrl;
  const saved = stored(THEME_KEY);
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
  save(THEME_KEY, id);
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

export function nextTheme() { setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]); }

/** Разметка переключателя: 4 цветных кружка. Обработчик кликов — общий, на документе */
export function themeSwitchHtml() {
  return `<div class="theme-switch" role="group" aria-label="Фон">${Object.entries(THEMES).map(([id, t]) =>
    `<button type="button" class="theme-dot" data-theme-set="${id}" style="--swatch:${t.swatch}" title="Фон: ${t.title} (клавиша T — следующая тема)" aria-label="Фон: ${t.title}" aria-pressed="${id === current}"></button>`).join('')}</div>`;
}

// ---------- Масштаб интерфейса ----------

export const DEFAULT_SCALE = 2;
const SCALE_MIN = 0.75, SCALE_MAX = 3;
const clampScale = v => Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));
const parseScale = v => { const n = Number.parseFloat(v); return Number.isFinite(n) ? clampScale(n) : null; };

/** Масштаб, выбранный пользователем: ?scale= перекрывает сохранённый */
let requestedScale = parseScale(urlParam('scale')) ?? parseScale(stored(SCALE_KEY)) ?? DEFAULT_SCALE;

/** Масштаб, который реально применяется: на узких экранах он автоматически снижается */
export function effectiveScale(requested = requestedScale, width = (typeof innerWidth === 'number' ? innerWidth : 1920)) {
  if (width < 600) return Math.min(requested, 1);
  if (width < 900) return Math.min(requested, 1.2);
  if (width < 1280) return Math.min(requested, 1.5);
  return requested;
}

/** Множитель размеров подписей на сцене (должен совпадать с --label-scale в base.css) */
export const labelScale = () => 1 + (effectiveScale() - 1) * 0.8;

function applyScale() {
  document.documentElement.style.setProperty('--ui-scale', String(effectiveScale()));
}

export function currentScale() { return requestedScale; }

/** Задать масштаб (запоминается). Размеры сцены пересчитывает ResizeObserver сам */
export function setScale(v) {
  const s = parseScale(v);
  if (s === null || s === requestedScale) return;
  requestedScale = s;
  save(SCALE_KEY, String(s));
  applyScale();
}

// ---------- Общие обработчики ----------

if (typeof document !== 'undefined') {
  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('[data-theme-set]');
    if (b) setTheme(b.dataset.themeSet);
  });
  // T — следующая тема; + / − — масштаб. Не срабатывает, когда фокус в поле ввода или списке
  document.addEventListener('keydown', ev => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (ev.code === 'KeyT') nextTheme();
    else if (ev.key === '+' || ev.key === '=') setScale(Math.round((requestedScale + 0.25) * 4) / 4);
    else if (ev.key === '-' || ev.key === '_') setScale(Math.round((requestedScale - 0.25) * 4) / 4);
  });
  addEventListener('resize', applyScale);
  syncDom();
  applyScale();
}
