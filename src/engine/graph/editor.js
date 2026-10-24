// Редактор графа блоков: узлы (HTML) и связи (SVG) в общем «мире», который сдвигается и масштабируется.
//
// Мышь и касания:
//   перетаскивание заголовка блока — переместить; выход → вход — соединить (с проверкой типов);
//   потянуть за занятый вход — отсоединить и переподключить; фон — панорама; колесо — масштаб;
//   клик по связи — выбрать; Delete — удалить выбранное; Ctrl+D — копия блока.
import { blockParams, PORT_TYPES } from '../blocks/index.js';
import { el } from './view.js';

const NS = 'http://www.w3.org/2000/svg';
const NODE_ID = /^n[0-9a-z]{1,16}$/;

export class GraphEditor {
  /**
   * @param {HTMLElement} root
   * @param {Map<string, object>} blocks
   * @param {object} hooks — onChange(), onSelect(node|null), onMessage(text, isError), summaryCtx
   */
  constructor(root, blocks, hooks) {
    this.root = root;
    this.blocks = blocks;
    this.hooks = hooks;
    this.nodes = [];
    this.edges = [];
    this.view = { x: 40, y: 40, k: 1 };
    this.selected = null; // { kind: 'node' | 'edge', id | edge }
    this.status = new Map();

    root.classList.add('ge-root');
    root.tabIndex = 0;
    root.setAttribute('aria-label', 'Холст графа блоков');
    this.world = el('div', 'ge-world');
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('ge-edges');
    this.tempPath = document.createElementNS(NS, 'path');
    this.tempPath.classList.add('ge-temp');
    this.svg.append(this.tempPath);
    this.world.append(this.svg);
    this.hint = el('div', 'ge-hint', 'Перетащите блоки из палитры слева или нажмите «Пример графа»');
    root.append(this.world, this.hint);
    this.bind();
  }

  // ---------- Модель ----------

  load(graph) {
    this.nodes = [];
    this.edges = [];
    this.world.querySelectorAll('.ge-node').forEach(n => n.remove());
    const dropped = [];
    for (const n of graph.nodes ?? []) {
      if (!NODE_ID.test(n.id)) continue;
      const block = this.blocks.get(n.block);
      const params = block ? blockParams(block, n.params) : { ...n.params };
      this.nodes.push({ id: n.id, block: n.block, x: n.x, y: n.y, params });
    }
    for (const e of graph.edges ?? []) {
      const why = this.checkEdge(e.from, e.to, { ignoreExisting: true });
      if (why) dropped.push(why); else this.edges.push({ from: [...e.from], to: [...e.to] });
    }
    if (graph.view) this.view = { ...graph.view };
    this.renderAll();
    if (dropped.length) this.hooks.onMessage(`Пропущено связей: ${dropped.length} (${dropped[0]})`, true);
  }

  toJSON() {
    return {
      nodes: this.nodes.map(n => ({ id: n.id, block: n.block, x: Math.round(n.x), y: Math.round(n.y), params: { ...n.params } })),
      edges: this.edges.map(e => ({ from: [...e.from], to: [...e.to] })),
      view: { x: Math.round(this.view.x), y: Math.round(this.view.y), k: +this.view.k.toFixed(3) },
    };
  }

  newId() {
    let i = this.nodes.length + 1, id;
    do id = `n${(i++).toString(36)}`; while (this.nodes.some(n => n.id === id));
    return id;
  }

  node(id) { return this.nodes.find(n => n.id === id); }

  addNode(blockId, x, y, params) {
    const block = this.blocks.get(blockId);
    if (!block) return null;
    if (this.nodes.length >= 200) { this.hooks.onMessage('Не больше 200 блоков', true); return null; }
    const n = { id: this.newId(), block: blockId, x, y, params: blockParams(block, params) };
    this.nodes.push(n);
    this.renderNode(n);
    this.select({ kind: 'node', id: n.id });
    this.changed();
    return n;
  }

