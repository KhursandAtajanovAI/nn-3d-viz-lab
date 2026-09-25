import * as THREE from 'three';
import { BaseLab, MODE_TOGGLE_HTML, SPEED_HTML, bindModeToggle } from './BaseLab.js';
import { NetworkView } from './NetworkView.js';
import { Timeline } from './Timeline.js';
import { MLP, seededRandom } from './models/mlp.js';
import { DATASETS_2D } from './models/datasets2d.js';
import { lineChartSvg } from './chart.js';
import { PALETTE } from './palette.js';
import { escapeHtml, formatValue } from './format.js';

const GRAD = '#c77dff';

/**
 * Обучение сети (type: 'train').
 *   mode: 'backprop' — один шаг обучения по стадиям: forward → ошибка → backward слой за слоем → обновление весов
 *   mode: 'loop'     — обучение по эпохам на 2D-данных: график ошибки, граница решений, веса меняются «вживую»
 * Конфиг: model: { layers, activation, outputActivation, seed }, lr, samples? (для backprop), datasets? (для loop)
 */
export class TrainLab extends BaseLab {
  constructor(space, dom) {
    super(space, dom);
    const s = space;
    this.mode = s.mode ?? 'loop';
    this.mount({
      controls: this.mode === 'backprop' ? this.backpropControls() : this.loopControls(),
      resultTitle: this.mode === 'backprop' ? 'Что изменил этот шаг' : 'Ход обучения',
      hoverHint: 'Наведите курсор на нейрон или связь.',
      cards: [{ title: 'Как читать сцену', open: !(s.sections?.length), html: `
        <ul class="legend">
          <li><span class="dot glow-pos"></span><span><b>Тёплое/холодное свечение нейрона</b> — его активация при прямом проходе.</span></li>
          <li><span class="dot" style="background:${GRAD};box-shadow:0 0 8px 3px ${GRAD}"></span><span><b>Фиолетовое свечение</b> — градиент ошибки δ: насколько этот нейрон «виноват» в ошибке. Он бежит от выхода ко входу.</span></li>
          <li><span class="line pos"></span><span><b>Цвет и насыщенность связи</b> — знак и величина веса. При обновлении весов цвета меняются.</span></li>
        </ul>` }],
      hint: 'Мышь: ЛКМ — вращать · колесо — масштаб · ПКМ — сдвиг. N — числа.',
    });

    this.rnd = seededRandom(s.model.seed ?? 1);
    this.net = new MLP(s.model.layers, { activation: s.model.activation, outputActivation: s.model.outputActivation, seed: s.model.seed });
    this.view = new NetworkView(this.kit.scene);
    this.view.build(this.net, { names: s.names ? [s.names.input, ...Array(s.model.layers.length - 2), s.names.output] : [] });
    this.kit.onResize((w, h) => this.view.setResolution(w, h));
    this.kit.setAutoFrame(() => this.kit.fitBox(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 0.3, 0), this.view.size.clone().add(new THREE.Vector3(2.5, 2, 0))), { dir: new THREE.Vector3(0.3, 0.2, 1) }));
    this.timeline = new Timeline();
    this.kit.onFrame(dt => this.frame(dt));
    this.decorate();
    this.enablePicking(() => [...this.view.neurons.flat(), ...this.view.connections]);
    this.onHoverChange = (_, obj) => this.view.setHover(obj ? this.hoverTarget(obj) : null);
    bindModeToggle(this, on => this.view.setShowNumbers(on));
    this.$('lr').addEventListener('input', () => { this.$('lr-v').textContent = this.lr; });
    this.$('lr-v').textContent = this.lr;
    this.history = [];
    this.accHistory = [];
    this.grads = null;
    if (this.mode === 'backprop') this.initBackprop(); else this.initLoop();
  }

  get lr() { return Number(this.$('lr').value); }

  lrHtml(value, max = 1) {
    return `<label for="lr">Скорость обучения η: <b id="lr-v"></b></label>
      <input id="lr" type="range" min="0.01" max="${max}" step="0.01" value="${value}" />`;
  }

  // ---------- Подсказки ----------

  hoverTarget(obj) {
    if (obj.userData.layer !== undefined) return { type: 'neuron', layer: obj.userData.layer, index: obj.userData.index };
    const hit = obj.userData.hit;
    const c = this.view.connectionAt(obj.userData.gap, hit.faceIndex);
    return { type: 'weight', gap: c.gap, from: c.from, to: c.to };
  }

  decorate() {
    this.view.neurons.flat().forEach(m => {
      m.userData.info = () => {
        const { layer: l, index: i } = m.userData;
        const a = this.net.lastActs?.[l]?.[i];
        const z = this.net.lastZ?.[l]?.[i];
        const d = this.grads?.deltas?.[l]?.[i];
        return {
          tooltip: `Слой ${l + 1}, нейрон ${i + 1}${a !== undefined ? ` · a = ${formatValue(a, 3)}` : ''}${d !== undefined && d !== null ? ` · δ = ${formatValue(d, 3)}` : ''}`,
          html: `<h3>Нейрон ${i + 1} · слой ${l + 1}</h3>
            ${a !== undefined ? `<p>Активация a = <b class="num">${formatValue(a, 4)}</b>${z !== undefined && z !== null ? ` (z = ${formatValue(z, 3)})` : ''}</p>` : '<p class="muted">Запустите шаг, чтобы увидеть значения.</p>'}
            ${d !== undefined && d !== null ? `<p>Градиент ошибки δ = ∂L/∂z = <b class="num" style="color:${GRAD}">${formatValue(d, 4)}</b></p>
              <p class="muted small">${l === this.net.layers.length - 1 ? 'Для выхода δ = a − t: разница между ответом и правильным значением.' : 'δ = (Σ w·δ следующего слоя) × f′(z): ошибка приходит по исходящим связям, взвешенная их весами.'}</p>` : ''}
            ${l > 0 ? `<p>Смещение b = ${formatValue(this.net.biases[l - 1][i], 3)}</p>` : ''}`,
        };
      };
    });
    this.view.connections.forEach(lines => {
      lines.userData.info = hit => {
        if (!hit) return null;
        const c = this.view.connectionAt(lines.userData.gap, hit.faceIndex);
        const w = this.net.weights[c.gap][c.to][c.from];
        const g = this.grads?.gradW?.[c.gap]?.[c.to]?.[c.from];
        const before = this.before?.weights?.[c.gap]?.[c.to]?.[c.from];
        return {
          tooltip: `w(Н${c.from + 1} → Н${c.to + 1}) = ${formatValue(w, 3)}${g !== undefined ? ` · ∂L/∂w = ${formatValue(g, 3)}` : ''}`,
          html: `<h3>Связь: слой ${c.gap + 1} Н${c.from + 1} → слой ${c.gap + 2} Н${c.to + 1}</h3>
            <p>Вес сейчас: <b class="num">${formatValue(w, 4)}</b></p>
            ${g !== undefined ? `<p>Градиент ∂L/∂w = δ<sub>Н${c.to + 1}</sub> × a<sub>Н${c.from + 1}</sub> = <b class="num" style="color:${GRAD}">${formatValue(g, 4)}</b></p>` : ''}
            ${before !== undefined ? `<p>Изменение: ${formatValue(before, 4)} → ${formatValue(w, 4)} (Δw = −η·∂L/∂w = ${formatValue(w - before, 4)})</p>` : ''}
            <p class="muted small">Вес меняется против градиента: если увеличение веса увеличивает ошибку (∂L/∂w > 0), вес уменьшается.</p>`,
        };
      };
    });
  }

  // ---------- Режим «backprop» ----------

  backpropControls() {
    const s = this.space;
    return `
      <label for="sample">Обучающий пример</label>
      <select id="sample">${s.samples.map((p, i) => `<option value="${i}">${escapeHtml(p.name)}</option>`).join('')}</select>
      ${this.lrHtml(s.lr ?? 0.5, 2)}
      ${SPEED_HTML}
      <button id="step" class="primary">▶ Один шаг обучения</button>
      <div class="row">
        <button id="next">Следующий пример</button>
        <button id="epochs">+100 эпох быстро</button>
      </div>
      <button id="reset" style="width:100%;margin-top:8px">Сбросить веса</button>
      ${MODE_TOGGLE_HTML}`;
  }

  initBackprop() {
    this.$('step').addEventListener('click', () => this.backpropStep());
    this.onKey('Space', () => this.backpropStep());
    this.$('next').addEventListener('click', () => {
      const sel = this.$('sample');
      sel.value = String((Number(sel.value) + 1) % this.space.samples.length);
      this.backpropStep();
    });
    this.$('epochs').addEventListener('click', () => {
      const X = this.space.samples.map(p => p.x), Y = this.space.samples.map(p => p.t);
      this.history.push(...this.net.fit(X, Y, { epochs: 100, lr: this.lr }));
      this.view.refreshWeights();
      this.before = null;
      this.grads = null;
      this.setStatus(`Сделано ещё 100 эпох. Средняя ошибка: ${this.history.at(-1).toFixed(4)}`);
      this.setResult(this.backpropSummary());
    });
    this.$('reset').addEventListener('click', () => {
      this.net.randomize();
      this.view.refreshWeights();
      this.view.reset();
      this.history = [];
      this.grads = this.before = null;
      this.setResult(this.backpropSummary());
      this.setStatus('Веса сброшены — сеть снова «ничего не знает»');
    });
    this.setSceneInfo(`<p>Сеть ${this.net.layers.join(' → ')} учится на примерах задачи «${escapeHtml(this.space.taskName ?? '')}».
      Один шаг = прямой проход, вычисление ошибки, обратный проход и обновление всех весов.</p>`);
    this.setResult(this.backpropSummary());
    this.setStatus('Нажмите «Один шаг обучения»');
  }

  datasetLoss() {
    const S = this.space.samples;
    return S.reduce((s, p) => s + this.net.loss(this.net.forward(p.x).at(-1), p.t), 0) / S.length;
  }

  backpropSummary(extra = '') {
    const S = this.space.samples;
    const rows = S.map(p => {
      const out = this.net.forward(p.x).at(-1)[0];
      const ok = Math.round(out) === p.t[0];
      return `<tr><td>${escapeHtml(p.name)}</td><td class="num">${out.toFixed(3)}</td><td class="num">${p.t[0]}</td><td>${ok ? '<b class="ok">✓</b>' : '<b class="bad">✗</b>'}</td></tr>`;
    }).join('');
    return `${extra}
      <table class="arch-table"><thead><tr><th>Пример</th><th>Ответ сети</th><th>Нужно</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <p>Средняя ошибка на всех примерах: <b class="num">${this.datasetLoss().toFixed(4)}</b></p>
      ${this.history.length ? lineChartSvg([{ values: this.history, color: '#ff9f1c' }], { xLabel: 'эпоха', yLabel: 'ошибка', logY: true }) : ''}`;
  }

  backpropStep() {
    if (this.timeline.running) return;
    const p = this.space.samples[Number(this.$('sample').value)];
    const net = this.net, view = this.view;
    const L = net.layers.length - 1;
    const acts = net.forward(p.x);
    const lossBefore = net.loss(acts[L], p.t);
    const grads = net.backward(p.t);
    this.before = net.snapshot();
    const after = net.snapshot();
    // Новые веса после шага (применим постепенно в анимации)
    after.weights.forEach((W, l) => W.forEach((row, j) => row.forEach((_, i) => { row[i] -= this.lr * grads.gradW[l][j][i]; })));
    after.biases.forEach((b, l) => b.forEach((_, j) => { b[j] -= this.lr * grads.gradB[l][j]; }));
    this.grads = null;
    const dur = k => (k * 1.1) / Number(this.$('speed').value);
    const maxD = Math.max(1e-6, ...grads.deltas.slice(1).flat().map(Math.abs));
    const stages = [];
    view.reset();
    view.setPulseColor(PALETTE.pulse);
    const st = t => { this.$('status').textContent = t; };

    // 1. Прямой проход
    for (let l = 0; l <= L; l++) {
      stages.push({ duration: dur(0.5), update: t => {
        st(`1. Прямой проход: слой ${l + 1} из ${L + 1}`);
        acts[l].forEach((a, i) => view.setNeuron(l, i, a, t));
        if (l > 0) view.setConnections(l - 1, 1, 1 - t);
      } });
      if (l < L) stages.push({ duration: dur(0.4), update: t => view.setConnections(l, t, 1) });
    }
    // 2. Ошибка
    stages.push({ duration: dur(0.8), update: () => {
      st(`2. Ошибка: ответ ${acts[L][0].toFixed(3)}, нужно ${p.t[0]} → L = ${lossBefore.toFixed(4)}`);
      this.grads = grads;
      grads.deltas[L].forEach((d, i) => view.setGradient(L, i, d, 1, maxD));
    } });
    // 3. Обратный проход — от выхода ко входу
    for (let l = L; l >= 1; l--) {
      stages.push({ duration: dur(0.6), update: t => {
        st(`3. Обратный проход: ошибка идёт от слоя ${l + 1} к слою ${l}`);
        view.setPulseColor(GRAD);
        view.setConnections(l - 1, 1 - t, 1);
        if (l - 1 >= 1) grads.deltas[l - 1].forEach((d, i) => view.setGradient(l - 1, i, d, t, maxD));
      } });
    }
    // 4. Обновление весов — плавно
    stages.push({ duration: dur(1.2), update: t => {
      st('4. Обновление: каждый вес сдвигается на −η·∂L/∂w');
      net.weights.forEach((W, l) => W.forEach((row, j) => row.forEach((_, i) => {
        row[i] = this.before.weights[l][j][i] + (after.weights[l][j][i] - this.before.weights[l][j][i]) * t;
      })));
      net.biases.forEach((b, l) => b.forEach((_, j) => { b[j] = this.before.biases[l][j] + (after.biases[l][j] - this.before.biases[l][j]) * t; }));
      view.refreshWeights();
      for (let l = 0; l < L; l++) view.setConnections(l, 0, (1 - t) * 0.6);
    } });

    this.$('step').disabled = true;
    this.timeline.start(stages, () => {
      this.$('step').disabled = false;
      view.setPulseColor(PALETTE.pulse);
      const outAfter = net.forward(p.x).at(-1)[0];
      const lossAfter = net.loss([outAfter], p.t);
      net.forward(p.x); // вернуть lastActs для подсказок
      // Самые изменившиеся веса
      const changes = [];
      net.weights.forEach((W, l) => W.forEach((row, j) => row.forEach((w, i) => changes.push({ l, j, i, d: w - this.before.weights[l][j][i] }))));
      changes.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
      this.history.push(this.datasetLoss());
      this.setStatus(`Готово: ошибка на этом примере ${lossBefore.toFixed(4)} → ${lossAfter.toFixed(4)}`);
      this.setResult(this.backpropSummary(`
        <p>Пример «${escapeHtml(p.name)}»: ответ <b>${acts[L][0].toFixed(3)} → ${outAfter.toFixed(3)}</b> (нужно ${p.t[0]}),
          ошибка <b>${lossBefore.toFixed(4)} → ${lossAfter.toFixed(4)}</b> ${lossAfter < lossBefore ? '<b class="ok">↓</b>' : '<b class="bad">↑ (шаг слишком большой?)</b>'}.</p>
        <p class="list-title">Сильнее всего изменились</p>
        <ul class="links">${changes.slice(0, 4).map(c => `<li><span class="grow">слой ${c.l + 1} Н${c.i + 1} → слой ${c.l + 2} Н${c.j + 1}</span><span class="num">${c.d >= 0 ? '+' : '−'}${Math.abs(c.d).toFixed(4)}</span></li>`).join('')}</ul>`));
      this.refreshHover();
    });
  }

  // ---------- Режим «loop» ----------

  loopControls() {
    const s = this.space;
    return `
      <label for="dataset">Данные</label>
      <select id="dataset">${Object.entries(DATASETS_2D).map(([id, d]) => `<option value="${id}"${id === s.dataset ? ' selected' : ''}>${d.name}</option>`).join('')}</select>
      <div class="boundary-wrap"><canvas id="boundary" width="220" height="220" aria-label="Граница решений"></canvas></div>
      <p class="small muted" id="dataset-note"></p>
      ${this.lrHtml(s.lr ?? 0.05, 0.5)}
      <div class="row">
        <button id="play" class="primary">▶ Обучать</button>
        <button id="epoch">1 эпоха</button>
      </div>
      <button id="reset" style="width:100%;margin-top:8px">Сбросить веса</button>
      ${MODE_TOGGLE_HTML}`;
  }

  initLoop() {
    this.playing = false;
    this.acc = 0;
    this.loadDataset(this.$('dataset').value);
    this.$('dataset').addEventListener('change', e => this.loadDataset(e.target.value));
    this.$('play').addEventListener('click', () => this.togglePlay());
    this.onKey('Space', () => this.togglePlay());
    this.$('epoch').addEventListener('click', () => { this.trainEpoch(); this.renderLoop(); });
    this.$('reset').addEventListener('click', () => {
      this.net.randomize();
      this.history = [];
      this.accHistory = [];
      this.epoch = 0;
      this.view.refreshWeights();
      this.renderLoop();
      this.setStatus('Веса сброшены');
    });
  }

  loadDataset(id) {
    const d = DATASETS_2D[id];
    this.data = d.make(seededRandom(11));
    this.$('dataset-note').textContent = d.note;
    this.net.randomize();
    this.history = [];
    this.accHistory = [];
    this.epoch = 0;
    this.view.refreshWeights();
    this.setSceneInfo(`<p>Сеть ${this.net.layers.join(' → ')} учится отделять оранжевые точки от синих.
      Вход — две координаты точки, выход — вероятность «оранжевого» класса. Одна эпоха = один проход по всем ${this.data.X.length} точкам.</p>`);
    this.renderLoop();
    this.setStatus('Нажмите «Обучать»');
  }

  togglePlay() {
    this.playing = !this.playing;
    this.$('play').textContent = this.playing ? '⏸ Пауза' : '▶ Обучать';
  }

  trainEpoch() {
    const { X, Y } = this.data;
    this.history.push(this.net.fit(X, Y, { epochs: 1, lr: this.lr })[0]);
    this.epoch++;
    const acc = X.reduce((s, x, i) => s + (Math.round(this.net.forward(x).at(-1)[0]) === Y[i][0] ? 1 : 0), 0) / X.length;
    this.accHistory.push(acc);
  }

  renderLoop() {
    this.drawBoundary();
    // Показать активации для одной точки, чтобы сеть «светилась» во время обучения
    const x = this.data.X[this.epoch % this.data.X.length];
    const acts = this.net.forward(x);
    acts.forEach((layer, l) => layer.forEach((a, i) => this.view.setNeuron(l, i, a, 1)));
    this.view.refreshWeights();
    const acc = this.accHistory.at(-1);
    this.setResult(`
      <p>Эпоха <b>${this.epoch}</b> · ошибка <b class="num">${this.history.length ? this.history.at(-1).toFixed(4) : '—'}</b>
        · точность <b class="num">${acc !== undefined ? `${Math.round(acc * 100)}%` : '—'}</b></p>
      ${lineChartSvg([{ values: this.history, color: '#ff9f1c', label: 'ошибка' }], { xLabel: 'эпоха', yLabel: 'ошибка (BCE)', logY: true })}
      ${lineChartSvg([{ values: this.accHistory, color: '#7ee081', label: 'точность' }], { xLabel: 'эпоха', yLabel: 'точность', yMin: 0, yMax: 1, height: 110 })}`);
    if (this.hovered) this.refreshHover();
  }

  drawBoundary() {
    const cv = this.$('boundary'), ctx = cv.getContext('2d');
    const N = 44, W = cv.width, H = cv.height;
    const img = ctx.createImageData(N, N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = -1.1 + (c / (N - 1)) * 2.2, y = 1.1 - (r / (N - 1)) * 2.2;
      const p = this.net.forward([x, y]).at(-1)[0];
      const k = (r * N + c) * 4;
      // Оранжевый — класс 1, синий — класс 0, яркость — уверенность
      const u = Math.abs(p - 0.5) * 2;
      const [cr, cg, cb] = p > 0.5 ? [255, 159, 28] : [47, 155, 255];
      img.data[k] = 14 + (cr - 14) * u * 0.55; img.data[k + 1] = 20 + (cg - 20) * u * 0.55; img.data[k + 2] = 32 + (cb - 32) * u * 0.55; img.data[k + 3] = 255;
    }
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = N;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, 0, 0, W, H);
    const { X, Y } = this.data;
    X.forEach((x, i) => {
      ctx.beginPath();
      ctx.arc(((x[0] + 1.1) / 2.2) * W, ((1.1 - x[1]) / 2.2) * H, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = Y[i][0] ? '#ff9f1c' : '#2f9bff';
      ctx.fill();
      ctx.strokeStyle = '#0a0e17';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  frame(dt) {
    if (this.timeline.running) {
      this.timeline.update(dt);
      if (this.hovered) this.refreshHover();
      return;
    }
    if (this.mode !== 'loop' || !this.playing) return;
    this.acc += dt;
    if (this.acc < 0.12) return;
    this.acc = 0;
    for (let k = 0; k < 3; k++) this.trainEpoch();
    this.renderLoop();
    if (this.epoch >= (this.space.maxEpochs ?? 600)) {
      this.togglePlay();
      this.setStatus(`Остановлено на ${this.epoch} эпохах`);
    } else {
      this.setStatus(`Обучение… эпоха ${this.epoch}`);
    }
  }
}
