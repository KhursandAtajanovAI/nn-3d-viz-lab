// Точка входа space.html: загружает конфиг spaces/<id>.js и запускает нужный визуализатор.
import { isValidSpaceId } from './catalog.js';
import { escapeHtml } from './format.js';
import { isValidUserId } from './spaceFormat.js';

// Визуализаторы по полю `type` конфига. Новый тип визуализации = новая строка здесь;
// сами пространства при этом остаются просто файлами с данными.
const VISUALIZERS = {
  mlp: () => import('./NetworkLab.js').then(m => m.NetworkLab),
  stack: () => import('./StackLab.js').then(m => m.StackLab),
  tokens: () => import('./TokensLab.js').then(m => m.TokensLab),
  scatter: () => import('./ScatterLab.js').then(m => m.ScatterLab),
  surface: () => import('./SurfaceLab.js').then(m => m.SurfaceLab),
  train: () => import('./TrainLab.js').then(m => m.TrainLab),
  gridworld: () => import('./GridLab.js').then(m => m.GridLab),
};

const sidebar = document.getElementById('sidebar');
const container = document.getElementById('scene');

function fail(title, details) {
  document.title = `${title} — NN 3D Viz Lab`;
  sidebar.innerHTML = `
    <header class="brand"><a class="back" href="./">← Каталог</a><h1>${escapeHtml(title)}</h1></header>
    <section class="card"><p>${details}</p></section>`;
  container.innerHTML = '';
}

/** Пользовательское пространство из IndexedDB: space.html?user=<id> */
async function loadUserSpace(id) {
  if (!isValidUserId(id)) {
    fail('Пространство не найдено', 'Неверная ссылка на пользовательское пространство. Откройте его из блока «Мои» в <a href="./">каталоге</a>.');
    return null;
  }
  const [{ getSpace }, { toRuntimeConfig }] = await Promise.all([import('./userStore.js'), import('./userSpace.js')]);
  let rec;
  try {
    rec = await getSpace(id);
  } catch (e) {
    fail('Хранилище недоступно', escapeHtml(e.message));
    return null;
  }
  if (!rec) {
    fail('Пространство не найдено', 'В этом браузере нет такого пространства — возможно, оно удалено или создано в другом браузере. Вернитесь в <a href="./#my-spaces">каталог</a>.');
    return null;
  }
  if (!rec.check.ok) {
    fail('Пространство повреждено', `Сохранённые данные не прошли проверку:<br />${rec.check.errors.map(escapeHtml).join('<br />')}`);
    return null;
  }
  return toRuntimeConfig(id, rec.check.space);
}

async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.has('user')) {
    const space = await loadUserSpace(params.get('user'));
    if (space) await start(space);
    return;
  }
  const id = params.get('id');
  if (!isValidSpaceId(id)) {
    return fail('Пространство не выбрано', 'Откройте пространство из <a href="./">каталога</a>.');
  }

  let space;
  try {
    space = (await import(`../../spaces/${id}.js`)).default;
  } catch (e) {
    console.error(e);
    return fail('Пространство не найдено', `Не удалось загрузить <code>spaces/${escapeHtml(id)}.js</code>. Вернитесь в <a href="./">каталог</a>.`);
  }

  await start(space);
}

async function start(space) {
  const load = VISUALIZERS[space.type ?? 'mlp'];
  if (!load) {
    return fail(space.meta?.title ?? 'Пространство', `Тип визуализации «${escapeHtml(space.type)}» пока не поддерживается.`);
  }

  document.title = `${space.meta.title} — NN 3D Viz Lab`;
  const Visualizer = await load();
  window.lab = new Visualizer(space, { sidebar, container }); // для отладки из консоли
  // Пользовательская полносвязная сеть: карточка «Моё пространство» (сохранение и скачивание)
  if (space.user && space.type === 'mlp') {
    const { attachUserCard, mlpToFile } = await import('./userSpace.js');
    attachUserCard(window.lab, { toFile: () => mlpToFile(window.lab) });
  }
}

boot();
