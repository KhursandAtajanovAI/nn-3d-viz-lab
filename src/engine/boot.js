// Точка входа space.html: загружает конфиг spaces/<id>.js и запускает нужный визуализатор.
import { isValidSpaceId } from './catalog.js';
import { escapeHtml } from './format.js';
import { isValidUserId } from './spaceFormat.js';
import { initI18n, t, T, str, onLangChange, langSwitchHtml } from '../i18n/i18n.js';

await initI18n();

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
  graph: () => import('./GraphLab.js').then(m => m.GraphLab), // только пользовательские пространства
};

const sidebar = document.getElementById('sidebar');
const container = document.getElementById('scene');

let pageTitle = () => 'NN 3D Viz Lab';
const setTitle = () => { document.title = `${pageTitle()} — NN 3D Viz Lab`; };
onLangChange(setTitle);

/** Страница ошибки: titleKey и detailsKey — ключи словаря (boot.*), extra — уже экранированный HTML */
function fail(titleKey, detailsKey, params, extra = '') {
  pageTitle = () => t(titleKey);
  setTitle();
  sidebar.innerHTML = `
    <header class="brand"><div class="brand-top"><a class="back" href="./">${T('lab.backToCatalog')}</a>${langSwitchHtml()}</div><h1>${T(titleKey)}</h1></header>
    <section class="card"><p>${T(detailsKey, params)}${extra}</p></section>`;
  container.innerHTML = '';
}

/** Пользовательское пространство из IndexedDB: space.html?user=<id> */
async function loadUserSpace(id) {
  if (!isValidUserId(id)) {
    fail('boot.notFound', 'boot.badUserLinkHtml');
    return null;
  }
  const [{ getSpace }, { toRuntimeConfig }] = await Promise.all([import('./userStore.js'), import('./userSpace.js')]);
  let rec;
  try {
    rec = await getSpace(id);
  } catch (e) {
    fail('boot.storageUnavailable', 'boot.errorText', { msg: e.message });
    return null;
  }
  if (!rec) {
    fail('boot.notFound', 'boot.noUserSpaceHtml');
    return null;
  }
  if (!rec.check.ok) {
    fail('boot.damaged', 'boot.damagedText', undefined, `<br />${rec.check.errors.map(escapeHtml).join('<br />')}`);
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
    return fail('boot.notSelected', 'boot.notSelectedHtml');
  }

  let space;
  try {
    space = (await import(`../../spaces/${id}.js`)).default;
  } catch (e) {
    console.error(e);
    return fail('boot.notFound', 'boot.loadFailedHtml', { id });
  }

  await start(space);
}

async function start(space) {
  const load = VISUALIZERS[space.type ?? 'mlp'];
  if (!load) {
    return fail('boot.unsupportedTitle', 'boot.unsupported', { type: String(space.type) });
  }

  pageTitle = () => str(space.meta.title);
  setTitle();
  const Visualizer = await load();
  window.lab = new Visualizer(space, { sidebar, container }); // для отладки из консоли
  // Пользовательское пространство: карточка «Моё пространство» (сохранение и скачивание)
  if (space.user) {
    const { attachUserCard, mlpToFile } = await import('./userSpace.js');
    const lab = window.lab;
    if (space.type === 'graph') await lab.ready;
    attachUserCard(lab, {
      toFile: () => (space.type === 'graph' ? lab.toFile() : mlpToFile(lab)),
      notes: () => lab.fileNotes ?? [],
    });
  }
}

boot();
