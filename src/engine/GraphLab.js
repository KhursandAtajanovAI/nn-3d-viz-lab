// Визуальный конструктор блоков (type: 'graph', только пользовательские пространства).
// Слева — палитра, параметры выбранного блока, запуск и датасеты; в центре — холст графа;
// справа — панель результатов (числа, таблицы, графики, картинки).
import { headerHtml, detailsCardHtml } from './sidebar.js';
import { FORMAT, FORMAT_VERSION, LIMITS, cleanDataset } from './spaceFormat.js';
import { loadBlocks, GROUPS, blockParams } from './blocks/index.js';
import { GraphEditor } from './graph/editor.js';
import { runGraph, Cancelled } from './graph/runner.js';
import { el, note } from './graph/view.js';
import { listDatasets, getDataset, saveDataset, deleteDataset } from './userStore.js';
import { readTableFile, readImageFiles, UPLOAD_LIMITS } from './graph/upload.js';
import { datasetToData } from './graph/data.js';

const HELP_HTML = `
  <ul class="steps">
    <li>Перетащите блок из палитры на холст или просто кликните по нему.</li>
    <li>Соедините <b>выход</b> (точка справа) с <b>входом</b> (точка слева) другого блока. Подходящие входы подсвечиваются; несовместимые типы соединить нельзя.</li>
    <li>Клик по блоку — его параметры появятся в карточке «Выбранный блок». Delete — удалить, Ctrl+D — копия.</li>
    <li>Колесо мыши — масштаб, перетаскивание фона — сдвиг холста.</li>
    <li>«▶ Запустить» выполняет граф слева направо; результаты — в панели справа.</li>
  </ul>
  <p class="small muted">Типы связей: <span class="ge-type" data-type="data">данные</span> <span class="ge-type" data-type="split">train/test</span>
    <span class="ge-type" data-type="model">модель</span> <span class="ge-type" data-type="trained">обученная</span>.</p>`;

/** Стартовый граф «Пример графа»: две луны → нормализация → разбиение → 2 слоя → обучение → результаты */
const TEMPLATE = {
  nodes: [
    { id: 'n1', block: 'data-example', x: 0, y: 0, params: { example: 'moons', count: 400 } },
    { id: 'n2', block: 'normalize', x: 230, y: 0, params: {} },
    { id: 'n3', block: 'split', x: 460, y: 0, params: {} },
    { id: 'n4', block: 'dense', x: 230, y: 170, params: { units: 16, activation: 'relu' } },
    { id: 'n5', block: 'dense', x: 460, y: 170, params: { units: 16, activation: 'relu' } },
    { id: 'n6', block: 'train', x: 700, y: 80, params: { epochs: 40 } },
    { id: 'n7', block: 'metrics', x: 950, y: -60, params: {} },
    { id: 'n8', block: 'loss-chart', x: 950, y: 60, params: {} },
    { id: 'n9', block: 'scatter', x: 950, y: 180, params: {} },
    { id: 'na', block: 'confusion', x: 950, y: 300, params: {} },
  ],
  edges: [
    { from: ['n1', 'data'], to: ['n2', 'in'] },
    { from: ['n2', 'out'], to: ['n3', 'data'] },
    { from: ['n4', 'model'], to: ['n5', 'model'] },
    { from: ['n5', 'model'], to: ['n6', 'model'] },
    { from: ['n3', 'split'], to: ['n6', 'data'] },
    { from: ['n6', 'trained'], to: ['n7', 'trained'] },
    { from: ['n6', 'trained'], to: ['n8', 'trained'] },
    { from: ['n6', 'trained'], to: ['n9', 'in'] },
    { from: ['n6', 'trained'], to: ['na', 'trained'] },
  ],
};

export class GraphLab {
  constructor(space, { sidebar, container }) {
    this.space = space;
    this.sidebar = sidebar;
    this.container = container;
    this.datasets = []; // список из хранилища: { id, name, kind, size }
    this.embedded = new Map((space.datasets ?? []).map(d => [d.id, d])); // из файла пространства
    this.running = false;
    this.cancel = false;
    this.ready = this.init();
  }

