// Каталог пространств. Список берётся из spaces/manifest.json, метаданные — из самих конфигов
// (они не импортируют Three.js, поэтому загружаются быстро).
//
// Фильтры: категория, тег, уровень, тип вычислений и поиск. Они сочетаются друг с другом
// и сохраняются в адресе страницы (?cat=…&tag=…&level=…&fid=…&q=…), поэтому ссылку можно отправить.
import { CATEGORIES, LEVELS, FIDELITY, categoryById, loadManifest } from '../engine/catalog.js';
import { escapeHtml, plural } from '../engine/format.js';
import { previewSvg } from './previews.js';

const $ = id => document.getElementById(id);
const root = $('catalog');
const search = $('search');

let spaces = [];
const state = { cat: 'all', tag: null, level: null, fid: null, q: '' };

// ---------- Фильтрация ----------

const norm = s => String(s ?? '').toLowerCase().replace(/ё/g, 'е');

function searchText(s) {
  const m = s.meta;
  return norm([
    m.title, m.summary, m.uses, ...(m.tags ?? []),
    categoryById(m.category)?.title, LEVELS[m.level], FIDELITY[m.fidelity]?.title,
  ].join(' '));
}

/** Проходит ли пространство фильтры; except — какой фильтр не учитывать (для счётчиков) */
function passes(s, except = null) {
  const m = s.meta;
  if (except !== 'cat' && state.cat !== 'all' && m.category !== state.cat) return false;
  if (except !== 'tag' && state.tag && !(m.tags ?? []).includes(state.tag)) return false;
  if (except !== 'level' && state.level && String(m.level) !== state.level) return false;
  if (except !== 'fid' && state.fid && m.fidelity !== state.fid) return false;
  if (except !== 'q' && state.q) {
    const text = s.searchText;
    // Все слова запроса должны встретиться (в любом порядке)
    if (!norm(state.q).split(/\s+/).filter(Boolean).every(w => text.includes(w))) return false;
  }
  return true;
}

// ---------- Отрисовка ----------

function cardHtml(s) {
  const m = s.meta;
  const href = `space.html?id=${encodeURIComponent(m.id)}`;
  const tagBtn = (kind, value, label, extra = '') =>
    `<button type="button" class="tag ${extra}" data-${kind}="${escapeHtml(value)}"
      aria-pressed="${(kind === 'tag' && state.tag === value) || (kind === 'level' && state.level === String(value)) || (kind === 'fid' && state.fid === value)}"
      title="Показать только: ${escapeHtml(label)}">${escapeHtml(label)}</button>`;
  return `
    <article class="space-card">
      <a class="preview-link" href="${href}" tabindex="-1" aria-hidden="true">${previewSvg(m.preview)}</a>
      <div class="body">
        <h3><a class="title-link" href="${href}">${escapeHtml(m.title)}</a></h3>
        <p>${escapeHtml(m.summary ?? '')}</p>
        ${m.uses ? `<p class="uses"><span class="muted">Где применяется:</span> ${escapeHtml(m.uses)}</p>` : ''}
        <div class="tags">
          ${m.fidelity ? tagBtn('fid', m.fidelity, FIDELITY[m.fidelity].title, `fidelity ${m.fidelity}`) : ''}
          ${m.level ? tagBtn('level', m.level, LEVELS[m.level], 'level') : ''}
          ${(m.tags ?? []).map(t => tagBtn('tag', t, t)).join('')}
        </div>
        <a class="open" href="${href}">Открыть пространство →</a>
      </div>
    </article>`;
}

function renderCatalog() {
  const visible = spaces.filter(s => passes(s));
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

  root.innerHTML = sections || `
    <div class="empty">
      <p>Ничего не найдено по текущим фильтрам.</p>
      <button type="button" class="reset" data-reset>Сбросить фильтры</button>
    </div>`;

  $('result-count').textContent = visible.length === spaces.length
    ? `Показаны все ${spaces.length} ${plural(spaces.length, ['пространство', 'пространства', 'пространств'])}`
    : `Найдено: ${visible.length} из ${spaces.length}`;
}

function renderCategoryFilters() {
  // Счётчик у категории учитывает все остальные фильтры (тег, поиск…), но не саму категорию
  const base = spaces.filter(s => passes(s, 'cat'));
  const chips = [{ id: 'all', title: 'Все', icon: '' }, ...CATEGORIES];
  $('filters').innerHTML = chips.map(c => {
    const n = c.id === 'all' ? base.length : base.filter(s => s.meta.category === c.id).length;
    const total = c.id === 'all' ? spaces.length : spaces.filter(s => s.meta.category === c.id).length;
    if (c.id !== 'all' && !total) return '';
    return `<button type="button" data-cat="${c.id}" aria-pressed="${c.id === state.cat}" ${n === 0 ? 'class="dim"' : ''}>
      ${c.icon ? `<span class="icon">${c.icon}</span> ` : ''}${escapeHtml(c.title)} <span class="count">${n}</span></button>`;
  }).join('');
}

