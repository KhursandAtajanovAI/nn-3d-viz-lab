// Необязательный блок «Свои веса и вход» для полносвязной сети (конструктор и пользовательские пространства).
// По умолчанию свёрнут и ничего не меняет: сеть работает со случайными весами, как раньше.
//
// Состояние:
//   draft — то, что в таблице: weights[l][j][i] и biases[l][j]; null — пустая ячейка (после смены архитектуры)
//   given — последние применённые «свои» веса (для кнопки «Вернуть заданные»)
// Проверки размеров и чисел — общим валидатором spaceFormat.js.
import { checkWeights, checkInput, checkLayers, parseNumberList } from './spaceFormat.js';
import { t, T, At, L } from '../i18n/i18n.js';

const clone = ({ weights, biases }) => ({ weights: weights.map(W => W.map(r => r.slice())), biases: biases.map(b => b.slice()) });
// В ячейках — до 4 знаков; в draft остаются точные значения, пока ячейку не отредактируют
const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, useGrouping: false });
const fmt = v => (v === null || v === undefined ? '' : NUM.format(v));

/** Разложить веса под новую архитектуру: совпадающие индексы сохраняются, остальное — null */
export function remapWeights(src, layers) {
  const weights = [], biases = [];
  for (let l = 0; l < layers.length - 1; l++) {
    const W = src?.weights?.[l], B = src?.biases?.[l];
    weights.push(Array.from({ length: layers[l + 1] }, (_, j) =>
      Array.from({ length: layers[l] }, (_, i) => W?.[j]?.[i] ?? null)));
    biases.push(Array.from({ length: layers[l + 1] }, (_, j) => B?.[j] ?? null));
  }
  return { weights, biases };
}

const countHoles = d => d.weights.flat(2).filter(v => v === null).length + d.biases.flat().filter(v => v === null).length;

export class CustomWeightsPanel {
  /**
   * @param {object} lab — NetworkLab: model, rebuildView(), setStatus(), applyArchitecture(layers)
   * @param {HTMLElement} root — контейнер карточки (details)
   * @param {{ customInput?: number[] }} [initial]
   */
  constructor(lab, root, initial = {}) {
    this.lab = lab;
    this.root = root;
    this.given = null;
    this.dirty = false;
    this.gap = 0;
    this.draft = clone(lab.model.snapshot());
    if (initial.given) { this.given = clone(initial.given); this.applied = true; } // createModel() уже применил их
    this.render();
    if (initial.customInput) {
      this.$('input').value = initial.customInput.join(', ');
      this.$('use-input').checked = true;
    }
    this.bind();
  }

  static html() {
    return `
      <details class="card" id="custom-card">
        <summary><h2>${T('cw.title')}</h2> <span class="muted small">${T('cw.optional')}</span></summary>
        <div id="cw-body"></div>
      </details>`;
  }

  $(id) { return this.root.querySelector(`#cw-${id}`); }

  render() {
    this.root.querySelector('#cw-body').innerHTML = `
      <p class="small muted">${T('cw.intro')}</p>

      <h3 class="cw-title">${T('cw.input')}</h3>
      <label class="check"><input type="checkbox" id="cw-use-input" /> ${T('cw.useInput')}</label>
      <input type="text" id="cw-input" spellcheck="false" inputmode="decimal" ${At('placeholder', 'cw.inputPlaceholder')} />
      <p class="small muted" id="cw-input-hint"></p>

      <h3 class="cw-title">${T('cw.weights')}</h3>
      <label for="cw-gap">${T('cw.gap')}</label>
      <select id="cw-gap"></select>
      <div class="cw-table-wrap" id="cw-table"></div>
      <p class="small" id="cw-state" role="status"></p>
      <div class="cw-buttons">
        <button type="button" id="cw-apply" class="primary">${T('cw.apply')}</button>
        <button type="button" id="cw-fill">${T('cw.fill')}</button>
        <button type="button" id="cw-reset">${T('cw.reset')}</button>
        <button type="button" id="cw-restore">${T('cw.restore')}</button>
      </div>

      <details class="cw-json">
        <summary>JSON</summary>
        <p class="small muted">${T('cw.jsonHelpHtml')}</p>
        <textarea id="cw-json" rows="6" spellcheck="false"></textarea>
        <div class="row">
          <button type="button" id="cw-json-show">${T('cw.jsonShow')}</button>
          <button type="button" id="cw-json-apply">${T('cw.jsonApply')}</button>
        </div>
      </details>
      <p class="small" id="cw-error" role="alert"></p>`;
    this.refresh();
  }

  get layers() { return this.lab.model.layers; }