  /** Добавить в центр видимой области (клик по палитре) */
  addAtCenter(blockId) {
    const r = this.root.getBoundingClientRect();
    const p = this.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    const jitter = (this.nodes.length % 5) * 18;
    return this.addNode(blockId, p.x - 90 + jitter, p.y - 40 + jitter);
  }

  removeNode(id) {
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.edges = this.edges.filter(e => e.from[0] !== id && e.to[0] !== id);
    this.world.querySelector(`.ge-node[data-id="${id}"]`)?.remove();
    this.status.delete(id);
    if (this.selected?.id === id) this.select(null);
    this.renderEdges();
    this.changed();
  }

  duplicate(id) {
    const n = this.node(id);
    if (n) this.addNode(n.block, n.x + 30, n.y + 30, n.params);
  }

  setParams(id, params) {
    const n = this.node(id);
    const block = this.blocks.get(n?.block);
    if (!block) return;
    n.params = blockParams(block, { ...n.params, ...params });
    this.renderNode(n);
    this.changed();
  }

  /** Тип значения на выходе (с учётом 'same:<вход>') */
  outTypes(nodeId, portId, seen = new Set()) {
    const n = this.node(nodeId), block = this.blocks.get(n?.block);
    const port = block?.outputs.find(p => p.id === portId);
    if (!port) return [];
    if (!port.type.startsWith('same:')) return [port.type];
    const inId = port.type.slice(5);
    const e = this.edges.find(x => x.to[0] === nodeId && x.to[1] === inId);
    if (e && !seen.has(nodeId)) { seen.add(nodeId); return this.outTypes(e.from[0], e.from[1], seen); }
    return block.inputs.find(p => p.id === inId)?.types ?? [];
  }

  /** Почему нельзя соединить (или null) */
  checkEdge(from, to, { ignoreExisting = false } = {}) {
    const a = this.node(from[0]), b = this.node(to[0]);
    if (!a || !b) return 'блок не найден';
    if (a === b) return 'нельзя соединить блок сам с собой';
    const bb = this.blocks.get(b.block), inPort = bb?.inputs.find(p => p.id === to[1]);
    if (!inPort) return `у блока «${bb?.title ?? b.block}» нет такого входа`;
    const types = this.outTypes(from[0], from[1]);
    if (!types.length) return 'нет такого выхода';
    if (!types.some(t => inPort.types.includes(t))) {
      return `тип не подходит: выход даёт «${types.map(t => PORT_TYPES[t] ?? t).join(' / ')}», а вход «${inPort.title}» ждёт «${inPort.types.map(t => PORT_TYPES[t] ?? t).join(' / ')}»`;
    }
    if (!ignoreExisting && this.reaches(to[0], from[0])) return 'получился бы цикл';
    return null;
  }

  /** Есть ли путь из a в b по связям */
  reaches(a, b) {
    const stack = [a], seen = new Set();
    while (stack.length) {
      const x = stack.pop();
      if (x === b) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      for (const e of this.edges) if (e.from[0] === x) stack.push(e.to[0]);
    }
    return false;
  }

  connect(from, to) {
    const why = this.checkEdge(from, to);
    if (why) { this.hooks.onMessage(`Нельзя соединить: ${why}`, true); return false; }
    if (this.edges.length >= 600) { this.hooks.onMessage('Не больше 600 связей', true); return false; }
    // Вход принимает одну связь — старая заменяется
    this.edges = this.edges.filter(e => !(e.to[0] === to[0] && e.to[1] === to[1]));
    this.edges.push({ from: [...from], to: [...to] });
    this.renderEdges();
    this.changed();
    this.hooks.onMessage('');
    return true;
  }

  removeEdge(edge) {
    this.edges = this.edges.filter(e => e !== edge);
    if (this.selected?.edge === edge) this.select(null);
    this.renderEdges();
    this.changed();
  }

