import * as THREE from 'three';
import { BaseLab, MODE_TOGGLE_HTML, SPEED_HTML, bindModeToggle } from './BaseLab.js';
import { Timeline } from './Timeline.js';
import { PALETTE } from './palette.js';
import { makeLabel, makeLines, curveSegments, setLineResolution, valueMaterial, paintValue, disposeTree } from './three-utils.js';
import { escapeHtml, formatValue } from './format.js';

const SX = 1.5;       // шаг между словами
const CUBE = 0.28;    // кубик одного числа эмбеддинга
const ROW = 0.36;

/**
 * Визуализатор текста (type: 'tokens'). Режимы (mode):
 *   pool      — эмбеддинги слов усредняются и идут в полносвязные слои (мешок слов)
 *   rnn       — слова обрабатываются по очереди ячейкой с памятью (LSTM-подобной)
 *   attention — последнее слово «смотрит» на предыдущие (self-attention) и предсказывает следующее
 *
 * Конфиг: mode, presets: [строки], process(text) → trace (см. spaces/sentiment.js и др.),
 *         dims — названия измерений эмбеддинга, vocabularyHtml? — словарь для справки.
 */
export class TokensLab extends BaseLab {
  constructor(space, dom) {
    super(space, dom);
    const s = space;
    this.mode = s.mode ?? 'pool';
    this.mount({
      controls: `
        <label for="text">Текст</label>
        <input id="text" type="text" value="${escapeHtml(s.presets?.[0] ?? '')}" spellcheck="false" autocomplete="off" />
        ${s.presets?.length ? `<label for="preset">Примеры</label>
          <select id="preset">${s.presets.map((p, i) => `<option value="${i}">${escapeHtml(p)}</option>`).join('')}</select>` : ''}
        ${SPEED_HTML}
        <button id="run" class="primary">▶ ${s.runLabel ?? 'Обработать текст'}</button>
        ${this.mode === 'attention' ? `
          <div class="row">
            <button id="append">+ Добавить предсказанное слово</button>
          </div>
          <label class="check"><input type="checkbox" id="all-attention" /> Показать внимание всех слов</label>` : ''}
        ${MODE_TOGGLE_HTML}`,
      resultTitle: s.resultTitle ?? 'Результат',
      hoverHint: 'Наведите курсор на слово, число эмбеддинга, ячейку или дугу внимания.',
      cards: [
        ...(s.vocabularyHtml ? [{ title: 'Словарь модели', open: false, html: s.vocabularyHtml }] : []),
        { title: 'Как читать сцену', open: !(s.sections?.length), html: this.legendHtml() },
      ],
      hint: 'Мышь: ЛКМ — вращать · колесо — масштаб · ПКМ — сдвиг.<br />Enter в поле текста — обработать, N — числа.',
    });

    this.group = new THREE.Group();
    this.kit.scene.add(this.group);
    this.cubeGeo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
    this.timeline = new Timeline();
    this.showNumbers = false;
    this.kit.onResize((w, h) => setLineResolution(this.group, w, h));
    this.kit.onFrame(dt => {
      if (!this.timeline.running) return;
      this.timeline.update(dt);
      if (this.hovered) this.refreshHover();
    });
    this.enablePicking(() => this.pickables ?? [], { threshold: 8 });
    this.bindControls();
    this.run();
  }

  legendHtml() {
    const common = `
      <li><span class="token-swatch"></span><span><b>Прямоугольник — слово (токен).</b> Синий — слово есть в словаре модели, серый — незнакомое.</span></li>
      <li><span class="dot idle"></span><span><b>Столбик кубиков — эмбеддинг</b>: слово, превращённое в числа. Каждый кубик — одно измерение смысла.
        <b class="pos">Тёплый</b> — положительное число, <b class="neg">холодный</b> — отрицательное, яркость — величина.</span></li>`;
    const extra = {
      pool: `<li><span class="line pos"></span><span>Линии сходятся в <b>средний вектор</b> всего текста — порядок слов при этом теряется.</span></li>`,
      rnn: `<li><span class="line thick"></span><span><b>Ячейки памяти</b> обрабатывают слова по очереди и передают состояние вправо. Под ячейкой — её память после этого слова.</span></li>`,
      attention: `<li><span class="line thick"></span><span><b>Дуги внимания</b>: чем толще и ярче дуга, тем больше последнее слово «смотрит» на это слово при предсказании.</span></li>`,
    }[this.mode];
    return `<ul class="legend">${common}${extra}</ul>`;
  }

