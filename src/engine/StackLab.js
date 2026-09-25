import * as THREE from 'three';
import { BaseLab, MODE_TOGGLE_HTML, SPEED_HTML, bindModeToggle } from './BaseLab.js';
import { StackView } from './StackView.js';
import { Timeline } from './Timeline.js';
import { KINDS, kindInfo, formatShape, formatCount, layerParams } from './stackKinds.js';
import { escapeHtml, formatValue } from './format.js';
import { seededRandom } from './models/mlp.js';

/**
 * Визуализатор архитектур из блоков (type: 'stack'): свёрточные сети, автоэнкодеры, GAN, трансформеры.
 *
 * Конфиг пространства:
 *   layers: [{ name, kind, shape, maps?, note?, kernel?, params?, repeat? }]
 *   skips?, groups?, outputNames?
 *   input?: { kind: 'image', size, channels, classes, draw?, generate?(cls, rnd) }
 *   setup?(ctx) → Promise<runtime>, где runtime.run(img) → { maps: {i: …}, vectors: {i: […]}, probs }
 *   demo?(img, sample) → то же без setup (для иллюстраций)
 *   explainResult?(result, info) → HTML
 */
export class StackLab extends BaseLab {
  constructor(space, dom) {
    super(space, dom);
    const s = space;
    this.layers = s.layers.map((L, i) => ({ ...L, _params: layerParams(L, s.layers[i - 1]) }));
    this.input = s.input ?? null;
    // Классы для полосок результата; подписи у выходных шаров — только если заданы outputNames
    this.classes = s.resultClasses ?? s.outputNames ?? this.input?.classes ?? [];
    this.rnd = seededRandom(s.meta.id.length * 97 + 1);

    const kindsUsed = [...new Set(this.layers.map(l => l.kind))];
    this.mount({
      controls: this.controlsHtml(),
      resultTitle: 'Результат на выходе',
      hoverHint: 'Наведите курсор на слой, карту признаков или нейрон.',
      cards: [
        { title: 'Как читать сцену', open: !(s.sections?.length), html: this.legendHtml(kindsUsed) },
      ],
      hint: 'Мышь: ЛКМ — вращать · колесо — масштаб · ПКМ — сдвиг.<br />Клавиши: пробел — прогнать через сеть, N — показать/скрыть числа.',
    });

    this.view = new StackView(this.kit.scene);
    this.view.build(this.layers, { skips: s.skips, groups: s.groups, outputNames: s.outputNames ?? [] });
    this.kit.onResize((w, h) => this.view.setResolution(w, h));
    this.kit.setAutoFrame(() => this.frameCamera());

    this.timeline = new Timeline();
    this.kit.onFrame(dt => {
      if (!this.timeline.running) return;
      this.timeline.update(dt);
      const now = performance.now();
      if (this.hovered && now - (this.lastHoverUpdate ?? 0) > 100) { this.refreshHover(); this.lastHoverUpdate = now; }
    });

    this.enablePicking(() => this.view.pickables);
    this.onHoverChange = (_, obj) => this.view.highlight(obj ? obj.userData.layer : null);
    this.decoratePickables();
    this.setSceneInfo(this.architectureHtml());
    this.bindControls();
    this.prepare();
  }

  /** Камера под углом: вход ближе к зрителю, длинная цепочка слоёв уходит в глубину */
  frameCamera() {
    const { width: w, height: h, depth: d } = this.view.bounds;
    const top = h / 2 + 1.1 + (this.space.skips?.length ? 1.6 : 0);
    const bottom = -h / 2 - (this.space.groups?.length ? 1.5 : 0.8);
    const right = w / 2 + (this.space.outputNames?.length ? 1.6 : 0.3);
    const box = new THREE.Box3(new THREE.Vector3(-w / 2 - 0.3, bottom, -d / 2), new THREE.Vector3(right, top, d / 2));
    this.kit.fitBox(box, { dir: new THREE.Vector3(-0.38, 0.26, 1) });
  }

