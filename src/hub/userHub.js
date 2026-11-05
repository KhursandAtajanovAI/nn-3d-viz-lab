// Блок «Мои» в каталоге: создание, список, переименование и удаление своих пространств (IndexedDB).
// Тексты пользователя выводятся только через escapeHtml / textContent.
import { LIMITS } from '../engine/spaceFormat.js';
import { saveSpace, listSpaces, renameSpace, deleteSpace } from '../engine/userStore.js';
import { newSpaceFile } from '../engine/userSpace.js';
import { t, H, T, At, L, setT, locale } from '../i18n/i18n.js';
import { downloadSpaceFile, importSpaceFile, pickFile } from '../engine/spaceFile.js';
import { confirmDialog, promptDialog, alertDialog } from '../engine/dialogs.js';

const $ = id => document.getElementById(id);

export const spaceUrl = id => `space.html?user=${encodeURIComponent(id)}`;

function dialogHtml() {
  return `
    <dialog id="create-dialog" class="dialog" aria-labelledby="create-title">
      <form method="dialog" id="create-form">
        <h2 id="create-title">${T('my.newTitle')}</h2>
        <label for="cs-title">${T('my.fieldTitle')}</label>
        <input id="cs-title" type="text" required maxlength="${LIMITS.title}" ${At('placeholder', 'my.fieldTitlePlaceholder')} />
        <label for="cs-summary">${T('my.fieldSummary')} <span class="muted">${T('my.optional')}</span></label>
        <textarea id="cs-summary" rows="2" maxlength="${LIMITS.summary}"></textarea>
        <p class="field-note muted">${T('my.categoryNoteHtml')}</p>

        <fieldset>
          <legend>${T('my.mode')}</legend>
          <label class="choice"><input type="radio" name="cs-mode" value="standard" checked />
            <span><b>${T('my.modeStandard')}</b><br /><span class="muted">${T('my.modeStandardHint')}</span></span></label>
          <label class="choice disabled"><input type="radio" name="cs-mode" value="code" disabled />
            <span><b>${T('my.modeCode')}</b> <span class="soon">${T('my.soon')}</span><br />
              <span class="muted">${T('my.modeCodeHint')}</span></span></label>
        </fieldset>

        <fieldset>
          <legend>${T('my.type')}</legend>
          <label class="choice"><input type="radio" name="cs-type" value="mlp" checked />
            <span><b>${T('my.typeMlp')}</b><br /><span class="muted">${T('my.typeMlpHint')}</span></span></label>
          <label class="choice" id="cs-type-graph"><input type="radio" name="cs-type" value="graph" />
            <span><b>${T('my.typeGraph')}</b><br /><span class="muted">${T('my.typeGraphHint')}</span></span></label>
        </fieldset>

        <p id="cs-error" class="error-text" role="alert"></p>
        <div class="dialog-buttons">
          <button type="button" id="cs-cancel">${T('common.cancel')}</button>
          <button type="submit" id="cs-ok" class="primary-btn">${T('my.createOpen')}</button>
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
    if (!title) { setT($('cs-error'), 'my.errNoTitle'); return; }
    const mode = dlg.querySelector('input[name="cs-mode"]:checked')?.value;
    if (mode !== 'standard') { setT($('cs-error'), 'my.errCodeMode'); return; }
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

const TYPE_KEY = { mlp: 'my.typeMlp', graph: 'my.typeGraph' };
const dateText = ms => new Date(ms).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Элемент с текстом (textContent — пользовательские строки никогда не попадают в innerHTML) */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function describe(file) {
  if (file.type === 'graph') {
    return t('my.describeGraph', { blocks: L('my.blocks', { n: file.graph.nodes.length }), links: L('my.links', { n: file.graph.edges.length }) });
  }
  return t('my.describeMlp', { layers: file.model.layers.join(' → '), act: file.model.activation });
}

function myCard(rec, actions) {
  const { file } = rec;
  const card = el('article', 'my-card');
  card.dataset.id = rec.id;
  const head = el('div', 'my-card-head');
  const a = el('a', 'title-link', file.meta.title);
  a.href = spaceUrl(rec.id);
  head.append(el('h3', '', ''), el('span', 'badge-type', TYPE_KEY[file.type] ? t(TYPE_KEY[file.type]) : file.type));
  head.firstChild.append(a);
  card.append(head);
  if (file.meta.summary) card.append(el('p', 'muted', file.meta.summary));
  card.append(el('p', 'my-meta muted', t('my.meta', { what: describe(file), date: dateText(rec.updatedAt) })));
  const row = el('div', 'my-actions');
  const open = el('a', 'primary-btn', t('my.open'));
  open.href = spaceUrl(rec.id);
  row.append(open);
  for (const [act, key] of actions) {
    const b = el('button', 'ghost-btn', t(key));
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
    list.replaceChildren(el('p', 'muted my-empty', t('my.empty')));
    return recs;
  }
  const actions = [['rename', 'my.rename'], ['download', 'my.download'], ...extraActions, ['delete', 'my.delete']];
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
        const title = await promptDialog({
          title: t('my.renameTitle'),
          label: t('my.renameLabel'),
          value: rec.file.meta.title,
          maxLength: LIMITS.title,
          validate: v => (v ? '' : t('my.errEmptyTitle')),
        });
        if (title === null || title === rec.file.meta.title) return;
        await renameSpace(rec.id, title.slice(0, LIMITS.title));
      } else if (act === 'delete') {
        const yes = await confirmDialog({
          title: t('my.deleteTitle'),
          text: t('my.deleteText', { title: rec.file.meta.title }),
          okText: t('my.delete'),
          danger: true,
        });
        if (!yes) return;
        await deleteSpace(rec.id);
      } else if (act === 'download') {
        downloadSpaceFile(rec.file);
        return;
      } else {
        await onExtra?.(act, rec);
        return;
      }
      await renderMySpaces({ extraActions, onExtra });
    } catch (err) {
      alertDialog({ title: t('common.failed'), text: err.message });
    }
  });
  return recs;
}

/** Кнопка «Загрузить файл»: проверка валидатором, новое пространство в «Мои», понятные ошибки */
export function initImport(button, msg, onDone) {
  const say = (text, kind = '') => { msg.textContent = text; msg.className = `my-msg ${kind}`; };
  button.addEventListener('click', () => pickFile(async f => {
    say(t('my.reading', { name: f.name }));
    try {
      const { title, warnings } = await importSpaceFile(f);
      say(`${t('my.imported', { title })}${warnings.length ? `\n${warnings.join('\n')}` : ''}`, 'ok-text');
      await onDone?.();
    } catch (e) {
      say(e.message, 'error-text');
    }
  }));
}
