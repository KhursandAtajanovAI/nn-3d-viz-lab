import * as THREE from 'three';
import { BaseLab, modeToggleHtml, speedHtml, bindModeToggle } from './BaseLab.js';
import { NetworkView } from './NetworkView.js';
import { Timeline } from './Timeline.js';
import { MLP, seededRandom } from './models/mlp.js';
import { DATASETS_2D } from './models/datasets2d.js';
import { lineChartSvg } from './chart.js';
import { PALETTE } from './palette.js';
import { escapeHtml, fmtSigned as formatValue } from './format.js';
import { t, T, H, L, TA, At, str, isText, fmtNum, setT, setText } from '../i18n/i18n.js';

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
      resultTitle: L(this.mode === 'backprop' ? 'tl.stepResult' : 'tl.progress'),
      hoverHint: L('tl.hoverHint'),
      cards: [{ title: L('tl.howToRead'), open: !(s.sections?.length), html: `
        <ul class="legend">
          <li><span class="dot glow-pos"></span><span>${T('tl.legendActHtml')}</span></li>
          <li><span class="dot" style="background:${GRAD};box-shadow:0 0 8px 3px ${GRAD}"></span><span>${T('tl.legendGradHtml')}</span></li>
          <li><span class="line pos"></span><span>${T('tl.legendWeightHtml')}</span></li>
        </ul>` }],
      hint: L('tl.hint'),
    });

    this.rnd = seededRandom(s.model.seed ?? 1);
    this.net = new MLP(s.model.layers, { activation: s.model.activation, outputActivation: s.model.outputActivation, seed: s.model.seed });
    this.view = new NetworkView(this.kit.scene);
    this.view.build(this.net, { names: s.names ? [s.names.input, ...Array(s.model.layers.length - 2), s.names.output] : [] });
    this.kit.onResize((w, h) => this.view.setResolution(w, h));
    this.kit.setAutoFrame(() => this.kit.fitBox(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 0.3, 0), this.view.size.clone().add(new THREE.Vector3(2.5, 2, 0))), { dir: new THREE.Vector3(0.3, 0.2, 1) }));
    this.timeline = new Timeline();
    this.kit.onFrame(dt => this.frame(dt));
    this.kit.onFrame(() => this.view.updateLabelScale(this.kit.camera, this.kit.width, this.kit.height, this.kit.labelRenderer.domElement));
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
    return `<label for="lr">${T('tl.lr')} <b id="lr-v"></b></label>
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
          tooltip: `${t('tl.tipNeuron', { l: l + 1, n: i + 1 })}${a !== undefined ? ` · a = ${formatValue(a, 3)}` : ''}${d !== undefined && d !== null ? ` · δ = ${formatValue(d, 3)}` : ''}`,
          html: `<h3>${H('lab.neuronTitle', { n: i + 1, l: l + 1 })}</h3>
            ${a !== undefined ? `<p>${H('tl.activationA')} <b class="num">${formatValue(a, 4)}</b>${z !== undefined && z !== null ? ` (z = ${formatValue(z, 3)})` : ''}</p>` : `<p class="muted">${H('tl.runStepHint')}</p>`}
            ${d !== undefined && d !== null ? `<p>${H('tl.gradDelta')} <b class="num" style="color:${GRAD}">${formatValue(d, 4)}</b></p>
              <p class="muted small">${H(l === this.net.layers.length - 1 ? 'tl.deltaOut' : 'tl.deltaHidden')}</p>` : ''}
            ${l > 0 ? `<p>${H('tl.bias', { b: formatValue(this.net.biases[l - 1][i], 3) })}</p>` : ''}`,
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
          tooltip: `w(${t('lab.neuronShort', { n: c.from + 1 })} → ${t('lab.neuronShort', { n: c.to + 1 })}) = ${formatValue(w, 3)}${g !== undefined ? ` · ∂L/∂w = ${formatValue(g, 3)}` : ''}`,
          html: `<h3>${H('tl.linkTitle', { la: c.gap + 1, a: t('lab.neuronShort', { n: c.from + 1 }), lb: c.gap + 2, b: t('lab.neuronShort', { n: c.to + 1 }) })}</h3>
            <p>${H('tl.weightNow')} <b class="num">${formatValue(w, 4)}</b></p>
            ${g !== undefined ? `<p>${H('tl.grad')} = δ<sub>${H('lab.neuronShort', { n: c.to + 1 })}</sub> × a<sub>${H('lab.neuronShort', { n: c.from + 1 })}</sub> = <b class="num" style="color:${GRAD}">${formatValue(g, 4)}</b></p>` : ''}
            ${before !== undefined ? `<p>${H('tl.change', { a: formatValue(before, 4), b: formatValue(w, 4), d: formatValue(w - before, 4) })}</p>` : ''}
            <p class="muted small">${H('tl.againstGrad')}</p>`,
        };
      };
    });
  }

  // ---------- Режим «backprop» ----------

  backpropControls() {
    const s = this.space;
    return `
      <label for="sample">${T('tl.sample')}</label>
      <select id="sample">${s.samples.map((p, i) => `<option value="${i}" ${isText(p.name) ? TA(p.name) : ''}>${escapeHtml(str(p.name))}</option>`).join('')}</select>
      ${this.lrHtml(s.lr ?? 0.5, 2)}
      ${speedHtml()}
      <button id="step" class="primary">${T('tl.step')}</button>
      <div class="row">
        <button id="next">${T('tl.next')}</button>
        <button id="epochs">${T('tl.fast100')}</button>
      </div>
      <button id="reset" style="width:100%;margin-top:8px">${T('tl.reset')}</button>
      ${modeToggleHtml()}`;
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
      this.setStatus(L('tl.did100', { loss: { num: this.history.at(-1), d: 4 } }));
      this.setResult(() => this.backpropSummary());
    });
    this.$('reset').addEventListener('click', () => {
      this.net.randomize();
      this.view.refreshWeights();
      this.view.reset();
      this.history = [];
      this.grads = this.before = null;
      this.setResult(() => this.backpropSummary());
      this.setStatus(L('tl.resetDone'));
    });
    this.setSceneInfo(() => `<p>${H('tl.sceneBackprop', { arch: this.net.layers.join(' → '), task: str(this.space.taskName ?? '') })}</p>`);
    this.setResult(() => this.backpropSummary());
    this.setStatus(L('tl.pressStep'));
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
      return `<tr><td>${escapeHtml(str(p.name))}</td><td class="num">${fmtNum(out, 3)}</td><td class="num">${p.t[0]}</td><td>${ok ? '<b class="ok">✓</b>' : '<b class="bad">✗</b>'}</td></tr>`;
    }).join('');
    return `${extra}
      <table class="arch-table"><thead><tr><th>${H('tl.colSample')}</th><th>${H('tl.colOut')}</th><th>${H('tl.colTarget')}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <p>${H('tl.meanLoss')} <b class="num">${fmtNum(this.datasetLoss(), 4)}</b></p>
      ${this.history.length ? lineChartSvg([{ values: this.history, color: '#ff9f1c' }], { xLabel: t('tl.epoch'), yLabel: t('tl.loss'), logY: true }) : ''}`;
  }

  backpropStep() {
    if (this.timeline.running) return;
    const p = this.space.samples[Number(this.$('sample').value)];
    const net = this.net, view = this.view;
    const last = net.layers.length - 1;
    const acts = net.forward(p.x);
    const lossBefore = net.loss(acts[last], p.t);
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
    const st = (key, p) => setT(this.$('status'), key, p);

    // 1. Прямой проход
    for (let l = 0; l <= last; l++) {
      stages.push({ duration: dur(0.5), update: t => {
        st('tl.s1', { l: l + 1, n: last + 1 });
        acts[l].forEach((a, i) => view.setNeuron(l, i, a, t));
        if (l > 0) view.setConnections(l - 1, 1, 1 - t);
      } });
      if (l < last) stages.push({ duration: dur(0.4), update: t => view.setConnections(l, t, 1) });
    }
    // 2. Ошибка
    stages.push({ duration: dur(0.8), update: () => {
      st('tl.s2', { out: { num: acts[last][0], d: 3 }, target: p.t[0], loss: { num: lossBefore, d: 4 } });
      this.grads = grads;
      grads.deltas[last].forEach((d, i) => view.setGradient(last, i, d, 1, maxD));
    } });
    // 3. Обратный проход — от выхода ко входу
    for (let l = last; l >= 1; l--) {
      stages.push({ duration: dur(0.6), update: t => {
        st('tl.s3', { a: l + 1, b: l });
        view.setPulseColor(GRAD);
        view.setConnections(l - 1, 1 - t, 1);
        if (l - 1 >= 1) grads.deltas[l - 1].forEach((d, i) => view.setGradient(l - 1, i, d, t, maxD));
      } });
    }
    // 4. Обновление весов — плавно
    stages.push({ duration: dur(1.2), update: t => {
      st('tl.s4');
      net.weights.forEach((W, l) => W.forEach((row, j) => row.forEach((_, i) => {
        row[i] = this.before.weights[l][j][i] + (after.weights[l][j][i] - this.before.weights[l][j][i]) * t;
      })));
      net.biases.forEach((b, l) => b.forEach((_, j) => { b[j] = this.before.biases[l][j] + (after.biases[l][j] - this.before.biases[l][j]) * t; }));
      view.refreshWeights();
      for (let l = 0; l < last; l++) view.setConnections(l, 0, (1 - t) * 0.6);
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
      this.setStatus(L('tl.stepDone', { a: { num: lossBefore, d: 4 }, b: { num: lossAfter, d: 4 } }));
      const out0 = acts[last][0];
      this.setResult(() => this.backpropSummary(`
        <p>${t('tl.stepTextHtml', {
          name: escapeHtml(str(p.name)), a: fmtNum(out0, 3), b: fmtNum(outAfter, 3), target: p.t[0],
          la: fmtNum(lossBefore, 4), lb: fmtNum(lossAfter, 4),
          dir: lossAfter < lossBefore ? '<b class="ok">↓</b>' : `<b class="bad">${H('tl.tooBig')}</b>`,
        })}</p>
        <p class="list-title">${H('tl.changedMost')}</p>
        <ul class="links">${changes.slice(0, 4).map(c => `<li><span class="grow">${H('tl.linkTitle', { la: c.l + 1, a: t('lab.neuronShort', { n: c.i + 1 }), lb: c.l + 2, b: t('lab.neuronShort', { n: c.j + 1 }) })}</span><span class="num">${c.d >= 0 ? '+' : '−'}${fmtNum(Math.abs(c.d), 4)}</span></li>`).join('')}</ul>`));
      this.refreshHover();
    });
  }

  // ---------- Режим «loop» ----------

  loopControls() {
    const s = this.space;
    return `
      <label for="dataset">${T('tl.data')}</label>
      <select id="dataset">${Object.entries(DATASETS_2D).map(([id, d]) => `<option value="${id}"${id === s.dataset ? ' selected' : ''} ${TA(d.name)}>${H(d.name)}</option>`).join('')}</select>
      <div class="boundary-wrap"><canvas id="boundary" width="220" height="220" ${At('aria-label', 'tl.boundary')}></canvas></div>
      <p class="small muted" id="dataset-note"></p>
      ${this.lrHtml(s.lr ?? 0.05, 0.5)}
      <div class="row">
        <button id="play" class="primary">${T('tl.play')}</button>
        <button id="epoch">${T('tl.oneEpoch')}</button>
      </div>
      <button id="reset" style="width:100%;margin-top:8px">${T('tl.reset')}</button>
      ${modeToggleHtml()}`;
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
      this.setStatus(L('tl.weightsReset'));
    });
  }

  loadDataset(id) {
    const d = DATASETS_2D[id];
    this.data = d.make(seededRandom(11));
    setT(this.$('dataset-note'), d.note);
    this.net.randomize();
    this.history = [];
    this.accHistory = [];
    this.epoch = 0;
    this.view.refreshWeights();
    this.setSceneInfo(() => `<p>${H('tl.sceneLoop', { arch: this.net.layers.join(' → '), n: this.data.X.length })}</p>`);
    this.renderLoop();
    this.setStatus(L('tl.pressPlay'));
  }

  togglePlay() {
    this.playing = !this.playing;
    setT(this.$('play'), this.playing ? 'tl.pause' : 'tl.play');
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
    this.setResult(() => `
      <p>${t('tl.loopLineHtml', { epoch: this.epoch, loss: this.history.length ? fmtNum(this.history.at(-1), 4) : '—', acc: acc !== undefined ? `${Math.round(acc * 100)}%` : '—' })}</p>
      ${lineChartSvg([{ values: this.history, color: '#ff9f1c', label: t('tl.loss') }], { xLabel: t('tl.epoch'), yLabel: t('tl.lossBce'), logY: true })}
      ${lineChartSvg([{ values: this.accHistory, color: '#7ee081', label: t('tl.accuracy') }], { xLabel: t('tl.epoch'), yLabel: t('tl.accuracy'), yMin: 0, yMax: 1, height: 110 })}`);
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
      this.setStatus(L('tl.stopped', { n: this.epoch }));
    } else {
      this.setStatus(L('tl.training', { n: this.epoch }));
    }
  }
}