  async init() {
    this.renderLayout();
    this.blocks = await loadBlocks();
    this.renderPalette();
    this.editor = new GraphEditor(this.ui.canvas, this.blocks, {
      onChange: () => this.onGraphChange(),
      onSelect: n => this.renderParams(n),
      onMessage: (t, isErr) => this.setStatus(t, isErr),
      summaryCtx: { datasetName: id => this.datasetName(id) },
    });
    this.editor.maxFitK = Math.min(1.6, (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1) * 0.8);
    await this.refreshDatasets();
    // Датасеты из файла пространства, которых нет в этом браузере, кладём в хранилище
    for (const [id, d] of this.embedded) {
      if (!this.datasets.some(x => x.id === id)) { try { await saveDataset(d, id); } catch (e) { console.warn(e); } }
    }
    if (this.embedded.size) await this.refreshDatasets();
    this.editor.load(this.space.graph ?? { nodes: [], edges: [] });
    if (this.space.graph?.nodes?.length && !this.space.graph.view?.k) this.editor.fit();
    this.renderParams(null);
    this.setStatus(this.editor.nodes.length ? `Блоков: ${this.editor.nodes.length}. Нажмите «▶ Запустить».` : 'Граф пуст — добавьте блоки или нажмите «Пример графа»');
  }

  // ---------- Разметка ----------

  renderLayout() {
    const s = this.space;
    this.sidebar.innerHTML = `
      ${headerHtml(s.meta)}
      <section class="card">
        <h2>Запуск</h2>
        <div class="row">
          <button id="g-run" class="primary">▶ Запустить</button>
          <button id="g-stop" disabled>■ Остановить</button>
        </div>
        <div class="g-progress" id="g-progress" hidden><div></div></div>
        <p id="status" role="status"></p>
      </section>
      <section class="card" id="g-params-card">
        <h2>Выбранный блок</h2>
        <div id="g-params"></div>
      </section>
      <section class="card">
        <h2>Блоки</h2>
        <p class="small muted">Перетащите на холст или кликните.</p>
        <div id="g-palette"></div>
      </section>
      <section class="card">
        <h2>Датасеты</h2>
        <p class="small muted">Хранятся в этом браузере. CSV/JSON до ${UPLOAD_LIMITS.tableBytes / 1048576} МБ
          (до ${LIMITS.datasetRows} строк, ${LIMITS.datasetColumns} столбцов); картинки — до ${LIMITS.images} штук,
          метка — начало имени файла до «_» или «-» (cat_01.png → cat).</p>
        <div class="row">
          <button id="g-up-table">CSV / JSON</button>
          <button id="g-up-images">Картинки</button>
        </div>
        <label for="g-img-side">Размер картинок, пикселей</label>
        <select id="g-img-side">${[8, 12, 16, 20, 28, 32, 48, 64].map(v => `<option${v === 28 ? ' selected' : ''}>${v}</option>`).join('')}</select>
        <p class="small" id="g-ds-msg" role="status"></p>
        <ul class="g-ds-list" id="g-ds-list"></ul>
      </section>
      ${s.intro ? `<section class="card"><h2>Описание</h2>${s.intro}</section>` : ''}
      ${(s.sections ?? []).map(detailsCardHtml).join('')}
      ${detailsCardHtml({ title: 'Как пользоваться', html: HELP_HTML, open: false })}`;

    this.container.innerHTML = `
      <div class="g-area">
        <div class="g-canvas-wrap">
          <div id="g-canvas"></div>
          <div class="g-toolbar">
            <button id="g-zoom-out" title="Уменьшить">−</button>
            <button id="g-zoom-in" title="Увеличить">+</button>
            <button id="g-fit" title="Показать весь граф">Вписать</button>
            <button id="g-template" title="Заменить граф готовым примером">Пример графа</button>
            <button id="g-clear" title="Удалить все блоки">Очистить</button>
          </div>
        </div>
        <aside class="g-results" id="g-results" aria-label="Результаты">
          <div class="g-results-head"><h2>Результаты</h2><button id="g-results-toggle" title="Свернуть панель">⇥</button></div>
          <div id="g-results-body"><p class="muted small">Здесь появятся числа, таблицы, графики и картинки после запуска.</p></div>
        </aside>
      </div>`;

    const $ = id => document.getElementById(id);
    this.ui = {
      run: $('g-run'), stop: $('g-stop'), progress: $('g-progress'), status: $('status'),
      params: $('g-params'), palette: $('g-palette'), canvas: $('g-canvas'),
      results: $('g-results'), resultsBody: $('g-results-body'), dsList: $('g-ds-list'), dsMsg: $('g-ds-msg'),
    };
    this.ui.run.addEventListener('click', () => this.run());
    this.ui.stop.addEventListener('click', () => { this.cancel = true; this.setStatus('Останавливаю…'); });
    $('g-zoom-in').addEventListener('click', () => this.editor.zoomBy(1.2));
    $('g-zoom-out').addEventListener('click', () => this.editor.zoomBy(1 / 1.2));
    $('g-fit').addEventListener('click', () => this.editor.fit());
    $('g-template').addEventListener('click', () => {
      if (this.editor.nodes.length && !confirm('Заменить текущий граф примером?')) return;
      this.editor.load(TEMPLATE);
      this.editor.fit();
      this.editor.clearStatus();
      this.onGraphChange();
      this.setStatus('Пример загружен: нажмите «▶ Запустить»');
    });
    $('g-clear').addEventListener('click', () => {
      if (!this.editor.nodes.length || !confirm('Удалить все блоки?')) return;
      this.editor.load({ nodes: [], edges: [], view: this.editor.view });
      this.onGraphChange();
    });
    $('g-results-toggle').addEventListener('click', () => {
      const c = this.ui.results.classList.toggle('collapsed');
      $('g-results-toggle').textContent = c ? '⇤' : '⇥';
      $('g-results-toggle').title = c ? 'Развернуть панель' : 'Свернуть панель';
      setTimeout(() => this.editor.renderEdges(), 0);
    });
    $('g-up-table').addEventListener('click', () => this.pick('.csv,.tsv,.txt,.json', false, f => this.uploadTable(f[0])));
    $('g-up-images').addEventListener('click', () => this.pick('image/*', true, f => this.uploadImages(f)));
    // Результаты справа, если холсту остаётся хотя бы 600 px, иначе — под холстом
    const area = this.container.querySelector('.g-area');
    const layout = () => {
      const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
      area.classList.toggle('stacked', this.container.clientWidth - 320 * scale < 600);
      this.editor?.renderEdges();
    };
    new ResizeObserver(layout).observe(this.container);
    layout();
  }