  // ---------- Панель ----------

  controlsHtml() {
    const inp = this.input;
    let html = '';
    if (inp?.kind === 'image') {
      html += `
        <div class="input-panel">
          <canvas id="input-canvas" width="168" height="168" class="${inp.draw ? 'drawable' : ''}" aria-label="Входная картинка"></canvas>
          <div class="input-side">
            <label for="sample-class">${inp.draw ? 'Пример из набора' : 'Картинка на входе'}</label>
            <select id="sample-class">
              <option value="random">Случайный класс</option>
              ${inp.classes.map((c, i) => `<option value="${i}">${escapeHtml(c)}</option>`).join('')}
            </select>
            <button id="next-sample">Другой пример</button>
            ${inp.draw ? '<button id="clear-canvas">Очистить</button>' : ''}
          </div>
        </div>
        ${inp.draw ? '<p class="small muted">Нарисуйте цифру мышью или пальцем прямо на картинке — сеть распознает её сразу после того, как вы отпустите кнопку.</p>' : ''}`;
    } else if (this.space.inputs?.length) {
      html += `<label for="preset">Вход</label><select id="preset">${this.space.inputs.map((p, i) => `<option value="${i}">${escapeHtml(p.name)}</option>`).join('')}</select>`;
    }
    html += `
      ${SPEED_HTML}
      <button id="run" class="primary" disabled>▶ Прогнать через сеть</button>
      ${MODE_TOGGLE_HTML}`;
    return html;
  }

  legendHtml(kinds) {
    const hasMaps = this.layers.some(l => l.maps);
    return `
      <ul class="legend kinds">
        ${kinds.map(k => `<li><span class="kind-swatch" style="--c:#${new THREE.Color(KINDS[k]?.color ?? 0x8a9ab3).getHexString()}"></span>
          <span><b>${KINDS[k]?.title ?? k}.</b> ${KINDS[k]?.info ?? ''}</span></li>`).join('')}
      </ul>
      ${hasMaps ? `<p class="small muted">Плоскости в стопке — <b>карты признаков</b>: каждая показывает, где на картинке фильтр нашёл «свой» признак.
        Тёмное — признака нет, <b class="pos">оранжевое → светло-жёлтое</b> — признак выражен сильно.</p>` : ''}
      <p class="small muted">Размер блока по высоте — пространственный размер (сколько пикселей), толщина — число каналов.
        Шары — нейроны векторных слоёв (показаны не больше ${12} из каждого слоя). Синие дуги сверху — остаточные связи.</p>`;
  }

  architectureHtml() {
    const total = this.layers.reduce((a, l) => a + (l._params ?? 0), 0);
    const rows = this.layers.map((L, i) => `
      <tr data-layer="${i}">
        <td><span class="kind-swatch" style="--c:#${new THREE.Color(kindInfo(L.kind).color).getHexString()}"></span></td>
        <td>${escapeHtml(L.name)}${L.repeat > 1 ? ` <span class="muted">×${L.repeat}</span>` : ''}</td>
        <td class="num">${formatShape(L.shape)}</td>
        <td class="num muted">${L._params ? formatCount(L._params) : '—'}</td>
      </tr>`).join('');
    return `
      <table class="arch-table">
        <thead><tr><th></th><th>Слой</th><th>Выход</th><th>Параметры</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="small muted">Всего слоёв на схеме: ${this.layers.length}${total ? ` · обучаемых параметров: <b>${formatCount(this.space.totalParams ?? total)}</b>` : ''}.</p>`;
  }

  // ---------- Подсказки при наведении ----------

  decoratePickables() {
    for (const it of this.view.items) {
      for (const m of it.pick) m.userData.info = () => this.infoFor(it, m.userData);
    }
  }

