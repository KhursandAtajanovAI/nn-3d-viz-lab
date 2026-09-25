import * as THREE from 'three';
import { SceneKit } from './SceneKit.js';
import { headerHtml, detailsCardHtml } from './sidebar.js';

/**
 * Общая основа визуализаторов: боковая панель (шапка, «Управление», «Под курсором», «Результат»,
 * «Сцена», пояснения), 3D-сцена, наведение курсора на объекты, подсказка у курсора и клавиши.
 *
 * Наследник вызывает this.mount({...}), затем строит сцену в this.kit.scene.
 * Объекты, на которые можно навести курсор, передаются в this.enablePicking(() => [...]);
 * у каждого объекта userData.info() возвращает { tooltip, html } для подсказки и панели.
 */
export class BaseLab {
  constructor(space, { sidebar, container }) {
    this.space = space;
    this.sidebar = sidebar;
    this.container = container;
    this.hovered = null;
    this.pointerEvent = null;
    this.keys = new Map();
    addEventListener('keydown', e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const fn = this.keys.get(e.code);
      if (fn) { e.preventDefault(); fn(e); }
    });
  }

  /**
   * @param {object} o
   * @param {string} o.controls — HTML карточки «Управление» (без заголовка)
   * @param {string} [o.resultTitle]
   * @param {object[]} [o.cards] — дополнительные карточки после пояснений пространства: { title, html, open }
   * @param {string} [o.hint] — подсказка внизу панели
   * @param {string} [o.hoverHint] — текст «Под курсором», пока ничего не выбрано
   */
  mount({ controls, resultTitle = 'Результат', cards = [], hint = '', hoverHint = 'Наведите курсор на объект в сцене, чтобы увидеть подробности.' }) {
    const s = this.space;
    this.hoverHint = hoverHint;
    this.sidebar.innerHTML = `
      ${headerHtml(s.meta)}
      <section class="card">
        <h2>Управление</h2>
        ${controls}
        <p id="status" role="status"></p>
      </section>
      <section class="card" id="hover-card">
        <h2>Под курсором</h2>
        <div id="hover-info"><p class="muted">${hoverHint}</p></div>
      </section>
      <section class="card" id="result-card" hidden>
        <h2 id="result-title">${resultTitle}</h2>
        <div id="result"></div>
      </section>
      <section class="card">
        <h2>Сцена</h2>
        ${s.intro ?? ''}
        <div id="scene-info"></div>
      </section>
      ${(s.sections ?? []).map(detailsCardHtml).join('')}
      ${cards.map(detailsCardHtml).join('')}
      ${hint ? `<p class="hint muted">${hint}</p>` : ''}`;

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'tooltip';
    this.tooltip.hidden = true;
    this.container.appendChild(this.tooltip);

    this.kit = new SceneKit(this.container);
    return this.kit;
  }

  $(id) { return this.sidebar.querySelector(`#${id}`); }

  setStatus(text, isError = false) {
    const el = this.$('status');
    el.textContent = text;
    el.classList.toggle('error', isError);
  }

  setResult(html, title) {
    this.$('result').innerHTML = html;
    if (title) this.$('result-title').textContent = title;
    this.$('result-card').hidden = !html;
  }

  setSceneInfo(html) { this.$('scene-info').innerHTML = html; }

  onKey(code, fn) { this.keys.set(code, fn); }

  // ---------- Наведение ----------

  enablePicking(getObjects, { threshold = 6 } = {}) {
    this.getPickables = getObjects;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line2 = { threshold };
    this.raycaster.params.Points = { threshold: 0.15 };
    const canvas = this.kit.renderer.domElement;
    let queued = false;
    canvas.addEventListener('pointermove', ev => {
      this.pointerEvent = ev;
      if (ev.buttons || queued) return; // во время вращения мышью не пересчитываем
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (this.pointerEvent) this.pick(this.pointerEvent);
      });
    });
    canvas.addEventListener('pointerdown', ev => {
      if (ev.pointerType !== 'mouse') { this.pointerEvent = ev; this.pick(ev); }
    });
    canvas.addEventListener('pointerleave', () => { this.pointerEvent = null; this.setHovered(null); });
    canvas.addEventListener('click', ev => {
      const obj = this.pickObject(ev);
      if (obj?.userData.onClick) obj.userData.onClick(ev);
      else if (this.onSceneClick) this.onSceneClick(ev, this.raycaster);
    });
  }

  pickObject(ev) {
    this.kit.pointerRay(ev, this.raycaster);
    const hit = this.raycaster.intersectObjects(this.getPickables(), false)
      .find(h => h.object.visible && (h.object.userData.info || h.object.userData.onClick));
    if (!hit) return null;
    hit.object.userData.hit = hit;
    return hit.object;
  }

  pick(ev) {
    this.setHovered(this.pickObject(ev));
    this.refreshHover();
  }

  setHovered(obj) {
    if (obj === this.hovered) return;
    this.onHoverChange?.(this.hovered, obj);
    this.hovered = obj;
    this.kit.renderer.domElement.style.cursor = obj ? 'pointer' : '';
    this.refreshHover();
  }

  /** Перерисовать «Под курсором» и подсказку (например, когда значения изменились во время анимации) */
  refreshHover() {
    const info = this.hovered?.userData.info?.(this.hovered.userData.hit);
    this.$('hover-info').innerHTML = info?.html ?? `<p class="muted">${this.hoverHint}</p>`;
    const ev = this.pointerEvent;
    if (info?.tooltip && ev) {
      const t = this.tooltip;
      t.textContent = info.tooltip;
      t.hidden = false;
      const rect = this.container.getBoundingClientRect();
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      const flip = x > rect.width - 280;
      t.style.left = `${flip ? x - 14 : x + 14}px`;
      t.style.top = `${Math.max(4, y - 40)}px`;
      t.style.transform = flip ? 'translateX(-100%)' : '';
    } else {
      this.tooltip.hidden = true;
    }
  }
}

/** Переключатель «Визуальный / Детальный · числа» — общий HTML */
export const MODE_TOGGLE_HTML = `
  <label>Режим отображения</label>
  <div class="segmented" role="group" aria-label="Режим отображения">
    <button id="mode-visual" aria-pressed="true">Визуальный</button>
    <button id="mode-detail" aria-pressed="false">Детальный · числа</button>
  </div>`;

export function bindModeToggle(lab, apply) {
  const v = lab.$('mode-visual'), d = lab.$('mode-detail');
  let detail = false;
  const set = on => {
    detail = on;
    v.setAttribute('aria-pressed', String(!on));
    d.setAttribute('aria-pressed', String(on));
    apply(on);
  };
  v.addEventListener('click', () => set(false));
  d.addEventListener('click', () => set(true));
  lab.onKey('KeyN', () => set(!detail));
  return set;
}

export const SPEED_HTML = `
  <label for="speed">Скорость анимации</label>
  <input id="speed" type="range" min="0.5" max="4" step="0.25" value="1.5" />`;
