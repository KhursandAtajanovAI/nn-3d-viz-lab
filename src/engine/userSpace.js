// Пользовательские пространства: файл nn3d-space (из IndexedDB) → конфиг для визуализатора,
// и обратно — текущее состояние пространства → файл для сохранения и скачивания.
//
// Все тексты пользователя проходят через textToHtml/escapeHtml: в HTML попадает только экранированный текст.
import { FORMAT, FORMAT_VERSION, textToHtml, checkInput } from './spaceFormat.js';
import { saveSpace } from './userStore.js';
import { downloadSpaceFile, importSpaceFile, pickFile } from './spaceFile.js';

/** Пустой файл нового пространства */
export function newSpaceFile({ title, summary = '', type = 'mlp' }) {
  const base = {
    format: FORMAT, version: FORMAT_VERSION, mode: 'standard', type,
    meta: { title, summary, uses: '', tags: [] },
    text: { intro: '', sections: [] },
    settings: {},
  };
  if (type === 'graph') return { ...base, graph: { nodes: [], edges: [], view: { x: 0, y: 0, k: 1 } }, datasets: [] };
  return { ...base, model: { layers: [3, 4, 2], activation: 'tanh', outputActivation: 'sigmoid' }, names: {}, inputs: [] };
}

/** Проверенный файл → конфиг пространства (как у spaces/<id>.js) */
export function toRuntimeConfig(id, file) {
  const meta = {
    id, title: file.meta.title, summary: file.meta.summary, uses: file.meta.uses, tags: file.meta.tags,
    category: 'user', fidelity: 'real',
  };
  const common = {
    meta,
    intro: textToHtml(file.text.intro),
    sections: file.text.sections.map(s => ({ title: s.title || 'Пояснение', html: textToHtml(s.text), open: false })),
    settings: file.settings,
    user: { id, file },
  };
  if (file.type === 'graph') return { ...common, type: 'graph', graph: file.graph, datasets: file.datasets };
  const names = {};
  if (file.names.input?.some(Boolean)) names.input = file.names.input;
  if (file.names.output?.some(Boolean)) names.output = file.names.output;
  return {
    ...common,
    type: 'mlp',
    editable: true,
    model: file.model,
    names,
    inputs: file.inputs,
  };
}

/** Текущее состояние полносвязной сети → файл nn3d-space */
export function mlpToFile(lab) {
  const { file } = lab.space.user;
  const m = lab.model;
  const snap = m.snapshot();
  const layers = m.layers.slice();
  const fit = (list, n) => (list ?? []).slice(0, n);
  const settings = { ...(lab.custom?.settings ?? {}) };
  const speed = Number(lab.ui.speed?.value);
  if (Number.isFinite(speed)) settings.speed = speed;
  return {
    format: FORMAT, version: FORMAT_VERSION, mode: 'standard', type: 'mlp',
    meta: file.meta,
    model: { layers, activation: m.activation, outputActivation: m.outputActivation, weights: snap.weights, biases: snap.biases },
    names: { input: fit(file.names.input, layers[0]), output: fit(file.names.output, layers.at(-1)) },
    inputs: file.inputs.filter(p => !checkInput(p.values, layers[0]).length),
    text: file.text,
    settings,
  };
}

/**
 * Карточка «Моё пространство» в боковой панели: сохранение в браузере и (блок D) скачивание.
 * Вставляется после шапки; работает с любым визуализатором, у которого есть toFile().
 */
export function attachUserCard(lab, { toFile, extraButtons = '' } = {}) {
  const { id } = lab.space.user;
  const speed = lab.space.settings?.speed;
  if (speed && lab.ui?.speed) {
    lab.ui.speed.value = String(speed);
    lab.ui.speed.dispatchEvent(new Event('input'));
  }
  const card = document.createElement('section');
  card.className = 'card user-card';
  card.innerHTML = `
    <h2>Моё пространство</h2>
    <p class="small muted">Хранится только в этом браузере. Изменения не сохраняются сами — нажмите «Сохранить».</p>
    <div class="row">
      <button type="button" data-act="save" class="primary">Сохранить</button>
      ${extraButtons}
    </div>
    <div class="row">
      <button type="button" data-act="download" title="Файл .nn3d.json с архитектурой, весами, входами и текстами">Скачать</button>
      <button type="button" data-act="import" title="Открыть файл .nn3d.json как новое пространство">Загрузить</button>
    </div>
    <p class="small" data-role="msg" role="status"></p>`;
  const header = lab.sidebar.querySelector('header.brand');
  header.after(card);
  const msg = card.querySelector('[data-role="msg"]');
  const say = (text, isError = false) => { msg.textContent = text; msg.classList.toggle('error-text', isError); };
  card.querySelector('[data-act="save"]').addEventListener('click', async () => {
    try {
      const file = await toFile();
      await saveSpace(file, id);
      lab.space.user.file = file;
      say(`Сохранено ${new Date().toLocaleTimeString('ru-RU')}`);
    } catch (e) {
      say(`Не сохранено: ${e.message}`, true);
    }
  });
  card.querySelector('[data-act="download"]').addEventListener('click', async () => {
    try {
      downloadSpaceFile(await toFile()); // текущее состояние, даже если оно ещё не сохранено
      say('Файл скачан');
    } catch (e) {
      say(e.message, true);
    }
  });
  card.querySelector('[data-act="import"]').addEventListener('click', () => pickFile(async f => {
    try {
      const { id: newId, title, warnings } = await importSpaceFile(f);
      msg.replaceChildren(`Загружено как новое пространство «${title}». `);
      const a = document.createElement('a');
      a.href = `space.html?user=${newId}`;
      a.textContent = 'Открыть';
      msg.append(a, warnings.length ? `\n${warnings.join('\n')}` : '');
      msg.classList.remove('error-text');
    } catch (e) {
      say(e.message, true);
    }
  }));
  return { card, say };
}