  infoFor(it, ud) {
    const L = it.layer, K = kindInfo(L.kind);
    let extra = '', tooltip = `${L.name} · ${formatShape(L.shape)}`;
    if (ud.channel !== undefined) {
      const f = L.filters?.[ud.channel];
      const m = it.maps?.[ud.channel];
      const max = m ? m.data.reduce((a, v) => Math.max(a, v), 0) : null;
      tooltip = `${L.name} · канал ${ud.channel + 1}${f ? ` — ${f.name}` : ''}`;
      extra = `<p>Канал <b>${ud.channel + 1}</b> из ${L.shape[2]}${f ? `: <b>${escapeHtml(f.name)}</b> — ${escapeHtml(f.description ?? '')}` : ''}.</p>
        ${f?.kernel ? kernelHtml(f.kernel) : ''}
        ${m && L.kind !== 'input' ? `<p class="muted small">Максимум на карте: ${formatValue(max)} · светлые места — где признак найден.</p>` : ''}`;
    } else if (ud.neuron !== undefined) {
      const v = it.vector?.[ud.neuron];
      const name = L.kind === 'output' ? this.space.outputNames?.[ud.neuron] : null;
      tooltip = `${L.name} · нейрон ${ud.neuron + 1}${name ? ` (${name})` : ''}${v !== undefined ? ` · ${L.kind === 'output' ? `${(v * 100).toFixed(1)}%` : formatValue(v, 3)}` : ''}`;
      extra = `<p>Нейрон <b>${ud.neuron + 1}</b>${name ? ` — класс «${escapeHtml(name)}»` : ''}${L.shape[0] > 12 ? ` (показаны первые 12 из ${L.shape[0]})` : ''}.</p>
        ${v !== undefined ? `<p>${L.kind === 'output' ? 'Вероятность' : 'Активация'}: <b class="num">${L.kind === 'output' ? `${(v * 100).toFixed(1)}%` : formatValue(v, 3)}</b></p>` : '<p class="muted">Значение появится после прогона.</p>'}`;
    }
    const params = L._params
      ? `<p>${L.fixed ? 'Параметров (заданы вручную, не обучаются)' : 'Обучаемых параметров'}: <b>${formatCount(L._params)}</b></p>`
      : '';
    return {
      tooltip,
      html: `
        <h3>${escapeHtml(L.name)} <span class="muted">· ${K.title}</span></h3>
        <p>Выход: <b class="num">${formatShape(L.shape)}</b>${L.kernel ? ` · ядро ${L.kernel}×${L.kernel}` : ''}</p>
        ${params}
        ${extra}
        <p class="muted small">${K.info}</p>
        ${L.note ? `<p class="small">${L.note}</p>` : ''}`,
    };
  }

  // ---------- Подготовка и прогон ----------

  async prepare() {
    const run = this.$('run');
    try {
      if (this.space.setup) {
        this.setStatus('Подготовка сети…');
        this.runtime = await this.space.setup({
          onProgress: p => this.setStatus(p.phase === 'data'
            ? `Генерирую обучающие картинки… ${Math.round((p.done / p.total) * 100)}%`
            : `Обучаю классификатор: эпоха ${p.epoch} из ${p.epochs}, ошибка ${p.loss.toFixed(3)}`),
        });
        const acc = this.runtime.accuracy;
        this.setStatus(acc !== undefined ? `Готово. Точность на новых картинках: ${Math.round(acc * 100)}%` : 'Готово');
      } else {
        this.setStatus('Готово — нажмите «Прогнать через сеть»');
      }
      run.disabled = false;
      if (this.input?.kind === 'image') this.newSample();
    } catch (e) {
      console.error(e);
      this.setStatus(`Не удалось подготовить сеть: ${e.message}`, true);
    }
  }

  get generate() {
    return this.runtime?.generate ?? this.input?.generate;
  }

  newSample() {
    const sel = this.$('sample-class');
    const cls = sel.value === 'random' ? Math.floor(this.rnd() * this.input.classes.length) : Number(sel.value);
    this.current = { img: this.generate(cls, this.rnd), label: cls, drawn: false };
    this.showInput(this.current.img);
    this.view.reset();
    this.view.clearMaps();
    this.view.setMaps(0, this.current.img);
    this.setResult('');
  }