  changed() {
    this.hint.hidden = this.nodes.length > 0;
    this.hooks.onChange?.();
  }

  // ---------- Состояние выполнения ----------

  setStatus(id, state, message = '') {
    this.status.set(id, { state, message });
    const elN = this.world.querySelector(`.ge-node[data-id="${id}"]`);
    if (!elN) return;
    elN.dataset.state = state;
    const dot = elN.querySelector('.ge-state');
    dot.title = { ok: 'Выполнен', error: `Ошибка: ${message}`, skipped: message, running: 'Выполняется…' }[state] ?? '';
  }

  clearStatus() {
    this.status.clear();
    this.world.querySelectorAll('.ge-node').forEach(n => { delete n.dataset.state; n.querySelector('.ge-state').title = ''; });
  }

  // ---------- Отрисовка ----------

  renderAll() {
    this.applyView();
    this.world.querySelectorAll('.ge-node').forEach(n => n.remove());
    this.nodes.forEach(n => this.renderNode(n));
    this.renderEdges();
    this.hint.hidden = this.nodes.length > 0;
  }

  renderNode(n) {
    const block = this.blocks.get(n.block);
    let elN = this.world.querySelector(`.ge-node[data-id="${n.id}"]`);
    const fresh = !elN;
    if (fresh) {
      elN = el('div', 'ge-node');
      elN.dataset.id = n.id;
      this.world.append(elN);
    }
    elN.dataset.group = block?.group ?? 'unknown';
    elN.classList.toggle('selected', this.selected?.kind === 'node' && this.selected.id === n.id);
    elN.style.transform = `translate(${n.x}px, ${n.y}px)`;
    const head = el('div', 'ge-head');
    head.append(el('span', 'ge-state'), el('span', 'ge-title', block ? block.title : `Неизвестный блок «${n.block}»`), el('span', 'ge-num', n.id.slice(1)));
    const sum = el('div', 'ge-sum', block?.summary ? block.summary(n.params, this.hooks.summaryCtx) : '');
    const ports = el('div', 'ge-ports');
    const ins = el('div', 'ge-ins'), outs = el('div', 'ge-outs');
    for (const p of block?.inputs ?? []) {
      const row = el('div', 'ge-port in');
      row.dataset.port = p.id;
      row.dataset.types = p.types.join(' ');
      row.title = `Вход «${p.title}»: ${p.types.map(t => PORT_TYPES[t] ?? t).join(' или ')}${p.optional ? ' (необязательный)' : ''}`;
      const dot = el('span', 'ge-dot');
      dot.dataset.type = p.types[0];
      row.append(dot, el('span', '', p.title + (p.optional ? ' ?' : '')));
      ins.append(row);
    }
    for (const p of block?.outputs ?? []) {
      const row = el('div', 'ge-port out');
      row.dataset.port = p.id;
      const t = p.type.startsWith('same:') ? (block.inputs.find(i => i.id === p.type.slice(5))?.types[0] ?? 'data') : p.type;
      row.title = `Выход «${p.title}»: ${PORT_TYPES[t] ?? t}${p.type.startsWith('same:') ? ' (как на входе)' : ''}`;
      const dot = el('span', 'ge-dot');
      dot.dataset.type = t;
      row.append(el('span', '', p.title), dot);
      outs.append(row);
    }
    ports.append(ins, outs);
    elN.replaceChildren(head, sum, ports);
    const st = this.status.get(n.id);
    if (st) this.setStatus(n.id, st.state, st.message);
    if (!fresh) this.renderEdges();
  }

