// Необязательный блок «Свои веса и вход» для полносвязной сети (конструктор и пользовательские пространства).
// По умолчанию свёрнут и ничего не меняет: сеть работает со случайными весами, как раньше.
//
// Состояние:
//   draft — то, что в таблице: weights[l][j][i] и biases[l][j]; null — пустая ячейка (после смены архитектуры)
//   given — последние применённые «свои» веса (для кнопки «Вернуть заданные»)
// Проверки размеров и чисел — общим валидатором spaceFormat.js.
import { checkWeights, checkInput, checkLayers, parseNumberList } from './spaceFormat.js';
import { plural } from './format.js';

const clone = ({ weights, biases }) => ({ weights: weights.map(W => W.map(r => r.slice())), biases: biases.map(b => b.slice()) });
// В ячейках — до 4 знаков; в draft остаются точные значения, пока ячейку не отредактируют
const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, useGrouping: false });
const fmt = v => (v === null || v === undefined ? '' : NUM.format(v));
const VALUES = ['значение', 'значения', 'значений'];

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
    this.render();
    if (initial.customInput) {
      this.$('input').value = initial.customInput.join(', ');
      this.$('use-input').checked = true;
    }
    if (initial.given) this.given = clone(initial.given);
    this.bind();
  }

  static html() {
    return `
      <details class="card" id="custom-card">
        <summary><h2>Свои веса и вход</h2> <span class="muted small">необязательно</span></summary>
        <div id="cw-body"></div>
      </details>`;
  }

  $(id) { return this.root.querySelector(`#cw-${id}`); }

  render() {
    this.root.querySelector('#cw-body').innerHTML = `
      <p class="small muted">По умолчанию веса случайные. Здесь можно задать их вручную — таблицей или JSON —
        и подать на вход свои числа.</p>

      <h3 class="cw-title">Вход</h3>
      <label class="check"><input type="checkbox" id="cw-use-input" /> Подавать свой вход</label>
      <input type="text" id="cw-input" spellcheck="false" inputmode="decimal" placeholder="Числа через запятую" />
      <p class="small muted" id="cw-input-hint"></p>

      <h3 class="cw-title">Веса</h3>
      <label for="cw-gap">Связи между слоями</label>
      <select id="cw-gap"></select>
      <div class="cw-table-wrap" id="cw-table"></div>
      <p class="small" id="cw-state" role="status"></p>
      <div class="cw-buttons">
        <button type="button" id="cw-apply" class="primary">Применить таблицу</button>
        <button type="button" id="cw-fill">Дозаполнить случайными</button>
        <button type="button" id="cw-reset">Сбросить к случайным</button>
        <button type="button" id="cw-restore">Вернуть заданные</button>
      </div>

      <details class="cw-json">
        <summary>JSON</summary>
        <p class="small muted">Формат: <code>{"weights": [[[…]]], "biases": [[…]]}</code>, weights[l][j][i] — вес связи
          от нейрона i слоя l к нейрону j следующего слоя. Если указать <code>"layers": [2, 3, 1]</code>, архитектура тоже изменится.</p>
        <textarea id="cw-json" rows="6" spellcheck="false"></textarea>
        <div class="row">
          <button type="button" id="cw-json-show">Показать текущие</button>
          <button type="button" id="cw-json-apply">Применить JSON</button>
        </div>
      </details>
      <p class="small" id="cw-error" role="alert"></p>`;
    this.refresh();
  }

  get layers() { return this.lab.model.layers; }

  /** Перерисовать список промежутков, таблицу и строку состояния */
  refresh() {
    const layers = this.layers;
    this.gap = Math.min(this.gap, layers.length - 2);
    this.$('gap').innerHTML = layers.slice(0, -1).map((n, l) =>
      `<option value="${l}"${l === this.gap ? ' selected' : ''}>Слой ${l + 1} → ${l + 2} (${n} × ${layers[l + 1]})</option>`).join('');
    this.$('input-hint').textContent = `Нужно ${layers[0]} ${plural(layers[0], ['число', 'числа', 'чисел'])} — по числу входных нейронов.`;
    if (this.root.open) this.renderTable();
    this.renderState();
  }

  renderTable() {
    const l = this.gap, nIn = this.layers[l], nOut = this.layers[l + 1];
    const W = this.draft.weights[l], B = this.draft.biases[l];
    const head = Array.from({ length: nIn }, (_, i) => `<th scope="col" title="Нейрон ${i + 1} слоя ${l + 1}">${i + 1}</th>`).join('');
    const rows = Array.from({ length: nOut }, (_, j) => `<tr><th scope="row" title="Нейрон ${j + 1} слоя ${l + 2}">${j + 1}</th>${
      Array.from({ length: nIn }, (_, i) => `<td><input data-j="${j}" data-i="${i}" value="${fmt(W[j][i])}" inputmode="decimal" aria-label="Вес ${i + 1} → ${j + 1}"${W[j][i] === null ? ' class="empty"' : ''} /></td>`).join('')
    }<td class="cw-bias"><input data-j="${j}" data-b="1" value="${fmt(B[j])}" inputmode="decimal" aria-label="Смещение нейрона ${j + 1}"${B[j] === null ? ' class="empty"' : ''} /></td></tr>`).join('');
    this.$('table').innerHTML = `
      <table class="cw-table">
        <thead><tr><th class="cw-corner" title="Строки — нейроны слоя ${l + 2}, столбцы — нейроны слоя ${l + 1}">к \\ от</th>${head}<th class="cw-bias" title="Смещение (bias)">b</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  renderState(extra = '') {
    const holes = countHoles(this.draft);
    const el = this.$('state');
    let text;
    if (holes) text = `Пустых ячеек: ${holes}. Сеть пока со случайными весами — введите значения или нажмите «Дозаполнить случайными».`;
    else if (this.applied) text = 'Сейчас в сети заданные вами веса.';
    else text = this.dirty ? 'Таблица изменена — нажмите «Применить таблицу».' : 'Сейчас в сети случайные веса (в таблице — они же).';
    el.textContent = extra ? `${extra} ${text}` : text;
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
    this.renderState(`Архитектура изменилась: сохранено ${kept} из ${before} ${before % 10 === 1 && before % 100 !== 11 ? 'значения' : 'значений'}.`);
    if (!holes) this.applyWeights(this.draft, 'Свои веса перенесены на новую архитектуру');
  }

  /** Вход для прогона: свой (если включён) или null */
  customInput() {
    if (!this.$('use-input').checked) return null;
    const values = parseNumberList(this.$('input').value);
    const errors = checkInput(values.map(v => v ?? NaN), this.layers[0]);
    if (errors.length) throw new Error(`Свой вход: ${errors[0]}`);
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
      if (invalid) { this.error(`В таблице ${invalid} ${plural(invalid, ['ячейка', 'ячейки', 'ячеек'])} не с числом — они подсвечены.`); return; }
      const holes = countHoles(this.draft);
      if (holes) { this.error(`Не заполнено ${holes} ${plural(holes, VALUES)} (в том числе на других промежутках) — введите их или нажмите «Дозаполнить случайными».`); return; }
      this.applyWeights(this.draft, 'Заданы свои веса');
    });
    this.$('fill').addEventListener('click', () => {
      const rnd = this.lab.model.snapshot(); // сеть сейчас со случайными весами новой архитектуры
      const filled = {
        weights: this.draft.weights.map((W, l) => W.map((r, j) => r.map((v, i) => v ?? rnd.weights[l][j][i]))),
        biases: this.draft.biases.map((b, l) => b.map((v, j) => v ?? rnd.biases[l][j])),
      };
      this.applyWeights(filled, 'Пустые ячейки дозаполнены случайными весами');
    });
    this.$('reset').addEventListener('click', () => {
      this.lab.model.randomize();
      this.lab.rebuildView();
      this.syncFromModel();
      this.error('');
      this.lab.setStatus(this.given ? 'Случайные веса — заданные можно вернуть' : 'Случайные веса');
    });
    this.$('restore').addEventListener('click', () => {
      if (!this.given) return;
      const errors = checkWeights(this.layers, this.given.weights, this.given.biases);
      if (errors.length) {
        const given = [this.given.weights[0]?.[0]?.length ?? 0, ...this.given.biases.map(b => b.length)];
        this.error(`Заданные веса — для архитектуры ${given.join(' → ')}, а сейчас ${this.layers.join(' → ')}. Верните архитектуру или задайте веса заново.`);
        return;
      }
      this.applyWeights(this.given, 'Возвращены заданные веса');
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
    try { data = JSON.parse(text); } catch (e) { this.error(`JSON не читается: ${e.message}`); return; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) { this.error('Ожидался объект { "weights": …, "biases": … }'); return; }
    const src = data.model && typeof data.model === 'object' ? data.model : data;
    if (src.layers !== undefined) {
      const errs = checkLayers(src.layers);
      if (errs.length) { this.error(errs); return; }
      const errsW = checkWeights(src.layers, src.weights, src.biases);
      if (errsW.length) { this.error(errsW); return; }
      if (src.layers.join() !== this.layers.join()) this.lab.applyArchitecture(src.layers, { keepCustom: false });
    }
    this.applyWeights({ weights: src.weights, biases: src.biases }, 'Веса загружены из JSON');
  }
}