  /** Смена языка: подписи, собранные из данных (список промежутков, таблица, состояние) */
  onLang() {
    const extra = this.lastExtra;
    this.refresh();
    if (extra) this.renderState(extra);
  }

  /** Перерисовать список промежутков, таблицу и строку состояния */
  refresh() {
    const layers = this.layers;
    this.gap = Math.min(this.gap, layers.length - 2);
    this.$('gap').innerHTML = layers.slice(0, -1).map((n, l) =>
      `<option value="${l}"${l === this.gap ? ' selected' : ''}>${t('cw.gapOption', { a: l + 1, b: l + 2, n, m: layers[l + 1] })}</option>`).join('');
    this.$('input-hint').textContent = t('cw.inputHint', { n: layers[0] });
    if (this.root.open) this.renderTable();
    this.renderState();
  }

  renderTable() {
    const l = this.gap, nIn = this.layers[l], nOut = this.layers[l + 1];
    const W = this.draft.weights[l], B = this.draft.biases[l];
    const head = Array.from({ length: nIn }, (_, i) => `<th scope="col" title="${t('cw.neuronOfLayer', { n: i + 1, l: l + 1 })}">${i + 1}</th>`).join('');
    const rows = Array.from({ length: nOut }, (_, j) => `<tr><th scope="row" title="${t('cw.neuronOfLayer', { n: j + 1, l: l + 2 })}">${j + 1}</th>${
      Array.from({ length: nIn }, (_, i) => `<td><input data-j="${j}" data-i="${i}" value="${fmt(W[j][i])}" inputmode="decimal" aria-label="${t('cw.weightLabel', { i: i + 1, j: j + 1 })}"${W[j][i] === null ? ' class="empty"' : ''} /></td>`).join('')
    }<td class="cw-bias"><input data-j="${j}" data-b="1" value="${fmt(B[j])}" inputmode="decimal" aria-label="${t('cw.biasLabel', { j: j + 1 })}"${B[j] === null ? ' class="empty"' : ''} /></td></tr>`).join('');
    this.$('table').innerHTML = `
      <table class="cw-table">
        <thead><tr><th class="cw-corner" title="${t('cw.cornerHint', { a: l + 2, b: l + 1 })}">${t('cw.corner')}</th>${head}<th class="cw-bias" title="${t('cw.biasHint')}">b</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  /** extra — L(...) с пояснением к последнему действию (переводится при смене языка) */
  renderState(extra = null) {
    this.lastExtra = extra;
    const holes = countHoles(this.draft);
    const el = this.$('state');
    let text;
    if (holes) text = t('cw.stateHoles', { n: holes });
    else if (this.applied) text = t('cw.stateApplied');
    else text = this.dirty ? t('cw.stateDirty') : t('cw.stateRandom');
    el.textContent = extra ? `${t(extra)} ${text}` : text;
    el.classList.toggle('warn', holes > 0);
    this.$('fill').disabled = holes === 0;
    this.$('restore').disabled = !this.given;
  }

  error(msgs) {
    const el = this.$('error');
    el.textContent = Array.isArray(msgs) ? msgs.slice(0, 5).join('\n') : (msgs ?? '');
    el.classList.toggle('error-text', !!el.textContent);
  }

  /** Применить веса к сети (после проверки) */
  applyWeights(w, note) {
    const errors = checkWeights(this.layers, w.weights, w.biases);
    if (errors.length) { this.error(errors); return false; }
    this.lab.model.restore(w);
    this.given = clone(w);
    this.draft = clone(w);
    this.applied = true;
    this.dirty = false;
    this.error('');
    this.lab.rebuildView();
    this.refresh();
    this.lab.setStatus(note);
    return true;
  }

  /** Сеть получила новые случайные веса (кнопка «Новые веса» или смена архитектуры без своих весов) */
  syncFromModel() {
    this.draft = clone(this.lab.model.snapshot());
    this.applied = false;
    this.dirty = false;
    this.refresh();
  }

  /** Архитектура изменилась: введённое сохраняется там, где размеры совпали */
  onArchitectureChange() {
    if (!this.given && !this.dirty) { this.syncFromModel(); return; }
    const before = this.draft.weights.flat(2).length + this.draft.biases.flat().length;
    this.draft = remapWeights(this.draft, this.layers);
    const holes = countHoles(this.draft);
    const kept = this.draft.weights.flat(2).length + this.draft.biases.flat().length - holes;
    this.applied = false;
    this.dirty = true;
    this.refresh();
    this.renderState(L('cw.archChanged', { kept, n: before }));
    if (!holes) this.applyWeights(this.draft, L('cw.moved'));
  }

  /** Вход для прогона: свой (если включён) или null */
  customInput() {
    if (!this.$('use-input').checked) return null;
    const values = parseNumberList(this.$('input').value);
    const errors = checkInput(values.map(v => v ?? NaN), this.layers[0]);
    if (errors.length) throw new Error(t('cw.inputError', { err: errors[0] }));
    return values;
  }

  get settings() {
    const values = parseNumberList(this.$('input').value);
    return this.$('use-input').checked && !checkInput(values.map(v => v ?? NaN), this.layers[0]).length ? { customInput: values } : {};
  }

  bind() {
    // Таблица строится только когда блок раскрыт: у сети 64 × 64 это тысячи полей
    this.root.addEventListener('toggle', () => { if (this.root.open) this.renderTable(); });
    this.$('gap').addEventListener('change', () => { this.gap = Number(this.$('gap').value); this.renderTable(); });
    this.$('table').addEventListener('input', e => {
      const el = e.target;
      if (el.tagName !== 'INPUT') return;
      const t = el.value.trim();
      const v = t === '' ? null : Number(t.replace(',', '.'));
      const bad = t !== '' && !Number.isFinite(v);
      el.classList.toggle('invalid', bad);
      el.classList.toggle('empty', t === '');
      const j = Number(el.dataset.j);
      if (el.dataset.b) this.draft.biases[this.gap][j] = bad ? null : v;
      else this.draft.weights[this.gap][j][Number(el.dataset.i)] = bad ? null : v;
      this.dirty = true;
      this.applied = false;
      this.renderState();
    });
    this.$('apply').addEventListener('click', () => {
      const invalid = this.$('table').querySelectorAll('input.invalid').length;
      if (invalid) { this.error(t('cw.invalidCells', { n: invalid })); return; }
      const holes = countHoles(this.draft);
      if (holes) { this.error(t('cw.emptyCells', { n: holes })); return; }
      this.applyWeights(this.draft, L('cw.applied'));
    });
    this.$('fill').addEventListener('click', () => {
      const rnd = this.lab.model.snapshot(); // сеть сейчас со случайными весами новой архитектуры
      const filled = {
        weights: this.draft.weights.map((W, l) => W.map((r, j) => r.map((v, i) => v ?? rnd.weights[l][j][i]))),
        biases: this.draft.biases.map((b, l) => b.map((v, j) => v ?? rnd.biases[l][j])),
      };
      this.applyWeights(filled, L('cw.filled'));
    });
    this.$('reset').addEventListener('click', () => {
      this.lab.model.randomize();
      this.lab.rebuildView();
      this.syncFromModel();
      this.error('');
      this.lab.setStatus(L(this.given ? 'cw.randomCanRestore' : 'cw.random'));
    });
    this.$('restore').addEventListener('click', () => {
      if (!this.given) return;
      const errors = checkWeights(this.layers, this.given.weights, this.given.biases);
      if (errors.length) {
        const given = [this.given.weights[0]?.[0]?.length ?? 0, ...this.given.biases.map(b => b.length)];
        this.error(t('cw.restoreMismatch', { a: given.join(' → '), b: this.layers.join(' → ') }));
        return;
      }
      this.applyWeights(this.given, L('cw.restored'));
    });
    this.$('json-show').addEventListener('click', () => {
      const w = this.lab.model.snapshot();
      const round = v => Math.round(v * 1e6) / 1e6;
      this.$('json').value = JSON.stringify({ layers: this.layers, weights: w.weights.map(W => W.map(r => r.map(round))), biases: w.biases.map(b => b.map(round)) });
      this.error('');
    });
    this.$('json-apply').addEventListener('click', () => this.applyJson(this.$('json').value));
    this.$('input').addEventListener('input', () => {
      if (this.$('input').value.trim()) this.$('use-input').checked = true;
      this.checkInputField();
    });
    this.$('use-input').addEventListener('change', () => this.checkInputField());
  }

  checkInputField() {
    try {
      this.customInput();
      this.$('input').classList.remove('invalid');
      this.error('');
    } catch (e) {
      this.$('input').classList.add('invalid');
      this.error(e.message);
    }
  }

  applyJson(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { this.error(t('cw.jsonBad', { msg: e.message })); return; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) { this.error(t('cw.jsonNotObject')); return; }
    const src = data.model && typeof data.model === 'object' ? data.model : data;
    if (src.layers !== undefined) {
      const errs = checkLayers(src.layers);
      if (errs.length) { this.error(errs); return; }
      const errsW = checkWeights(src.layers, src.weights, src.biases);
      if (errsW.length) { this.error(errsW); return; }
      if (src.layers.join() !== this.layers.join()) this.lab.applyArchitecture(src.layers, { keepCustom: false });
    }
    this.applyWeights({ weights: src.weights, biases: src.biases }, L('cw.fromJson'));
  }
}