  setStatus(text, isError = false) {
    this.ui.status.textContent = text;
    this.ui.status.classList.toggle('error', isError);
  }

  renderPalette() {
    const box = this.ui.palette;
    box.replaceChildren();
    for (const [g, title] of GROUPS) {
      const list = [...this.blocks.values()].filter(b => b.group === g);
      if (!list.length) continue;
      box.append(el('h3', 'g-pal-title', title));
      const wrap = el('div', 'g-pal');
      for (const b of list) {
        const item = el('button', 'g-pal-item', b.title);
        item.type = 'button';
        item.dataset.group = g;
        item.title = b.info ?? '';
        item.draggable = true;
        item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-nn-block', b.id); e.dataTransfer.effectAllowed = 'copy'; });
        item.addEventListener('click', () => this.editor.addAtCenter(b.id));
        wrap.append(item);
      }
      box.append(wrap);
    }
  }

  // ---------- Параметры выбранного блока ----------

  renderParams(node) {
    const box = this.ui.params;
    box.replaceChildren();
    if (!node) { box.append(el('p', 'small muted', 'Кликните по блоку на холсте, чтобы настроить его.')); return; }
    const block = this.blocks.get(node.block);
    if (!block) { box.append(el('p', 'small error-text', `Блок «${node.block}» неизвестен — удалите его.`)); }
    else {
      box.append(el('h3', '', block.title), el('p', 'small muted', block.info ?? ''));
      for (const p of block.params) box.append(this.paramField(node, p));
      const st = this.editor.status.get(node.id);
      if (st?.message && st.state !== 'ok') box.append(el('p', 'small error-text', st.message));
    }
    const row = el('div', 'row');
    const copy = el('button', '', 'Копировать');
    copy.addEventListener('click', () => this.editor.duplicate(node.id));
    const del = el('button', 'danger', 'Удалить');
    del.addEventListener('click', () => this.editor.removeNode(node.id));
    row.append(copy, del);
    box.append(row);
  }

