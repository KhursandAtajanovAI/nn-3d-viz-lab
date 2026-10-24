// Блок «Мои» в каталоге: создание, список, переименование и удаление своих пространств (IndexedDB).
// Тексты пользователя выводятся только через escapeHtml / textContent.
import { LIMITS } from '../engine/spaceFormat.js';
import { saveSpace, listSpaces, renameSpace, deleteSpace } from '../engine/userStore.js';
import { newSpaceFile } from '../engine/userSpace.js';
import { plural } from '../engine/format.js';

const $ = id => document.getElementById(id);

export const spaceUrl = id => `space.html?user=${encodeURIComponent(id)}`;

function dialogHtml() {
  return `
    <dialog id="create-dialog" class="dialog" aria-labelledby="create-title">
      <form method="dialog" id="create-form">
        <h2 id="create-title">Новое пространство</h2>
        <label for="cs-title">Название</label>
        <input id="cs-title" type="text" required maxlength="${LIMITS.title}" placeholder="Например: Моя первая сеть" />
        <label for="cs-summary">Краткое описание <span class="muted">(необязательно)</span></label>
        <textarea id="cs-summary" rows="2" maxlength="${LIMITS.summary}"></textarea>
        <p class="field-note muted">Категория: <b>Мои</b></p>

        <fieldset>
          <legend>Режим</legend>
          <label class="choice"><input type="radio" name="cs-mode" value="standard" checked />
            <span><b>Обычное пространство</b><br /><span class="muted">Сеть из готовых частей движка — работает сразу.</span></span></label>
          <label class="choice disabled"><input type="radio" name="cs-mode" value="code" disabled />
            <span><b>Пространство с кодом</b> <span class="soon">в доработке</span><br />
              <span class="muted">Свой JavaScript. Пока недоступно: чужой код на сайте не исполняется.</span></span></label>
        </fieldset>

        <fieldset>
          <legend>Тип</legend>
          <label class="choice"><input type="radio" name="cs-type" value="mlp" checked />
            <span><b>Полносвязная сеть</b><br /><span class="muted">3D-сцена, своя архитектура, свои веса и входы.</span></span></label>
          <label class="choice disabled" id="cs-type-graph"><input type="radio" name="cs-type" value="graph" disabled />
            <span><b>Граф блоков</b> <span class="soon">скоро</span><br /><span class="muted">Визуальный конструктор: данные → подготовка → модель → обучение → результаты.</span></span></label>
        </fieldset>

        <p id="cs-error" class="error-text" role="alert"></p>
        <div class="dialog-buttons">
          <button type="button" id="cs-cancel">Отмена</button>
          <button type="submit" id="cs-ok" class="primary-btn">Создать и открыть</button>
        </div>
      </form>
    </dialog>`;
}

export function initCreateDialog() {
  document.body.insertAdjacentHTML('beforeend', dialogHtml());
  const dlg = $('create-dialog');
  $('cs-cancel').addEventListener('click', () => dlg.close());
  $('create-form').addEventListener('submit', async e => {
    e.preventDefault();
    const title = $('cs-title').value.trim();
    if (!title) { $('cs-error').textContent = 'Введите название'; return; }
    const mode = dlg.querySelector('input[name="cs-mode"]:checked')?.value;
    if (mode !== 'standard') { $('cs-error').textContent = 'Пространства с кодом пока в доработке'; return; }
    const type = dlg.querySelector('input[name="cs-type"]:checked')?.value ?? 'mlp';
    $('cs-ok').disabled = true;
    try {
      const id = await saveSpace(newSpaceFile({ title, summary: $('cs-summary').value.trim(), type }));
      location.href = spaceUrl(id);
    } catch (err) {
      $('cs-error').textContent = err.message;
      $('cs-ok').disabled = false;
    }
  });
  return () => {
    $('create-form').reset();
    $('cs-error').textContent = '';
    $('cs-ok').disabled = false;
    dlg.showModal();
    $('cs-title').focus();
  };
}

// ---------- Список «Мои» ----------

const TYPE_TITLE = { mlp: 'Полносвязная сеть', graph: 'Граф блоков' };
const dateText = t => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Элемент с текстом (textContent — пользовательские строки никогда не попадают в innerHTML) */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function describe(file) {
  if (file.type === 'graph') {
    const n = file.graph.nodes.length, m = file.graph.edges.length;
    return `${n} ${plural(n, ['блок', 'блока', 'блоков'])}, ${m} ${plural(m, ['связь', 'связи', 'связей'])}`;
  }
  return `Слои: ${file.model.layers.join(' → ')} · ${file.model.activation}`;
}

function myCard(rec, actions) {
  const { file } = rec;
  const card = el('article', 'my-card');
  card.dataset.id = rec.id;
  const head = el('div', 'my-card-head');
  const a = el('a', 'title-link', file.meta.title);
  a.href = spaceUrl(rec.id);
  head.append(el('h3', '', ''), el('span', 'badge-type', TYPE_TITLE[file.type] ?? file.type));
  head.firstChild.append(a);
  card.append(head);
  if (file.meta.summary) card.append(el('p', 'muted', file.meta.summary));
  card.append(el('p', 'my-meta muted', `${describe(file)} · изменено ${dateText(rec.updatedAt)}`));
  const row = el('div', 'my-actions');
  const open = el('a', 'primary-btn', 'Открыть');
  open.href = spaceUrl(rec.id);
  row.append(open);
  for (const [act, label] of actions) {
    const b = el('button', 'ghost-btn', label);
    b.type = 'button';
    b.dataset.myAct = act;
    row.append(b);
  }
  card.append(row);
  return card;
}

/**
 * Отрисовать блок «Мои».
 * @param {Array<[string, string]>} [extraActions] — дополнительные кнопки карточки (например, «Скачать»)
 * @param {(act: string, rec: object) => void} [onExtra] — обработчик дополнительных кнопок
 */
export async function renderMySpaces({ extraActions = [], onExtra } = {}) {
  const list = $('my-list');
  let recs;
  try {
    recs = await listSpaces();
  } catch (e) {
    list.replaceChildren(el('p', 'error-text', e.message));
    return [];
  }
  if (!recs.length) {
    list.replaceChildren(el('p', 'muted my-empty', 'Пока пусто. Нажмите «Создать пространство» — оно появится здесь.'));
    return recs;
  }
  const actions = [['rename', 'Переименовать'], ...extraActions, ['delete', 'Удалить']];
  const grid = el('div', 'my-grid');
  grid.append(...recs.map(r => myCard(r, actions)));
  list.replaceChildren(grid);
  grid.addEventListener('click', async e => {
    const b = e.target.closest('button[data-my-act]');
    if (!b) return;
    const rec = recs.find(r => r.id === b.closest('.my-card').dataset.id);
    if (!rec) return;
    const act = b.dataset.myAct;
    try {
      if (act === 'rename') {
        const title = prompt('Новое название пространства', rec.file.meta.title);
        if (title === null) return;
        if (!title.trim()) { alert('Название не может быть пустым'); return; }
        await renameSpace(rec.id, title.trim().slice(0, LIMITS.title));
      } else if (act === 'delete') {
        if (!confirm(`Удалить пространство «${rec.file.meta.title}»? Его нельзя будет восстановить (если вы его не скачали).`)) return;
        await deleteSpace(rec.id);
      } else {
        await onExtra?.(act, rec);
        return;
      }
      await renderMySpaces({ extraActions, onExtra });
    } catch (err) {
      alert(err.message);
    }
  });
  return recs;
}