  // ---------- Запуск ----------

  run() {
    const text = this.$('text').value.trim();
    if (!text) { this.setStatus('Введите текст', true); return; }
    let trace;
    try {
      trace = this.space.process(text);
    } catch (e) {
      console.error(e);
      this.setStatus(e.message, true);
      return;
    }
    if (!trace.tokens.length) { this.setStatus('В тексте нет слов', true); return; }
    this.trace = trace;
    this.build(trace);
    this.animate(trace);
  }

  // ---------- Построение сцены ----------

  build(tr) {
    disposeTree(this.group);
    this.setHovered(null);
    const n = tr.tokens.length;
    const d = tr.embeddings[0]?.length ?? 0;
    const xs = tr.tokens.map((_, i) => (i - (n - 1) / 2) * SX - (this.mode === 'attention' ? SX / 2 : 0));
    this.xs = xs;
    this.pickables = [];
    this.numberLabels = [];
    this.anim = { tokens: [], columns: [], flows: [] };

    // Слова
    tr.tokens.forEach((t, i) => {
      const color = t.known ? 0x2f9bff : 0x6b7385;
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 0.22),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0.9 }));
      box.position.set(xs[i], 2.3, 0);
      box.add(makeLabel('token-label', t.text));
      box.userData.info = () => this.tokenInfo(i);
      this.group.add(box);
      this.pickables.push(box);
      this.anim.tokens.push(box);
    });

    // Эмбеддинги
    const maxAbs = Math.max(1e-6, ...tr.embeddings.flat().map(Math.abs));
    tr.embeddings.forEach((vec, i) => {
      const cubes = vec.map((v, k) => {
        const m = new THREE.Mesh(this.cubeGeo, valueMaterial());
        m.position.set(xs[i], 1.55 - k * ROW, 0);
        m.userData.info = () => ({
          tooltip: `«${tr.tokens[i].text}» · ${tr.dims[k]} = ${formatValue(v)}`,
          html: `<h3>Эмбеддинг слова «${escapeHtml(tr.tokens[i].text)}»</h3>
            <p>Измерение <b>${escapeHtml(tr.dims[k])}</b>: <b class="num">${formatValue(v, 3)}</b></p>
            <p class="muted small">Эмбеддинг — это строка таблицы: слову сопоставляется вектор из ${d} чисел. В настоящих моделях таких чисел сотни, и их смысл не подписан — здесь измерения названы, чтобы было понятно.</p>`,
        });
        const lab = makeLabel('value-label', formatValue(v), { center: [0, 0.5] });
        lab.position.set(0.22, 0, 0);
        lab.visible = this.showNumbers;
        m.add(lab);
        this.numberLabels.push(lab);
        this.group.add(m);
        this.pickables.push(m);
        return { mesh: m, value: v, maxAbs };
      });
      this.anim.columns.push(cubes);
    });
    // Подписи измерений слева
    tr.dims.forEach((name, k) => {
      const l = makeLabel('dim-label', name, { center: [1, 0.5] });
      l.position.set(xs[0] - 0.35, 1.55 - k * ROW, 0);
      this.group.add(l);
    });
    this.embedBottom = 1.55 - (d - 1) * ROW - CUBE;

    if (this.mode === 'pool') this.buildPool(tr);
    else if (this.mode === 'rnn') this.buildRnn(tr);
    else this.buildAttention(tr);

    // Кадр: всё, что построено, плюс запас под подписи
    const box = new THREE.Box3().setFromObject(this.group);
    box.expandByVector(new THREE.Vector3(0.6, 0.6, 0));
    box.min.x -= 1.2; // подписи измерений
    this.kit.setAutoFrame(() => this.kit.fitBox(box, { dir: new THREE.Vector3(0.12, 0.1, 1), margin: 0.92 }));
    setLineResolution(this.group, this.kit.width, this.kit.height);
  }

  addFlow(segments, opts = {}) {
    const lines = makeLines(segments, { width: 1, opacity: 0.35, ...opts });
    this.group.add(lines);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(segments.length * 3), 3));
    const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: PALETTE.pulse, size: 0.14, transparent: true, opacity: 0, depthWrite: false }));
    this.group.add(points);
    const flow = { lines, points, segments, baseWidth: opts.width ?? 1 };
    return flow;
  }

  setFlow(flow, t, fade) {
    if (!flow) return;
    flow.lines.material.linewidth = flow.baseWidth + 2 * fade;
    flow.lines.material.opacity = 0.35 + 0.6 * fade;
    const arr = flow.points.geometry.attributes.position.array;
    flow.segments.forEach(([a, b], k) => {
      arr[k * 3] = a.x + (b.x - a.x) * t;
      arr[k * 3 + 1] = a.y + (b.y - a.y) * t;
      arr[k * 3 + 2] = a.z + (b.z - a.z) * t;
    });
    flow.points.geometry.attributes.position.needsUpdate = true;
    flow.points.material.opacity = t > 0 && t < 1 ? fade : 0;
  }

  /** Столбик значений (вектор) в точке (x, yTop) */
  column(values, x, yTop, info, labels) {
    const maxAbs = Math.max(1e-6, ...values.map(Math.abs));
    return values.map((v, k) => {
      const m = new THREE.Mesh(this.cubeGeo, valueMaterial());
      m.position.set(x, yTop - k * ROW, 0);
      m.userData.info = () => info(k, v);
      const lab = makeLabel('value-label', formatValue(v), { center: [0, 0.5] });
      lab.position.set(0.22, 0, 0);
      lab.visible = this.showNumbers;
      m.add(lab);
      this.numberLabels.push(lab);
      if (labels?.[k]) {
        const n = makeLabel('dim-label', labels[k], { center: [1, 0.5] });
        n.position.set(-0.3, 0, 0);
        m.add(n);
      }
      this.group.add(m);
      this.pickables.push(m);
      return { mesh: m, value: v, maxAbs };
    });
  }

  outputSpheres(outputs, x0, y, { vertical = false } = {}) {
    return outputs.map((o, k) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 16), valueMaterial());
      if (vertical) m.position.set(x0, y - k * 1.35, 0);
      else m.position.set(x0 + (k - (outputs.length - 1) / 2) * 1.6, y, 0);
      const l = makeLabel('name-label', o.label, { center: [0.5, 0] });
      l.position.set(0, 0.42, 0);
      m.add(l);
      const v = makeLabel('value-label', `${Math.round(o.value * 100)}%`, { center: [0.5, 1] });
      v.position.set(0, -0.42, 0);
      m.add(v);
      m.userData.info = () => ({
        tooltip: `${o.label}: ${(o.value * 100).toFixed(1)}%`,
        html: `<h3>Выход «${escapeHtml(o.label)}»</h3><p>Вероятность: <b class="num">${(o.value * 100).toFixed(1)}%</b></p>${o.note ? `<p class="muted small">${o.note}</p>` : ''}`,
      });
      this.group.add(m);
      this.pickables.push(m);
      return { mesh: m, value: o.value };
    });
  }

  buildPool(tr) {
    const d = tr.pooled.length;
    const yP = this.embedBottom - 1.2;
    const segs = this.xs.map(x => [new THREE.Vector3(x, this.embedBottom, 0), new THREE.Vector3(0, yP + 0.2, 0)]);
    this.anim.flows.push(this.addFlow(segs));
    this.anim.pooled = this.column(tr.pooled, 0, yP, (k, v) => ({
      tooltip: `Среднее · ${tr.dims[k]} = ${formatValue(v)}`,
      html: `<h3>Средний вектор текста</h3><p>${escapeHtml(tr.dims[k])}: <b class="num">${formatValue(v, 3)}</b></p>
        <p class="muted small">Среднее этого измерения по всем словам. Порядок слов здесь уже потерян: «не плохо, а хорошо» и «не хорошо, а плохо» дают одинаковое среднее.</p>`,
    }), tr.dims);
    const yH = yP - (d - 1) * ROW - 1.3;
    const hx = tr.hidden.map((_, k) => (k - (tr.hidden.length - 1) / 2) * 1.2);
    this.anim.flows.push(this.addFlow(hx.flatMap(x => [[new THREE.Vector3(0, yP - (d - 1) * ROW - 0.15, 0), new THREE.Vector3(x, yH + 0.25, 0)]])));
    this.anim.hidden = tr.hidden.map((h, k) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 14), valueMaterial());
      m.position.set(hx[k], yH, 0);
      const l = makeLabel('dim-label', h.label, { center: [0.5, 1] });
      l.position.set(0, -0.32, 0);
      m.add(l);
      m.userData.info = () => ({
        tooltip: `${h.label} = ${formatValue(h.value)}`,
        html: `<h3>Скрытый нейрон «${escapeHtml(h.label)}»</h3><p>Активация (ReLU): <b class="num">${formatValue(h.value, 3)}</b></p>${h.note ? `<p class="muted small">${h.note}</p>` : ''}`,
      });
      this.group.add(m);
      this.pickables.push(m);
      return { mesh: m, value: h.value, maxAbs: Math.max(1, ...tr.hidden.map(q => Math.abs(q.value))) };
    });
    const yO = yH - 1.6;
    this.anim.flows.push(this.addFlow(hx.map(x => [new THREE.Vector3(x, yH - 0.25, 0), new THREE.Vector3(0, yO + 0.3, 0)])));
    this.anim.outputs = this.outputSpheres(tr.outputs, 0, yO);
  }

  buildRnn(tr) {
    const yC = this.embedBottom - 1.0;
    this.anim.cells = [];
    this.anim.states = [];
    this.anim.recurrent = [];
    tr.steps.forEach((st, i) => {
      const x = this.xs[i];
      const cell = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x5ad1b3, emissive: 0x5ad1b3, emissiveIntensity: 0.08, transparent: true, opacity: 0.6 }));
      cell.position.set(x, yC, 0);
      const g = makeLabel('gate-label', `f ${st.gates.f.toFixed(2)}
i ${st.gates.i.toFixed(2)}`, { center: [0.5, 0.5] });
      cell.add(g);
      cell.userData.info = () => this.cellInfo(i);
      this.group.add(cell);
      this.pickables.push(cell);
      this.anim.cells.push(cell);
      this.anim.flows.push(this.addFlow([[new THREE.Vector3(x, this.embedBottom, 0), new THREE.Vector3(x, yC + 0.3, 0)]]));
      if (i > 0) {
        this.anim.recurrent.push(this.addFlow([[new THREE.Vector3(this.xs[i - 1] + 0.5, yC, 0), new THREE.Vector3(x - 0.5, yC, 0)]], { width: 2, color: 0x5ad1b3 }));
      }
      this.anim.states.push(this.column(st.h, x, yC - 0.75, (k, v) => ({
        tooltip: `После «${tr.tokens[i].text}»: ${tr.stateDims[k]} = ${formatValue(v)}`,
        html: `<h3>Память после слова «${escapeHtml(tr.tokens[i].text)}»</h3>
          <p>${escapeHtml(tr.stateDims[k])}: <b class="num">${formatValue(v, 3)}</b></p>
          <p class="muted small">Это скрытое состояние h — всё, что сеть «помнит» о тексте к этому моменту. Оно передаётся следующей ячейке.</p>`,
      }), i === 0 ? tr.stateDims : null));
    });
    const last = this.xs.at(-1);
    const yO = yC;
    this.anim.flows.push(this.addFlow([[new THREE.Vector3(last + 0.5, yC, 0), new THREE.Vector3(last + 1.9, yO, 0)]], { width: 2 }));
    this.anim.outputs = this.outputSpheres(tr.outputs, last + 2.3, yO + 0.45, { vertical: true });
  }

  buildAttention(tr) {
    const n = tr.tokens.length;
    const q = tr.attention.query;
    // Место для следующего слова — «?»
    const xq = this.xs[n - 1] + SX;
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffd166, emissiveIntensity: 0.1, transparent: true, opacity: 0.25 }));
    ghost.position.set(xq, 2.3, 0);
    ghost.add(makeLabel('token-label', '?'));
    this.group.add(ghost);
    this.anim.ghost = ghost;

    this.anim.arcs = [];
    const drawArcs = (from, weights) => weights.forEach((w, j) => {
      if (j > from || w < 0.005) return;
      const a = new THREE.Vector3(this.xs[j], 2.55, 0), b = new THREE.Vector3(this.xs[from], 2.55, 0);
      const h = 0.5 + Math.abs(from - j) * 0.35;
      const curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3((a.x + b.x) / 2, 2.55 + h * 2, 0), b.clone().add(new THREE.Vector3(0, 0.02, 0)));
      const segs = j === from
        ? curveSegments(new THREE.CubicBezierCurve3(a, a.clone().add(new THREE.Vector3(-0.5, 1.1, 0)), a.clone().add(new THREE.Vector3(0.5, 1.1, 0)), a), 16)
        : curveSegments(curve, 28);
      const line = makeLines(segs, { width: 1 + w * 10, color: from === q ? PALETTE.positive : PALETTE.negative, opacity: 0 });
      line.userData.weight = w;
      line.userData.info = () => ({
        tooltip: `«${tr.tokens[from].text}» → «${tr.tokens[j].text}»: ${(w * 100).toFixed(1)}%`,
        html: `<h3>Внимание «${escapeHtml(tr.tokens[from].text)}» → «${escapeHtml(tr.tokens[j].text)}»</h3>
          <p>Вес внимания: <b class="num">${(w * 100).toFixed(1)}%</b></p>
          <p class="muted small">Вес = softmax от сходства векторов (скалярного произведения запроса и ключа). Сумма весов всех дуг одного слова — 100%.</p>`,
      });
      this.group.add(line);
      this.pickables.push(line);
      this.anim.arcs.push(line);
    });
    if (this.$('all-attention')?.checked && tr.attention.matrix) {
      tr.attention.matrix.forEach((row, i) => { if (i !== q) drawArcs(i, row); });
    }
    drawArcs(q, tr.attention.weights);

    // Кандидаты на следующее слово — столбиком под «?»
    this.anim.candidates = tr.candidates.map((c, k) => {
      const w = 0.6 + c.p * 2.2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.36, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffd166, emissiveIntensity: 0.1, transparent: true, opacity: 0.85 }));
      m.position.set(xq + 1.4 + w / 2 - 0.3, 1.55 - k * 0.5, 0);
      const cl = makeLabel('cand-label', `${c.word} · ${Math.round(c.p * 100)}%`, { center: [0, 0.5] });
      cl.position.set(-w / 2 + 0.05, 0, 0.1);
      m.add(cl);
      m.userData.info = () => ({
        tooltip: `«${c.word}»: ${(c.p * 100).toFixed(1)}%`,
        html: `<h3>Кандидат «${escapeHtml(c.word)}»</h3><p>Вероятность: <b class="num">${(c.p * 100).toFixed(1)}%</b></p>${c.why ? `<p class="small">${c.why}</p>` : ''}`,
      });
      this.group.add(m);
      this.pickables.push(m);
      return m;
    });
    const top = new THREE.Vector3(xq, 2.05, 0);
    this.anim.flows.push(this.addFlow(this.anim.candidates.map(m => [top, m.position.clone().add(new THREE.Vector3(-m.geometry.parameters.width / 2, 0, 0))])));
  }

  // ---------- Анимация ----------

  animate(tr) {
    const A = this.anim;
    const dur = k => (k * 1.1) / Number(this.$('speed').value);
    // Исходное состояние: всё погашено
    A.tokens.forEach(b => b.scale.setScalar(0.001));
    A.columns.flat().forEach(c => paintValue(c.mesh, 0, 0));
    A.flows.forEach(f => this.setFlow(f, 0, 0));
    (A.pooled ?? []).forEach(c => paintValue(c.mesh, 0, 0));
    (A.hidden ?? []).forEach(c => paintValue(c.mesh, 0, 0));
    (A.outputs ?? []).forEach(c => paintValue(c.mesh, 0, 0));
    (A.states ?? []).flat().forEach(c => paintValue(c.mesh, 0, 0));
    (A.cells ?? []).forEach(c => { c.material.emissiveIntensity = 0.08; });
    (A.recurrent ?? []).forEach(f => this.setFlow(f, 0, 0));
    (A.arcs ?? []).forEach(l => { l.material.opacity = 0; });
    (A.candidates ?? []).forEach(m => m.scale.set(0.001, 1, 1));

    const stages = [];
    const status = t => { this.$('status').textContent = t; };
    stages.push({ duration: dur(0.25) * Math.min(A.tokens.length, 6), update: t => {
      status('1. Текст делится на слова (токены)');
      A.tokens.forEach((b, i) => b.scale.setScalar(Math.max(0.001, Math.min(1, t * A.tokens.length - i))));
    } });
    stages.push({ duration: dur(0.9), update: t => {
      status('2. Каждое слово заменяется вектором чисел — эмбеддингом');
      A.columns.forEach(col => col.forEach(c => paintValue(c.mesh, c.value, t, c.maxAbs)));
    } });

    if (this.mode === 'pool') {
      stages.push({ duration: dur(0.8), update: t => { status('3. Векторы усредняются в один вектор текста'); this.setFlow(A.flows[0], t, 1); A.pooled.forEach(c => paintValue(c.mesh, c.value, t, c.maxAbs)); } });
      stages.push({ duration: dur(0.8), update: t => { status('4. Скрытый слой ищет «позитивные» и «негативные» сигналы'); this.setFlow(A.flows[0], 1, 1 - t); this.setFlow(A.flows[1], t, 1); A.hidden.forEach(c => paintValue(c.mesh, c.value, t, c.maxAbs)); } });
      stages.push({ duration: dur(0.8), update: t => { status('5. Выход: вероятности тональности'); this.setFlow(A.flows[1], 1, 1 - t); this.setFlow(A.flows[2], t, 1); A.outputs.forEach(c => paintValue(c.mesh, c.value, t, 1)); } });
      stages.push({ duration: dur(0.3), update: t => this.setFlow(A.flows[2], 1, 1 - t) });
    } else if (this.mode === 'rnn') {
      tr.steps.forEach((st, i) => {
        stages.push({ duration: dur(0.9), update: t => {
          status(`3. Шаг ${i + 1} из ${tr.steps.length}: ячейка читает «${tr.tokens[i].text}» и обновляет память`);
          this.setFlow(A.flows[i], t, 1 - Math.max(0, t - 0.8) * 5);
          if (i > 0) this.setFlow(A.recurrent[i - 1], t, 1);
          A.cells[i].material.emissiveIntensity = 0.08 + 0.9 * t;
          if (i > 0) A.cells[i - 1].material.emissiveIntensity = 0.98 - 0.7 * t;
          A.states[i].forEach(c => paintValue(c.mesh, c.value, t, 1));
        } });
      });
      const outFlow = A.flows.at(-1);
      stages.push({ duration: dur(0.8), update: t => {
        status('4. Итоговая память превращается в ответ');
        this.setFlow(outFlow, t, 1);
        A.cells.at(-1).material.emissiveIntensity = 0.98 - 0.6 * t;
        A.outputs.forEach(c => paintValue(c.mesh, c.value, t, 1));
      } });
      stages.push({ duration: dur(0.3), update: t => this.setFlow(outFlow, 1, 1 - t) });
    } else {
      stages.push({ duration: dur(1.2), update: t => {
        status('3. Последнее слово «смотрит» на все предыдущие (self-attention)');
        A.arcs.forEach(l => { l.material.opacity = t * (0.25 + 0.75 * Math.min(1, l.userData.weight * 3)); });
      } });
      stages.push({ duration: dur(0.9), update: t => {
        status('4. Из собранного контекста считаются вероятности следующего слова');
        this.setFlow(A.flows[0], t, 1);
        A.candidates.forEach(m => m.scale.set(Math.max(0.001, t), 1, 1));
        A.ghost.material.opacity = 0.25 + 0.5 * t;
      } });
      stages.push({ duration: dur(0.3), update: t => this.setFlow(A.flows[0], 1, 1 - t) });
    }

    this.$('run').disabled = true;
    this.timeline.start(stages, () => {
      this.$('run').disabled = false;
      this.setStatus('Готово — наведите курсор на любой элемент');
      this.setResult(this.resultHtml(tr));
    });
  }

  resultHtml(tr) {
    let html = '';
    if (tr.outputs?.length) {
      html += `<ul class="bars">${tr.outputs.map(o => `
        <li class="${o.value === Math.max(...tr.outputs.map(q => q.value)) ? 'best' : ''}">
          <span class="name">${escapeHtml(o.label)}</span><span class="bar"><span style="width:${(o.value * 100).toFixed(1)}%"></span></span>
          <span class="num">${(o.value * 100).toFixed(1)}%</span><span></span></li>`).join('')}</ul>`;
    }
    if (tr.candidates?.length) {
      html += `<ul class="bars">${tr.candidates.map((c, k) => `
        <li class="${k === 0 ? 'best' : ''}"><span class="name">${escapeHtml(c.word)}</span>
          <span class="bar"><span style="width:${(c.p * 100).toFixed(1)}%"></span></span>
          <span class="num">${(c.p * 100).toFixed(1)}%</span><span></span></li>`).join('')}</ul>`;
    }
    return html + (tr.html ?? '');
  }

  // ---------- Подсказки ----------

  tokenInfo(i) {
    const tr = this.trace, t = tr.tokens[i];
    const vec = tr.embeddings[i];
    return {
      tooltip: `«${t.text}»${t.known ? '' : ' (незнакомое слово)'}`,
      html: `<h3>Слово «${escapeHtml(t.text)}»</h3>
        <p>${t.known ? 'Есть в словаре модели.' : '<b class="bad">Нет в словаре</b> — модель заменяет его нулевым вектором и фактически не учитывает.'}</p>
        <table class="arch-table"><tbody>${tr.dims.map((dim, k) => `<tr><td>${escapeHtml(dim)}</td><td class="num">${formatValue(vec[k], 2)}</td></tr>`).join('')}</tbody></table>
        ${t.note ? `<p class="small">${t.note}</p>` : ''}`,
    };
  }

  cellInfo(i) {
    const tr = this.trace, st = tr.steps[i];
    const g = st.gates;
    return {
      tooltip: `Ячейка ${i + 1} («${tr.tokens[i].text}») · f=${g.f.toFixed(2)} i=${g.i.toFixed(2)}`,
      html: `<h3>Ячейка памяти, шаг ${i + 1}: «${escapeHtml(tr.tokens[i].text)}»</h3>
        <table class="arch-table"><tbody>
          <tr><td><b>f</b> — забывание</td><td class="num">${g.f.toFixed(3)}</td><td class="muted small">сколько старой памяти оставить</td></tr>
          <tr><td><b>i</b> — запись</td><td class="num">${g.i.toFixed(3)}</td><td class="muted small">сколько нового записать</td></tr>
          <tr><td><b>g</b> — новое</td><td class="num">${formatValue(g.g, 3)}</td><td class="muted small">что именно записать</td></tr>
          <tr><td><b>c</b> — память</td><td class="num">${formatValue(st.c[0], 3)}</td><td class="muted small">c = f·c<sub>прошл</sub> + i·g</td></tr>
        </tbody></table>
        ${st.note ? `<p class="small">${st.note}</p>` : ''}`,
    };
  }

  // ---------- Управление ----------

  bindControls() {
    this.$('run').addEventListener('click', () => this.run());
    this.$('text').addEventListener('keydown', e => { if (e.key === 'Enter') this.run(); });
    this.$('preset')?.addEventListener('change', e => {
      this.$('text').value = this.space.presets[Number(e.target.value)];
      this.run();
    });
    this.$('append')?.addEventListener('click', () => {
      const best = this.trace?.candidates?.[0];
      if (!best) return;
      this.$('text').value = `${this.$('text').value.trim()} ${best.word}`;
      this.run();
    });
    this.$('all-attention')?.addEventListener('change', () => this.run());
    bindModeToggle(this, on => {
      this.showNumbers = on;
      this.numberLabels?.forEach(l => { l.visible = on; });
    });
  }
}