  paramField(node, p) {
    const wrap = el('div', 'g-param');
    const id = `gp-${node.id}-${p.id}`;
    const label = el('label', '', p.title);
    label.htmlFor = id;
    let input;
    const value = node.params[p.id];
    const set = v => {
      this.editor.setParams(node.id, { [p.id]: v });
      if (input.type === 'checkbox' || input.tagName === 'SELECT') return;
      // Значение приведено к допустимому (число вне диапазона, не число) — показываем, что сохранилось
      const stored = String(this.editor.node(node.id).params[p.id]);
      const adjusted = stored !== String(v).trim();
      input.value = stored;
      input.classList.toggle('invalid', adjusted);
      input.title = adjusted ? `Исправлено: допустимо от ${p.min} до ${p.max}` : (p.kind === 'number' ? `от ${p.min} до ${p.max}` : '');
    };
    if (p.kind === 'select' || p.kind === 'dataset') {
      input = el('select');
      const opts = p.kind === 'dataset'
        ? [['', this.datasets.length ? '— выберите —' : '— сначала загрузите датасет —'], ...this.datasets.map(d => [d.id, `${d.name} (${d.kind === 'images' ? 'картинки' : 'таблица'})`])]
        : p.options;
      for (const [v, t] of opts) {
        const o = el('option', '', t);
        o.value = String(v);
        if (String(v) === String(value)) o.selected = true;
        input.append(o);
      }
      input.addEventListener('change', () => set(input.value));
    } else if (p.kind === 'bool') {
      const lab = el('label', 'check');
      input = el('input');
      input.type = 'checkbox';
      input.id = id;
      input.checked = !!value;
      input.addEventListener('change', () => set(input.checked));
      lab.append(input, ` ${p.title}`);
      wrap.append(lab);
      return wrap;
    } else {
      input = el('input');
      input.type = 'text';
      input.value = String(value ?? '');
      if (p.kind === 'number') { input.inputMode = 'decimal'; input.title = `от ${p.min} до ${p.max}`; }
      if (p.maxLength) input.maxLength = p.maxLength;
      input.addEventListener('change', () => set(input.value));
    }
    input.id = id;
    wrap.append(label, input);
    return wrap;
  }

  // ---------- Датасеты ----------

  datasetName(id) {
    return this.datasets.find(d => d.id === id)?.name ?? (id ? 'нет в браузере' : 'не выбран');
  }

  async refreshDatasets() {
    try {
      this.datasets = (await listDatasets()).map(r => ({ id: r.id, name: r.name, kind: r.kind, size: r.size }));
    } catch (e) {
      this.ui.dsMsg.textContent = e.message;
      this.datasets = [];
    }
    const list = this.ui.dsList;
    list.replaceChildren();
    if (!this.datasets.length) list.append(el('li', 'muted small', 'Пока нет загруженных датасетов'));
    for (const d of this.datasets) {
      const li = el('li');
      li.append(el('span', 'g-ds-name', d.name), el('span', 'muted small', ` ${d.kind === 'images' ? 'картинки' : 'таблица'} · ${(d.size / 1024).toFixed(0)} КБ`));
      const prev = el('button', '', 'Просмотр');
      prev.addEventListener('click', () => this.previewDataset(d.id));
      const del = el('button', 'danger', '✕');
      del.title = 'Удалить датасет';
      del.addEventListener('click', async () => {
        if (!confirm(`Удалить датасет «${d.name}» из браузера?`)) return;
        await deleteDataset(d.id);
        await this.refreshDatasets();
      });
      li.append(prev, del);
      list.append(li);
    }
    if (this.editor) {
      this.editor.nodes.forEach(n => this.editor.renderNode(n));
      const sel = this.editor.selected;
      if (sel?.kind === 'node') this.renderParams(this.editor.node(sel.id));
    }
  }

