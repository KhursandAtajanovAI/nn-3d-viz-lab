// Каталог пространств. Список берётся из spaces/manifest.json, метаданные — из самих конфигов
// (они не импортируют Three.js, поэтому загружаются быстро).
import { CATEGORIES, LEVELS, loadManifest } from '../engine/catalog.js';
import { escapeHtml } from '../engine/format.js';

const root = document.getElementById('catalog');
const search = document.getElementById('search');
const filters = document.getElementById('filters');
let spaces = [];
let activeCategory = 'all';

/** Мини-схема архитектуры: столбцы точек по числу нейронов в слоях */
function previewSvg(layers) {
  if (!Array.isArray(layers) || layers.length < 2) return '';
  const W = 220, H = 96, MAX = 7, R = 4;
  const colX = i => 18 + (i * (W - 36)) / (layers.length - 1);
  const cols = layers.map((n, i) => {
    const count = Math.min(n, MAX);
    const gap = Math.min(13, (H - 20) / Math.max(count - 1, 1));
    return Array.from({ length: count }, (_, k) => ({
      x: colX(i),
      y: H / 2 + (k - (count - 1) / 2) * gap,
      more: n > MAX && k === count - 1,
    }));
  });
  let lines = '';
  for (let i = 0; i < cols.length - 1; i++) {
    for (const a of cols[i]) for (const b of cols[i + 1]) {
      lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
    }
  }
  const dots = cols.flat().map(p => p.more
    ? `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle">⋯</text>`
    : `<circle cx="${p.x}" cy="${p.y}" r="${R}" />`).join('');
  return `<svg class="preview" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="links">${lines}</g><g class="nodes">${dots}</g></svg>`;
}

function cardHtml(s) {
  const m = s.meta;
  return `
    <a class="space-card" href="space.html?id=${encodeURIComponent(m.id)}">
      ${previewSvg(m.preview)}
      <div class="body">
        <h3>${escapeHtml(m.title)}</h3>
        <p>${escapeHtml(m.summary ?? '')}</p>
        ${m.uses ? `<p class="uses"><span class="muted">Где применяется:</span> ${escapeHtml(m.uses)}</p>` : ''}
        <div class="badges">
          ${m.level ? `<span class="badge">${LEVELS[m.level]}</span>` : ''}
          ${(m.tags ?? []).map(t => `<span class="badge muted">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    </a>`;
}

function matches(s, q) {
  if (!q) return true;
  const m = s.meta;
  return [m.title, m.summary, m.uses, ...(m.tags ?? [])].join(' ').toLowerCase().includes(q);
}

function render() {
  const q = search.value.trim().toLowerCase();
  const visible = spaces.filter(s =>
    (activeCategory === 'all' || s.meta.category === activeCategory) && matches(s, q));

  const sections = CATEGORIES.map(cat => {
    const list = visible.filter(s => s.meta.category === cat.id)
      .sort((a, b) => (a.meta.order ?? 999) - (b.meta.order ?? 999));
    if (!list.length) return '';
    return `
      <section class="category" id="cat-${cat.id}">
        <h2><span class="icon">${cat.icon}</span> ${escapeHtml(cat.title)} <span class="count">${list.length}</span></h2>
        <p class="muted">${escapeHtml(cat.description)}</p>
        <div class="grid">${list.map(cardHtml).join('')}</div>
      </section>`;
  }).join('');

  root.innerHTML = sections || `<p class="empty muted">Ничего не найдено. Попробуйте другой запрос или категорию.</p>`;
}

function renderFilters() {
  const present = new Set(spaces.map(s => s.meta.category));
  const chips = [{ id: 'all', title: 'Все', icon: '' }, ...CATEGORIES.filter(c => present.has(c.id))];
  filters.innerHTML = chips.map(c => {
    const n = c.id === 'all' ? spaces.length : spaces.filter(s => s.meta.category === c.id).length;
    return `<button data-cat="${c.id}" aria-pressed="${c.id === activeCategory}">${c.icon ? `${c.icon} ` : ''}${escapeHtml(c.title)} <span class="count">${n}</span></button>`;
  }).join('');
}

filters.addEventListener('click', e => {
  const btn = e.target.closest('button[data-cat]');
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  renderFilters();
  render();
});
search.addEventListener('input', render);

async function init() {
  try {
    const ids = await loadManifest();
    const results = await Promise.allSettled(ids.map(id => import(`../../spaces/${id}.js`)));
    spaces = results.flatMap((r, i) => {
      if (r.status === 'fulfilled' && r.value.default?.meta) return [r.value.default];
      console.warn(`Пространство ${ids[i]} не загрузилось`, r.reason);
      return [];
    });
    document.getElementById('total').textContent = spaces.length;
    renderFilters();
    render();
  } catch (e) {
    console.error(e);
    root.innerHTML = `<p class="empty">Не удалось загрузить список пространств. ${escapeHtml(e.message)}.
      Если вы запускаете сайт локально, выполните <code>bash tools/build-manifest.sh</code>.</p>`;
  }
}

init();
