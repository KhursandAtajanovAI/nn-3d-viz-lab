// Свои диалоги вместо confirm / prompt / alert: в стиле проекта, на всех темах, с клавиатурой
// (Enter — подтвердить, Esc — отмена). Работают и в каталоге, и на странице пространства.
// Все тексты выводятся через textContent — пользовательские строки не попадают в HTML.

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Модальный диалог.
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.text] — пояснение; перевод строки — новый абзац
 * @param {{ label: string, value?: string, maxLength?: number, validate?: (v: string) => string }} [o.input] — поле ввода
 * @param {string} [o.okText]
 * @param {string|null} [o.cancelText] — null: без кнопки отмены
 * @param {boolean} [o.danger] — необратимое действие: красная кнопка, фокус на «Отмена»
 * @returns {Promise<boolean|string|null>} confirm: true/false; с полем ввода: строка или null
 */
export function showDialog({ title, text = '', input = null, okText = 'OK', cancelText = 'Отмена', danger = false }) {
  return new Promise(resolve => {
    const before = document.activeElement;
    const dlg = el('dialog', 'ui-dialog');
    dlg.setAttribute('aria-labelledby', 'ui-dialog-title');
    const form = el('form');
    form.method = 'dialog';
    const h = el('h2', '', title);
    h.id = 'ui-dialog-title';
    form.append(h);
    for (const p of String(text).split('\n').filter(Boolean)) form.append(el('p', 'ui-dialog-text', p));

    let field = null, err = null;
    if (input) {
      const label = el('label', '', input.label);
      label.htmlFor = 'ui-dialog-input';
      field = el('input');
      field.type = 'text';
      field.id = 'ui-dialog-input';
      field.value = input.value ?? '';
      if (input.maxLength) field.maxLength = input.maxLength;
      err = el('p', 'ui-dialog-error error-text');
      err.setAttribute('role', 'alert');
      form.append(label, field, err);
      field.addEventListener('input', () => { err.textContent = ''; });
    }

    const row = el('div', 'ui-dialog-buttons');
    const cancelValue = input ? null : false;
    let cancel = null;
    if (cancelText !== null) {
      cancel = el('button', 'ui-dialog-btn', cancelText);
      cancel.type = 'button';
      cancel.addEventListener('click', () => finish(cancelValue));
      row.append(cancel);
    }
    const ok = el('button', `ui-dialog-btn ${danger ? 'danger' : 'primary'}`, okText);
    ok.type = 'submit';
    row.append(ok);
    form.append(row);
    dlg.append(form);

    let done = false;
    function finish(value) {
      if (done) return;
      done = true;
      dlg.close();
      dlg.remove();
      before?.focus?.();
      resolve(value);
    }
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!field) { finish(true); return; }
      const v = field.value.trim();
      const msg = input.validate?.(v) ?? '';
      if (msg) { err.textContent = msg; field.focus(); return; }
      finish(v);
    });
    // Esc и закрытие браузером — это «Отмена»
    dlg.addEventListener('cancel', e => { e.preventDefault(); finish(cancelValue); });

    document.body.append(dlg);
    dlg.showModal();
    if (field) { field.focus(); field.select(); }
    else (danger && cancel ? cancel : ok).focus();
  });
}

/** Подтверждение: true — «да», false — отмена */
export const confirmDialog = ({ title, text, okText = 'Да', cancelText = 'Отмена', danger = false }) =>
  showDialog({ title, text, okText, cancelText, danger });

/** Ввод строки: строка (без пробелов по краям) или null при отмене */
export const promptDialog = ({ title, text, label, value = '', maxLength, validate, okText = 'Сохранить' }) =>
  showDialog({ title, text, input: { label, value, maxLength, validate }, okText });

/** Сообщение с одной кнопкой */
export const alertDialog = ({ title, text, okText = 'Понятно' }) =>
  showDialog({ title, text, okText, cancelText: null });
