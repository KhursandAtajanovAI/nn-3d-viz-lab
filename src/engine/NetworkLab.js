import * as THREE from 'three';
import { SceneKit } from './SceneKit.js';
import { NetworkView } from './NetworkView.js';
import { ForwardPassAnimation } from './ForwardPassAnimation.js';
import { MLP } from './models/mlp.js';
import { sceneHtml, hoverHtml, tooltipText, stageText, resultHtml, outputBarsHtml } from './panels.js';
import { headerHtml, detailsCardHtml, FORWARD_PASS_HTML, LEGEND_HTML, HINT_HTML } from './sidebar.js';
import { escapeHtml, formatValue } from './format.js';

/**
 * Визуализатор полносвязной сети (type: 'mlp').
 * Строит боковую панель и 3D-сцену по конфигу пространства — см. spaces/README.md.
 */
export class NetworkLab {
  constructor(space, { sidebar, container }) {
    this.space = space;
    this.sidebar = sidebar;
    this.container = container;
    this.hover = null;
    this.pointerEvent = null;
    this.lastResult = null;

    this.renderSidebar();
    this.kit = new SceneKit(container);
    this.view = new NetworkView(this.kit.scene);
    this.anim = new ForwardPassAnimation(this.view);
    this.anim.stageDuration = 1.2 / Number(this.ui.speed.value);

    this.kit.onResize((w, h) => this.view.setResolution(w, h));
    this.kit.onFrame(dt => this.frame(dt));
    this.bindControls();
    this.bindHover();

    this.model = this.createModel();
    this.rebuildView();
    this.frameCamera();
    setTimeout(() => this.setStatus(`Сеть ${this.model.layers.join(' → ')} готова`), 0);
  }

  // ---------- Конфиг ----------

  /** Имена нейронов по слоям: { input: [...], output: [...] } → [[...], ..., [...]] */
  get names() {
    const n = this.space.names;
    if (!n || !this.model) return [];
    const arr = [];
    if (n.input) arr[0] = n.input;
    if (n.output) arr[this.model.layers.length - 1] = n.output;
    return arr;
  }

  get ctx() {
    return { model: this.model, values: this.view.values, names: this.names };
  }

  createModel(layers) {
    if (this.space.createModel) return this.space.createModel();
    const spec = this.space.model;
    return new MLP(layers ?? spec.layers, {
      activation: this.ui.activation?.value ?? spec.activation,
      outputActivation: spec.outputActivation,
      seed: spec.seed,
    });
  }

  // ---------- Боковая панель ----------

  renderSidebar() {
    const s = this.space;
    const spec = s.model ?? {};
    const editable = !!s.editable;
    const inputs = s.inputs ?? [];

    this.sidebar.innerHTML = `
      ${headerHtml(s.meta)}

      <section class="card">
        <h2>Управление</h2>
        ${editable ? `
          <label for="arch">Архитектура (нейронов в каждом слое)</label>
          <input id="arch" type="text" value="${spec.layers.join(', ')}" spellcheck="false" />` : ''}
        ${inputs.length ? `
          <label for="input-preset">Входные данные</label>
          <select id="input-preset">
            ${inputs.map((p, i) => `<option value="${i}">${escapeHtml(p.name)}</option>`).join('')}
            ${s.randomInput !== false ? '<option value="random">Случайный вход</option>' : ''}
          </select>` : ''}
        <div class="grid2">
          ${editable ? `
            <div>
              <label for="activation">Активация скрытых слоёв</label>
              <select id="activation">
                ${['tanh', 'relu', 'sigmoid'].map(a => `<option value="${a}"${a === spec.activation ? ' selected' : ''}>${a === 'relu' ? 'ReLU' : a}</option>`).join('')}
              </select>
            </div>` : ''}
          <div${editable ? '' : ' class="span2"'}>
            <label for="speed">Скорость анимации</label>
            <input id="speed" type="range" min="0.5" max="4" step="0.25" value="1.5" />
          </div>
        </div>
        ${editable || s.randomizable !== false ? `
          <div class="row">
            ${editable ? '<button id="build">Построить</button>' : ''}
            ${s.randomizable !== false ? '<button id="randomize">Новые веса</button>' : ''}
          </div>` : ''}
        <button id="run" class="primary">▶ Запустить forward pass</button>

        <label>Режим отображения</label>
        <div class="segmented" role="group" aria-label="Режим отображения">
          <button id="mode-visual" aria-pressed="true">Визуальный</button>
          <button id="mode-detail" aria-pressed="false">Детальный · числа</button>
        </div>
        <p id="status" role="status"></p>
      </section>

      <section class="card" id="hover-card">
        <h2>Под курсором</h2>
        <div id="hover-info"></div>
      </section>

      <section class="card" id="result-card" hidden>
        <h2>Результат на выходе</h2>
        <div id="result"></div>
      </section>

      <section class="card">
        <h2>Сцена</h2>
        ${s.intro ?? ''}
        <div id="scene-info"></div>
      </section>

      ${(s.sections ?? []).map(detailsCardHtml).join('')}
      ${detailsCardHtml({ title: 'Что такое forward pass', html: FORWARD_PASS_HTML, open: !(s.sections?.length) })}
      ${detailsCardHtml({ title: 'Как читать картинку', html: LEGEND_HTML, open: !(s.sections?.length) })}
      ${HINT_HTML}`;

    const $ = id => this.sidebar.querySelector(`#${id}`);
    this.ui = {
      arch: $('arch'), activation: $('activation'), inputPreset: $('input-preset'),
      speed: $('speed'), build: $('build'), run: $('run'), randomize: $('randomize'),
      modeVisual: $('mode-visual'), modeDetail: $('mode-detail'), status: $('status'),
      sceneInfo: $('scene-info'), hoverInfo: $('hover-info'),
      resultCard: $('result-card'), result: $('result'), stage: $('stage'),
    };
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'tooltip';
    this.tooltip.hidden = true;
    this.container.appendChild(this.tooltip);
  }