  showInput(img) {
    const cv = this.$('input-canvas');
    const tmp = document.createElement('canvas');
    tmp.width = img.w;
    tmp.height = img.h;
    const ctx = tmp.getContext('2d');
    const out = ctx.createImageData(img.w, img.h), n = img.w * img.h;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) out.data[i * 4 + c] = 255 * (img.c === 3 ? img.data[c * n + i] : img.data[i]);
      out.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, 0, 0, cv.width, cv.height);
  }

  run() {
    if (this.timeline.running || this.$('run').disabled) return;
    let result;
    const img = this.current?.img;
    const preset = this.space.inputs?.[Number(this.$('preset')?.value ?? 0)];
    if (this.runtime?.run) result = this.runtime.run(img);
    else if (this.space.demo) result = this.space.demo(img, { preset, sample: this.current, rnd: this.rnd });
    else result = this.defaultDemo();
    this.lastResult = result;

    this.view.reset();
    this.view.clearMaps();
    if (img) this.view.setMaps(0, img);
    const shown = new Set([0]); // карты слоя появляются в момент, когда до него доходит сигнал
    const speed = () => 1.1 / Number(this.$('speed').value);
    const stages = [];
    this.layers.forEach((L, i) => {
      stages.push({
        duration: speed(),
        update: t => {
          if (t > 0 && result.maps?.[i] && !shown.has(i)) { this.view.setMaps(i, result.maps[i]); shown.add(i); }
          if (result.vectors?.[i]) this.view.setVector(i, result.vectors[i], t);
          this.view.setActive(i, t);
          if (i > 0) this.view.setFlow(i - 1, 1, 1 - t);
          (this.space.skips ?? []).forEach((sk, k) => { if (sk.to === i) this.view.setSkip(k, 1 - t); });
          this.$('status').textContent = `Слой ${i + 1} из ${this.layers.length}: ${L.name}`;
        },
      });
      if (i < this.layers.length - 1) {
        stages.push({
          duration: speed() * 0.7,
          update: t => {
            this.view.setFlow(i, t, 1);
            (this.space.skips ?? []).forEach((sk, k) => { if (sk.from === i) this.view.setSkip(k, t); });
          },
        });
      }
    });
    this.$('run').disabled = true;
    this.timeline.start(stages, () => {
      this.$('run').disabled = false;
      this.showResult(result);
      this.refreshHover();
    });
  }

  /** Для схем без настоящих вычислений: правдоподобные активации и заданный в конфиге ответ */
  defaultDemo() {
    const vectors = {};
    this.layers.forEach((L, i) => {
      if (L.shape.length === 1 && i < this.layers.length - 1) {
        vectors[i] = Array.from({ length: Math.min(L.shape[0], 12) }, () => Math.max(0, this.rnd() * 2 - 0.6));
      }
    });
    const probs = this.space.demoOutput ?? [];
    if (probs.length) vectors[this.layers.length - 1] = probs;
    return { vectors, probs };
  }

  showResult(result) {
    this.setStatus('Прогон завершён — результат ниже');
    const probs = result.probs ?? [];
    // Демо-функция может вернуть свои названия классов (например, варианты следующего слова)
    const classes = result.classes ?? this.classes;
    let html = '';
    if (probs.length && classes.length) {
      // resultFormat: 'value' — выходы не вероятности (например, Q-значения), показываем как числа
      const asValue = this.space.resultFormat === 'value';
      const order = probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]).slice(0, Math.min(10, probs.length));
      const best = order[0][1];
      const maxAbs = Math.max(1e-9, ...probs.map(Math.abs));
      html += `<ul class="bars">${order.map(([p, i]) => `
        <li class="${i === best ? 'best' : ''}">
          <span class="name">${escapeHtml(classes[i])}</span>
          <span class="bar"><span style="width:${((asValue ? Math.abs(p) / maxAbs : p) * 100).toFixed(1)}%"></span></span>
          <span class="num">${asValue ? formatValue(p, 2) : `${(p * 100).toFixed(1)}%`}</span><span></span>
        </li>`).join('')}</ul>`;
      // Проверка «верно/ошибка» — только когда классы результата совпадают с классами примеров
      // В демонстрационных пространствах ответ заранее согласован с картинкой — «верно» там ничего не значит
      const truth = !this.space.resultClasses && this.space.meta.fidelity !== 'demo' && this.current && !this.current.drawn ? this.current.label : null;
      if (truth !== null && truth !== undefined) {
        html += truth === best
          ? `<p><b class="ok">✓ Верно:</b> на входе «${escapeHtml(this.input.classes[truth])}».</p>`
          : `<p><b class="bad">✗ Ошибка:</b> на входе был «${escapeHtml(this.input.classes[truth])}», сеть ответила «${escapeHtml(classes[best])}».</p>`;
      }
    }
    const extra = this.space.explainResult?.(result, { classes, current: this.current, runtime: this.runtime });
    if (extra) html += extra;
    this.setResult(html);
  }

  // ---------- Управление ----------

  bindControls() {
    this.$('run').addEventListener('click', () => this.run());
    this.onKey('Space', () => this.run());
    bindModeToggle(this, on => this.view.setShowNumbers(on));
    this.$('next-sample')?.addEventListener('click', () => { this.newSample(); this.run(); });
    this.$('sample-class')?.addEventListener('change', () => { this.newSample(); this.run(); });
    this.$('preset')?.addEventListener('change', () => this.run());
    if (this.input?.draw) this.bindDrawing();
  }

  /** Рисование на входной картинке: штрихи → нормализация как в MNIST → прогон */
  bindDrawing() {
    const cv = this.$('input-canvas');
    const ctx = cv.getContext('2d');
    let drawing = false, dirty = false, last = null;
    const pos = e => {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)];
    };
    const clear = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cv.width, cv.height);
    };
    cv.addEventListener('pointerdown', e => {
      if (!this.runtime) return;
      if (!this.current?.drawn) { clear(); this.current = { drawn: true }; this.view.reset(); this.view.clearMaps(); this.setResult(''); }
      drawing = true;
      last = pos(e);
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!drawing) return;
      const p = pos(e);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(...last);
      ctx.lineTo(...p);
      ctx.stroke();
      last = p;
      dirty = true;
    });
    const finish = () => {
      if (!drawing) return;
      drawing = false;
      if (!dirty) return;
      dirty = false;
      this.current = { img: this.runtime.fromDrawing(cv), drawn: true };
      this.timeline.stop();
      this.$('run').disabled = false;
      this.run();
    };
    cv.addEventListener('pointerup', finish);
    cv.addEventListener('pointercancel', finish);
    this.$('clear-canvas').addEventListener('click', () => {
      clear();
      this.current = { drawn: true };
      this.view.reset();
      this.view.clearMaps();
      this.setResult('');
      this.setStatus('Холст очищен — нарисуйте цифру');
    });
  }
}

/** Ядро свёртки маленькой таблицей с цветом по знаку */
function kernelHtml(kernel) {
  const { size, data } = kernel;
  const max = Math.max(...Array.from(data, Math.abs)) || 1;
  let cells = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = data[y * size + x] / max;
      const bg = v >= 0 ? `rgba(255,159,28,${Math.abs(v).toFixed(2)})` : `rgba(47,155,255,${Math.abs(v).toFixed(2)})`;
      cells += `<span style="background:${bg}" title="${data[y * size + x].toFixed(3)}"></span>`;
    }
  }
  return `<div class="kernel" style="--n:${size}" aria-label="Веса фильтра">${cells}</div>
    <p class="small muted">Веса фильтра ${size}×${size}: <b class="pos">оранжевые</b> — положительные, <b class="neg">синие</b> — отрицательные.</p>`;
}
