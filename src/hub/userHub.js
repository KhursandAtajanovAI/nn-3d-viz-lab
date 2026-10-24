// Блок «Мои» в каталоге: создание своих пространств (IndexedDB).
// Тексты пользователя выводятся только через escapeHtml / textContent.
import { LIMITS } from '../engine/spaceFormat.js';
import { saveSpace } from '../engine/userStore.js';
import { newSpaceFile } from '../engine/userSpace.js';

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