function renderTagCloud() {
  const base = spaces.filter(s => passes(s, 'tag'));
  const counts = new Map();
  for (const s of base) for (const t of s.meta.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  const all = [...new Set(spaces.flatMap(s => s.meta.tags ?? []))]
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b, 'ru'));
  $('tag-cloud').innerHTML = all.map(t => `
    <button type="button" class="tag" data-tag="${escapeHtml(t)}" aria-pressed="${state.tag === t}"
      ${counts.get(t) ? '' : 'disabled'}>${escapeHtml(t)} <span class="count">${counts.get(t) ?? 0}</span></button>`).join('');
}

function renderActiveFilters() {
  const chips = [];
  if (state.cat !== 'all') chips.push(['cat', `Категория: ${categoryById(state.cat)?.title}`]);
  if (state.tag) chips.push(['tag', `Тег: ${state.tag}`]);
  if (state.level) chips.push(['level', `Уровень: ${LEVELS[state.level]}`]);
  if (state.fid) chips.push(['fid', FIDELITY[state.fid]?.title]);
  if (state.q) chips.push(['q', `Поиск: «${state.q}»`]);
  $('active-filters').innerHTML = chips.length ? `
    ${chips.map(([k, label]) => `<button type="button" class="active-chip" data-clear="${k}" title="Убрать фильтр">${escapeHtml(label)} <span aria-hidden="true">✕</span></button>`).join('')}
    <button type="button" class="reset" data-reset>Сбросить всё</button>` : '';
}

function render() {
  renderCategoryFilters();
  renderTagCloud();
  renderActiveFilters();
  renderCatalog();
  syncUrl();
}

// ---------- Состояние в адресе ----------

function syncUrl() {
  const p = new URLSearchParams();
  if (state.cat !== 'all') p.set('cat', state.cat);
  if (state.tag) p.set('tag', state.tag);
  if (state.level) p.set('level', state.level);
  if (state.fid) p.set('fid', state.fid);
  if (state.q) p.set('q', state.q);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.cat = categoryById(p.get('cat')) ? p.get('cat') : 'all';
  state.tag = p.get('tag');
  state.level = LEVELS[p.get('level')] ? p.get('level') : null;
  state.fid = FIDELITY[p.get('fid')] ? p.get('fid') : null;
  state.q = p.get('q') ?? '';
  search.value = state.q;
}

// ---------- События ----------

document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.cat) state.cat = d.cat;
  else if (d.tag) state.tag = state.tag === d.tag ? null : d.tag; // повторный клик снимает фильтр
  else if (d.level) state.level = state.level === d.level ? null : d.level;
  else if (d.fid) state.fid = state.fid === d.fid ? null : d.fid;
  else if (d.clear) {
    if (d.clear === 'cat') state.cat = 'all';
    else if (d.clear === 'q') { state.q = ''; search.value = ''; }
    else state[d.clear] = null;
  } else if ('reset' in d) {
    Object.assign(state, { cat: 'all', tag: null, level: null, fid: null, q: '' });
    search.value = '';
  } else return;
  render();
  if (d.tag || d.level || d.fid) $('toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

let searchTimer;
search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = search.value.trim(); render(); }, 120);
});
search.addEventListener('keydown', e => {
  if (e.key === 'Escape') { search.value = ''; state.q = ''; render(); }
});

// ---------- Загрузка ----------

async function init() {
  try {
    const ids = await loadManifest();
    const results = await Promise.allSettled(ids.map(id => import(`../../spaces/${id}.js`)));
    spaces = results.flatMap((r, i) => {
      if (r.status === 'fulfilled' && r.value.default?.meta) return [r.value.default];
      console.warn(`Пространство ${ids[i]} не загрузилось`, r.reason);
      return [];
    });
    for (const s of spaces) s.searchText = searchText(s);
    $('total').textContent = spaces.length;
    $('total-categories').textContent = new Set(spaces.map(s => s.meta.category)).size;
    readUrl();
    render();
  } catch (e) {
    console.error(e);
    root.innerHTML = `<p class="empty">Не удалось загрузить список пространств. ${escapeHtml(e.message)}.
      Если вы запускаете сайт локально, выполните <code>bash tools/build-manifest.sh</code>.</p>`;
  }
}

init();