  pick(accept, multiple, onFiles) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); });
    input.click();
  }

  async uploadTable(f) {
    const msg = this.ui.dsMsg;
    msg.className = 'small';
    msg.textContent = `Читаю «${f.name}»…`;
    try {
      const ds = await readTableFile(f);
      await saveDataset(ds, ds.id);
      msg.textContent = `Загружено: «${ds.name}», ${ds.rows.length} строк × ${ds.columns.length} столбцов`;
      await this.refreshDatasets();
      this.previewDataset(ds.id);
    } catch (e) {
      msg.textContent = e.message;
      msg.classList.add('error-text');
    }
  }

  async uploadImages(files) {
    const msg = this.ui.dsMsg;
    msg.className = 'small';
    const side = Number(document.getElementById('g-img-side').value);
    try {
      const { ds, skipped } = await readImageFiles(files, side, `Картинки ${side}×${side}`, (k, n) => { msg.textContent = `Обрабатываю картинки: ${k} из ${n}…`; });
      await saveDataset(ds, ds.id);
      const labels = new Set(ds.items.map(i => i.label));
      msg.textContent = `Загружено картинок: ${ds.items.length}, классов: ${labels.size}${skipped.length ? `. Пропущено: ${skipped.length} (${skipped[0]})` : ''}`;
      await this.refreshDatasets();
      this.previewDataset(ds.id);
    } catch (e) {
      msg.textContent = e.message;
      msg.classList.add('error-text');
    }
  }

  async getDataset(id) {
    const rec = await getDataset(id);
    return rec?.data ?? this.embedded.get(id) ?? null;
  }

  async previewDataset(id) {
    const ds = await this.getDataset(id);
    if (!ds) return;
    const blockId = ds.kind === 'images' ? 'images' : 'table';
    const block = this.blocks.get(blockId);
    const out = await block.run({ inputs: { data: datasetToData(ds), in: datasetToData(ds) }, params: blockParams(block, {}), ctx: {} });
    this.showResults([{ title: `Просмотр: ${ds.name}`, state: 'ok', view: out.view }]);
  }

  // ---------- Запуск ----------

  async run() {
    if (this.running) return;
    const graph = this.editor.toJSON();
    if (!graph.nodes.length) { this.setStatus('Граф пуст — добавьте блоки', true); return; }
    this.running = true;
    this.cancel = false;
    this.ui.run.disabled = true;
    this.ui.stop.disabled = false;
    this.ui.progress.hidden = false;
    this.editor.clearStatus();
    const cards = [];
    this.showResults([]);
    const bar = this.ui.progress.firstElementChild;
    const t0 = performance.now();
    try {
      const results = await runGraph(graph, this.blocks, {
        onNode: (node, state, info) => {
          this.editor.setStatus(node.id, state, info.error ?? '');
          if (state === 'running') return;
          const block = this.blocks.get(node.block);
          if (info.view || state !== 'ok') {
            cards.push({ title: `${block?.title ?? node.block} · ${node.id.slice(1)}`, state, view: info.view, error: info.error, nodeId: node.id });
            this.showResults(cards);
          }
        },
        onProgress: (f, text) => {
          bar.style.width = `${Math.round(f * 100)}%`;
          this.setStatus(text);
        },
        getDataset: id => this.getDataset(id),
        isCancelled: () => this.cancel,
      });
      const errs = [...results.values()].filter(r => r.state === 'error').length;
      const skipped = [...results.values()].filter(r => r.state === 'skipped').length;
      const sec = ((performance.now() - t0) / 1000).toFixed(1);
      this.setStatus(errs || skipped ? `Готово за ${sec} с: ошибок ${errs}, пропущено ${skipped} — подробности справа и на блоках` : `Готово за ${sec} с`, errs > 0);
      if (!cards.length) this.showResults([{ title: 'Нет результатов', state: 'ok', view: note('Добавьте блоки из группы «Результаты», чтобы увидеть числа, таблицы и графики') }]);
    } catch (e) {
      this.setStatus(e instanceof Cancelled ? 'Остановлено' : e.message, !(e instanceof Cancelled));
    } finally {
      this.running = false;
      this.ui.run.disabled = false;
      this.ui.stop.disabled = true;
      setTimeout(() => { this.ui.progress.hidden = true; }, 600);
      const sel = this.editor.selected;
      if (sel?.kind === 'node') this.renderParams(this.editor.node(sel.id));
    }
  }

  showResults(cards) {
    const body = this.ui.resultsBody;
    body.replaceChildren();
    if (!cards.length) { body.append(el('p', 'muted small', 'Выполняется…')); return; }
    for (const c of cards) {
      const card = el('section', `g-res g-res-${c.state}`);
      const h = el('h3', '', c.title);
      if (c.nodeId) {
        h.title = 'Показать блок на холсте';
        h.addEventListener('click', () => this.editor.select({ kind: 'node', id: c.nodeId }));
      }
      card.append(h);
      if (c.error) card.append(el('p', 'small error-text', c.error));
      const views = c.view ? (Array.isArray(c.view) ? c.view : [c.view]) : [];
      for (const v of views) if (v instanceof Node) card.append(v);
      body.append(card);
    }
  }

  // ---------- Сохранение ----------

  onGraphChange() {
    this.dirty = true;
  }

  /** Состояние → файл nn3d-space (type: 'graph'); используемые датасеты встраиваются в файл */
  async toFile() {
    const graph = this.editor.toJSON();
    const ids = new Set(graph.nodes.filter(n => n.block === 'data-file' && n.params.dataset).map(n => n.params.dataset));
    const datasets = [];
    for (const id of ids) {
      const d = await this.getDataset(id);
      const errors = [];
      const clean = d && cleanDataset(d, errors);
      if (clean) datasets.push(clean);
    }
    const { file } = this.space.user;
    return {
      format: FORMAT, version: FORMAT_VERSION, mode: 'standard', type: 'graph',
      meta: file.meta, text: file.text, settings: file.settings ?? {},
      graph, datasets,
    };
  }
}