  setStatus(text, isError = false) {
    this.ui.status.textContent = text;
    this.ui.status.classList.toggle('error', isError);
  }

  // ---------- Сеть и анимация ----------

  parseArch(text) {
    const layers = text.split(/[^0-9]+/).filter(Boolean).map(Number);
    if (layers.length < 2 || layers.some(n => n < 1 || n > 64)) {
      throw new Error('Архитектура: минимум 2 слоя, 1–64 нейрона в слое, например «3, 4, 2»');
    }
    return layers;
  }

  frameCamera() {
    const hasNames = this.names.some(Boolean);
    this.kit.frame(this.view.size, { margin: new THREE.Vector2(hasNames ? 3 : 0, 1.2) });
  }

  // Полная перерисовка сцены (после смены архитектуры, весов или активации)
  rebuildView() {
    this.anim.stop();
    this.view.build(this.model, { names: this.names });
    this.view.setResolution(this.kit.width, this.kit.height);
    this.lastResult = null;
    this.ui.resultCard.hidden = true;
    this.ui.run.disabled = false;
    this.hover = null;
    this.refreshHover();
    this.ui.sceneInfo.innerHTML = sceneHtml(this.ctx, { editable: !!this.space.editable });
    this.updateStage();
  }

  buildFromInputs() {
    try {
      this.model = this.createModel(this.parseArch(this.ui.arch.value));
      this.rebuildView();
      this.frameCamera();
      this.setStatus(`Сеть ${this.model.layers.join(' → ')} построена`);
    } catch (e) {
      this.setStatus(e.message, true);
    }
  }

  /** Вход для очередного прогона: выбранный пресет или случайные числа */
  nextInput() {
    const presets = this.space.inputs ?? [];
    const v = this.ui.inputPreset?.value;
    if (presets.length && v !== 'random') {
      const p = presets[Number(v)];
      return { values: p.values, caption: p.name };
    }
    return { values: this.model.randomInput(), caption: presets.length ? 'случайный' : '' };
  }

  runForward() {
    if (this.anim.running) return;
    const input = this.nextInput();
    const acts = this.model.forward(input.values);
    this.ui.run.disabled = true;
    this.ui.resultCard.hidden = true;
    this.anim.start(acts, result => {
      this.ui.run.disabled = false;
      this.lastResult = result;
      const helpers = { outputBarsHtml, formatValue, escapeHtml, defaultResult: () => resultHtml(this.ctx, result, { inputCaption: input.caption }) };
      this.ui.result.innerHTML = this.space.explainResult
        ? this.space.explainResult(this.ctx, result, helpers)
        : helpers.defaultResult();
      this.ui.resultCard.hidden = false;
      this.setStatus('Forward pass завершён — результат ниже');
      this.updateStage();
      this.refreshHover();
    });
  }

  setMode(detail) {
    this.view.setShowNumbers(detail);
    this.ui.modeVisual.setAttribute('aria-pressed', String(!detail));
    this.ui.modeDetail.setAttribute('aria-pressed', String(detail));
  }

