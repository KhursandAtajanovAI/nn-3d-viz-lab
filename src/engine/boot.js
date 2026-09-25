// Точка входа space.html: загружает конфиг spaces/<id>.js и запускает нужный визуализатор.
import { isValidSpaceId } from './catalog.js';
import { escapeHtml } from './format.js';

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

async function boot() {
  const id = new URLSearchParams(location.search).get('id');
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

  const load = VISUALIZERS[space.type ?? 'mlp'];
  if (!load) {
    return fail(space.meta?.title ?? id, `Тип визуализации «${escapeHtml(space.type)}» пока не поддерживается.`);
  }

  document.title = `${space.meta.title} — NN 3D Viz Lab`;
  const Visualizer = await load();
  window.lab = new Visualizer(space, { sidebar, container }); // для отладки из консоли
}

boot();