  portCenter(nodeId, portId, dir) {
    const dot = this.world.querySelector(`.ge-node[data-id="${nodeId}"] .ge-port.${dir}[data-port="${portId}"] .ge-dot`);
    if (!dot) return null;
    const r = dot.getBoundingClientRect(), w = this.world.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - w.left) / this.view.k, y: (r.top + r.height / 2 - w.top) / this.view.k };
  }

  static curve(a, b) {
    const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }

  renderEdges() {
    this.svg.querySelectorAll('g.ge-edge').forEach(g => g.remove());
    for (const e of this.edges) {
      const a = this.portCenter(e.from[0], e.from[1], 'out'), b = this.portCenter(e.to[0], e.to[1], 'in');
      if (!a || !b) continue;
      const g = document.createElementNS(NS, 'g');
      g.classList.add('ge-edge');
      if (this.selected?.edge === e) g.classList.add('selected');
      const d = GraphEditor.curve(a, b);
      const hit = document.createElementNS(NS, 'path');
      hit.setAttribute('d', d);
      hit.classList.add('hit');
      const line = document.createElementNS(NS, 'path');
      line.setAttribute('d', d);
      line.classList.add('line');
      line.dataset.type = this.outTypes(e.from[0], e.from[1])[0] ?? 'data';
      g.append(hit, line);
      g.edge = e;
      this.svg.insertBefore(g, this.tempPath);
    }
  }

  applyView() {
    const { x, y, k } = this.view;
    this.world.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    this.root.style.setProperty('--ge-grid', `${24 * k}px`);
    this.root.style.backgroundPosition = `${x}px ${y}px`;
  }

  toWorld(cx, cy) {
    const r = this.root.getBoundingClientRect();
    return { x: (cx - r.left - this.view.x) / this.view.k, y: (cy - r.top - this.view.y) / this.view.k };
  }

  zoomAt(cx, cy, factor) {
    const r = this.root.getBoundingClientRect();
    const k = Math.min(3, Math.max(0.25, this.view.k * factor));
    const px = cx - r.left, py = cy - r.top;
    this.view.x = px - (px - this.view.x) * (k / this.view.k);
    this.view.y = py - (py - this.view.y) * (k / this.view.k);
    this.view.k = k;
    this.applyView();
  }

  zoomBy(factor) {
    const r = this.root.getBoundingClientRect();
    this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
    this.hooks.onChange?.();
  }

  /** Вписать все блоки в видимую область */
  fit() {
    if (!this.nodes.length) return;
    const els = [...this.world.querySelectorAll('.ge-node')];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of this.nodes) {
      const e = els.find(q => q.dataset.id === n.id);
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + (e?.offsetWidth ?? 180)); y1 = Math.max(y1, n.y + (e?.offsetHeight ?? 80));
    }
    const r = this.root.getBoundingClientRect(), pad = 30;
    const k = Math.min(this.maxFitK ?? 1.6, Math.max(0.25, Math.min((r.width - pad * 2) / (x1 - x0), (r.height - pad * 2) / (y1 - y0))));
    this.view = { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - (y1 - y0) * k) / 2 - y0 * k };
    this.applyView();
    this.renderEdges();
    this.hooks.onChange?.();
  }

  select(sel) {
    this.selected = sel;
    this.world.querySelectorAll('.ge-node').forEach(e => e.classList.toggle('selected', sel?.kind === 'node' && e.dataset.id === sel.id));
    this.svg.querySelectorAll('g.ge-edge').forEach(g => g.classList.toggle('selected', g.edge === sel?.edge));
    this.hooks.onSelect?.(sel?.kind === 'node' ? this.node(sel.id) : null, sel);
  }

  deleteSelected() {
    if (this.selected?.kind === 'node') this.removeNode(this.selected.id);
    else if (this.selected?.kind === 'edge') this.removeEdge(this.selected.edge);
  }

  // ---------- События ----------

  bind() {
    const root = this.root;
    let drag = null;

    root.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      const t = ev.target;
      root.focus({ preventScroll: true });
      const portEl = t.closest('.ge-port');
      const nodeEl = t.closest('.ge-node');
      if (portEl && nodeEl) {
        const nodeId = nodeEl.dataset.id, portId = portEl.dataset.port;
        let from;
        if (portEl.classList.contains('out')) from = [nodeId, portId];
        else {
          // Потянули за занятый вход — отсоединяем и тянем провод от его источника
          const e = this.edges.find(x => x.to[0] === nodeId && x.to[1] === portId);
          if (!e) return;
          from = e.from;
          this.removeEdge(e);
        }
        drag = { kind: 'wire', from, start: this.portCenter(from[0], from[1], 'out') };
        root.classList.add('wiring');
        this.highlightTargets(from);
      } else if (nodeEl) {
        const n = this.node(nodeEl.dataset.id);
        this.select({ kind: 'node', id: n.id });
        const p = this.toWorld(ev.clientX, ev.clientY);
        drag = { kind: 'node', node: n, el: nodeEl, dx: p.x - n.x, dy: p.y - n.y, moved: false };
      } else if (t.closest('g.ge-edge')) {
        this.select({ kind: 'edge', edge: t.closest('g.ge-edge').edge });
        return;
      } else if (t === root || t === this.world || t === this.svg || t === this.hint) {
        this.select(null);
        drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, vx: this.view.x, vy: this.view.y };
        root.classList.add('panning');
      } else return;
      try { root.setPointerCapture(ev.pointerId); } catch { /* синтетические события без активного указателя */ }
      ev.preventDefault();
    });

    root.addEventListener('pointermove', ev => {
      if (!drag) return;
      if (drag.kind === 'pan') {
        this.view.x = drag.vx + ev.clientX - drag.sx;
        this.view.y = drag.vy + ev.clientY - drag.sy;
        this.applyView();
      } else if (drag.kind === 'node') {
        const p = this.toWorld(ev.clientX, ev.clientY);
        drag.node.x = p.x - drag.dx;
        drag.node.y = p.y - drag.dy;
        drag.el.style.transform = `translate(${drag.node.x}px, ${drag.node.y}px)`;
        drag.moved = true;
        this.renderEdges();
      } else if (drag.kind === 'wire' && drag.start) {
        this.tempPath.setAttribute('d', GraphEditor.curve(drag.start, this.toWorld(ev.clientX, ev.clientY)));
      }
    });

    const end = ev => {
      if (!drag) return;
      if (drag.kind === 'wire') {
        this.tempPath.setAttribute('d', '');
        root.classList.remove('wiring');
        this.highlightTargets(null);
        const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.ge-port.in');
        const nodeEl = target?.closest('.ge-node');
        if (target && nodeEl) this.connect(drag.from, [nodeEl.dataset.id, target.dataset.port]);
      } else if (drag.kind === 'node' && drag.moved) this.hooks.onChange?.();
      else if (drag.kind === 'pan') { root.classList.remove('panning'); this.hooks.onChange?.(); }
      drag = null;
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);

    root.addEventListener('wheel', ev => {
      ev.preventDefault();
      this.zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.0015));
    }, { passive: false });

    root.addEventListener('keydown', ev => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (ev.key === 'Delete' || ev.key === 'Backspace') { this.deleteSelected(); ev.preventDefault(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.code === 'KeyD' && this.selected?.kind === 'node') { this.duplicate(this.selected.id); ev.preventDefault(); }
    });

    // Перетаскивание из палитры
    root.addEventListener('dragover', ev => {
      if (ev.dataTransfer.types.includes('text/x-nn-block')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; }
    });
    root.addEventListener('drop', ev => {
      const id = ev.dataTransfer.getData('text/x-nn-block');
      if (!id) return;
      ev.preventDefault();
      const p = this.toWorld(ev.clientX, ev.clientY);
      this.addNode(id, p.x - 20, p.y - 14);
    });
  }

  /** Подсветить входы, к которым можно подключить провод */
  highlightTargets(from) {
    this.world.querySelectorAll('.ge-port.in').forEach(p => {
      const nodeId = p.closest('.ge-node').dataset.id;
      const ok = from && !this.checkEdge(from, [nodeId, p.dataset.port]);
      p.classList.toggle('can', !!ok);
    });
  }
}