  // Этап анимации: текст в карточке forward pass + подсветка слоя в списке
  updateStage() {
    const { anim, ui } = this;
    const items = ui.sceneInfo.querySelectorAll('li[data-layer]');
    if (anim.running) {
      const current = anim.stage >> 1;
      const onLayer = anim.stage % 2 === 0;
      items.forEach((li, l) => {
        li.classList.toggle('active', onLayer ? l === current : l === current || l === current + 1);
        li.classList.toggle('done', l < current || (l === current && !onLayer));
      });
      ui.stage.textContent = stageText(anim.stage, this.model);
      ui.stage.classList.add('live');
    } else {
      items.forEach(li => {
        li.classList.remove('active');
        li.classList.toggle('done', !!this.lastResult);
      });
      ui.stage.textContent = this.lastResult
        ? 'Готово: сигнал дошёл до выходного слоя. Запустите ещё раз с другим входом.'
        : 'Нажмите «Запустить forward pass» или пробел.';
      ui.stage.classList.remove('live');
    }
  }

  frame(dt) {
    if (!this.anim.running) return;
    this.anim.update(dt);
    this.updateStage();
    // Числа в панели обновляются вместе с яркостью нейронов (не чаще ~12 раз/с)
    const now = performance.now();
    if (this.hover && now - (this.lastPanelUpdate ?? 0) > 80) {
      this.refreshHover();
      this.lastPanelUpdate = now;
    }
  }

  // ---------- Наведение на нейроны и связи ----------

  pick(ev) {
    const raycaster = this.raycaster;
    this.kit.pointerRay(ev, raycaster);
    const { neurons, connections } = this.view.pickables;
    const hitN = raycaster.intersectObjects(neurons, false)[0];
    if (hitN) return { type: 'neuron', layer: hitN.object.userData.layer, index: hitN.object.userData.index };
    const hitL = raycaster.intersectObjects(connections, false)[0];
    if (hitL) {
      const c = this.view.connectionAt(hitL.object.userData.gap, hitL.faceIndex);
      return { type: 'weight', gap: c.gap, from: c.from, to: c.to };
    }
    return null;
  }

  setHover(h) {
    if (JSON.stringify(h) === JSON.stringify(this.hover)) return;
    this.hover = h;
    this.view.setHover(h);
    this.kit.renderer.domElement.style.cursor = h ? 'pointer' : '';
    this.refreshHover();
  }

  refreshHover() {
    const { hover, tooltip, pointerEvent } = this;
    this.ui.hoverInfo.innerHTML = hoverHtml(hover, this.ctx);
    if (hover && pointerEvent) {
      tooltip.textContent = tooltipText(hover, this.ctx);
      tooltip.hidden = false;
      const rect = this.container.getBoundingClientRect();
      const x = pointerEvent.clientX - rect.left, y = pointerEvent.clientY - rect.top;
      const flip = x > rect.width - 280; // у правого края показываем подсказку слева от курсора
      tooltip.style.left = `${flip ? x - 14 : x + 14}px`;
      tooltip.style.top = `${Math.max(4, y - 40)}px`; // над курсором, чтобы не закрывать подписи весов
      tooltip.style.transform = flip ? 'translateX(-100%)' : '';
    } else {
      tooltip.hidden = true;
    }
  }

  bindHover() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line2 = { threshold: 6 };
    const canvas = this.kit.renderer.domElement;
    let queued = false;
    canvas.addEventListener('pointermove', ev => {
      this.pointerEvent = ev;
      if (ev.buttons || queued) return; // во время вращения мышью не пересчитываем
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (!this.pointerEvent) return;
        this.setHover(this.pick(this.pointerEvent));
        if (this.hover) this.refreshHover(); // двигаем подсказку за курсором
      });
    });
    canvas.addEventListener('pointerdown', ev => {
      if (ev.pointerType !== 'mouse') { this.pointerEvent = ev; this.setHover(this.pick(ev)); }
    });
    canvas.addEventListener('pointerleave', () => { this.pointerEvent = null; this.setHover(null); });
  }

  // ---------- Кнопки и клавиши ----------

  bindControls() {
    const { ui } = this;
    ui.build?.addEventListener('click', () => this.buildFromInputs());
    ui.arch?.addEventListener('keydown', e => { if (e.key === 'Enter') this.buildFromInputs(); });
    ui.activation?.addEventListener('change', () => {
      this.model.activation = ui.activation.value;
      this.rebuildView();
      this.setStatus(`Активация скрытых слоёв: ${ui.activation.value}`);
    });
    ui.randomize?.addEventListener('click', () => {
      this.model.randomize();
      this.rebuildView();
      this.setStatus('Веса перегенерированы');
    });
    ui.run.addEventListener('click', () => this.runForward());
    ui.speed.addEventListener('input', () => { this.anim.stageDuration = 1.2 / Number(ui.speed.value); });
    ui.modeVisual.addEventListener('click', () => this.setMode(false));
    ui.modeDetail.addEventListener('click', () => this.setMode(true));
    addEventListener('keydown', e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); this.runForward(); }
      if (e.code === 'KeyN') this.setMode(!this.view.showNumbers);
    });
  }
}
