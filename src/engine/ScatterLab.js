import * as THREE from 'three';
import { BaseLab, MODE_TOGGLE_HTML, bindModeToggle } from './BaseLab.js';
import { makeLabel, makeLines, setLineResolution, GROUP_COLORS, disposeTree } from './three-utils.js';
import { escapeHtml } from './format.js';
import { seededRandom } from './models/mlp.js';

/**
 * Облако точек в 3D (type: 'scatter'): эмбеддинги слов, кластеризация, рекомендации.
 *
 * Конфиг:
 *   setup({ rnd, onProgress }) → state: { points: [{ id, label, pos: [x,y,z], group }], groups: { id: { label, color? } } }
 *   controls: [{ id, kind: 'select' | 'button' | 'auto', label, options?, run(state, value) → view }]
 *   initialView?(state) → view
 *   describe(point, state) → { tooltip, html }
 *   axes?: ['подпись X', 'подпись Y', 'подпись Z']
 *
 * view: { points?: { id: { pos?, group? } }, highlight?: [ids], lines?: [{ from, to, color?, width?, label?, arrow? }],
 *         markers?: [{ id, pos, label, color?, info? }], html?, status? }
 */
export class ScatterLab extends BaseLab {
  constructor(space, dom) {
    super(space, dom);
    const s = space;
    this.mount({
      controls: `${(s.controls ?? []).map(c => this.controlHtml(c)).join('')}${MODE_TOGGLE_HTML}`,
      resultTitle: s.resultTitle ?? 'Результат',
      hoverHint: 'Наведите курсор на точку, чтобы увидеть подробности.',
      cards: s.legendHtml ? [{ title: 'Как читать сцену', open: !(s.sections?.length), html: s.legendHtml }] : [],
      hint: 'Мышь: ЛКМ — вращать · колесо — масштаб · ПКМ — сдвиг. N — показать/скрыть координаты.',
    });
    this.group = new THREE.Group();
    this.overlay = new THREE.Group();
    this.kit.scene.add(this.group, this.overlay);
    this.sphereGeo = new THREE.SphereGeometry(0.13, 20, 12);
    this.tweens = [];
    this.kit.onResize((w, h) => { setLineResolution(this.group, w, h); setLineResolution(this.overlay, w, h); });
    this.kit.onFrame(dt => this.frame(dt));
    this.enablePicking(() => [...(this.meshes ?? []), ...(this.markerMeshes ?? [])]);
    bindModeToggle(this, on => {
      this.showNumbers = on;
      this.coordLabels?.forEach(l => { l.visible = on; });
    });
    this.init();
  }

  controlHtml(c) {
    if (c.kind === 'select') {
      return `<label for="c-${c.id}">${escapeHtml(c.label)}</label>
        <select id="c-${c.id}">${c.options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('')}</select>`;
    }
    if (c.kind === 'range') {
      return `<label for="c-${c.id}">${escapeHtml(c.label)}: <b id="c-${c.id}-v">${c.value}</b></label>
        <input id="c-${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step ?? 1}" value="${c.value}" />`;
    }
    return `<button id="c-${c.id}" class="${c.primary ? 'primary' : ''}" style="width:100%;margin-top:8px">${escapeHtml(c.label)}</button>`;
  }

  async init() {
    const s = this.space;
    this.setStatus('Подготовка…');
    try {
      this.state = await s.setup({ rnd: seededRandom(7), onProgress: t => this.setStatus(t) });
    } catch (e) {
      console.error(e);
      this.setStatus(`Ошибка подготовки: ${e.message}`, true);
      return;
    }
    this.buildPoints();
    this.bindControls();
    this.apply(s.initialView?.(this.state) ?? {});
    if (!this.$('status').textContent.startsWith('Ошибка')) this.setStatus(this.state.status ?? 'Готово');
  }

  groupColor(g) {
    const grp = this.state.groups?.[g];
    if (grp?.color) return grp.color;
    const keys = Object.keys(this.state.groups ?? {});
    return GROUP_COLORS[Math.max(0, keys.indexOf(String(g))) % GROUP_COLORS.length];
  }

  buildPoints() {
    disposeTree(this.group);
    this.meshes = [];
    this.coordLabels = [];
    this.byId = new Map();
    for (const p of this.state.points) {
      const color = new THREE.Color(this.groupColor(p.group));
      const m = new THREE.Mesh(this.sphereGeo, new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.25, roughness: 0.5, transparent: true, opacity: 1,
      }));
      m.position.set(...p.pos);
      m.userData.point = p;
      m.userData.info = () => this.space.describe?.(p, this.state) ?? { tooltip: p.label, html: `<h3>${escapeHtml(p.label)}</h3>` };
      if (p.label && !this.space.hideLabels) {
        const l = makeLabel('point-label', p.label, { center: [0, 0.5] });
        l.position.set(0.18, 0, 0);
        m.add(l);
        m.userData.label = l;
      }
      const c = makeLabel('value-label', '', { center: [0, 0] });
      c.position.set(0.15, -0.3, 0);
      c.visible = !!this.showNumbers;
      m.add(c);
      m.userData.coord = c;
      this.coordLabels.push(c);
      this.updateCoord(m);
      this.group.add(m);
      this.meshes.push(m);
      this.byId.set(p.id, m);
    }
    if (this.space.axes) this.buildAxes();
    this.frameCamera();
  }

  updateCoord(m) {
    const p = m.position;
    m.userData.coord.element.textContent = `(${p.x.toFixed(1)}; ${p.y.toFixed(1)}; ${p.z.toFixed(1)})`;
  }

  buildAxes() {
    const box = new THREE.Box3().setFromObject(this.group);
    const L = Math.max(...box.getSize(new THREE.Vector3()).toArray()) * 0.6 + 0.5;
    const o = new THREE.Vector3();
    const axes = [new THREE.Vector3(L, 0, 0), new THREE.Vector3(0, L, 0), new THREE.Vector3(0, 0, L)];
    this.group.add(makeLines(axes.map(a => [a.clone().negate().multiplyScalar(0.3), a]), { width: 1, color: 0x3a4660, opacity: 0.8 }));
    axes.forEach((a, i) => {
      const l = makeLabel('dim-label', this.space.axes[i]);
      l.position.copy(a).multiplyScalar(1.05).add(o);
      this.group.add(l);
    });
  }

  frameCamera() {
    const box = new THREE.Box3().setFromObject(this.group);
    box.expandByScalar(0.5);
    box.max.x += 1; // подписи точек справа
    this.kit.setAutoFrame(() => this.kit.fitBox(box, { dir: new THREE.Vector3(0.45, 0.35, 1), margin: 0.9 }));
    setLineResolution(this.group, this.kit.width, this.kit.height);
  }

  /** Применить «вид», который вернуло действие пространства */
  apply(view) {
    if (!view) return;
    if (view.rebuild) { this.tweens = []; this.buildPoints(); } // набор точек сменился целиком
    // Перемещения и перекраска точек — плавно
    if (view.points) {
      for (const [id, upd] of Object.entries(view.points)) {
        const m = this.byId.get(isNaN(id) ? id : Number(id)) ?? this.byId.get(id);
        if (!m) continue;
        if (upd.group !== undefined) {
          m.userData.point.group = upd.group;
          const c = new THREE.Color(this.groupColor(upd.group));
          this.tween(m, { color: c });
        }
        if (upd.pos) {
          m.userData.point.pos = upd.pos;
          this.tween(m, { pos: new THREE.Vector3(...upd.pos) });
        }
      }
    }
    // Подсветка
    const hl = view.highlight ? new Set(view.highlight) : null;
    for (const m of this.meshes) {
      const on = !hl || hl.has(m.userData.point.id);
      m.material.opacity = on ? 1 : 0.25;
      m.material.emissiveIntensity = hl && on ? 0.9 : 0.25;
      m.scale.setScalar(hl && on ? 1.5 : 1);
      if (m.userData.label) m.userData.label.element.style.opacity = on ? '1' : '0.35';
    }
    // Линии, стрелки и маркеры — пересобираем
    if (view.lines || view.markers || view.clear) this.buildOverlay(view);
    if (view.html !== undefined) this.setResult(view.html);
    if (view.status) this.setStatus(view.status);
    this.refreshHover();
  }

  resolve(p) {
    if (Array.isArray(p)) return new THREE.Vector3(...p);
    const m = this.byId.get(p);
    return m ? m.position.clone() : new THREE.Vector3();
  }

  buildOverlay(view) {
    disposeTree(this.overlay);
    this.markerMeshes = [];
    const segs = [];
    for (const ln of view.lines ?? []) {
      const a = this.resolve(ln.from), b = this.resolve(ln.to);
      segs.push([a, b, ln.color ?? '#ffd166']);
      if (ln.arrow) {
        const dir = b.clone().sub(a);
        const len = dir.length();
        if (len > 0.3) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 12), new THREE.MeshBasicMaterial({ color: ln.color ?? '#ffd166' }));
          cone.position.copy(b).addScaledVector(dir.normalize(), -0.2);
          cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          this.overlay.add(cone);
        }
      }
      if (ln.label) {
        const l = makeLabel('shape-label', ln.label);
        l.position.copy(a).lerp(b, 0.5);
        this.overlay.add(l);
      }
    }
    if (segs.length) {
      const widths = [...new Set((view.lines ?? []).map(l => l.width ?? 2))];
      // Линии разной толщины — отдельными объектами
      for (const w of widths) {
        const part = segs.filter((_, i) => (view.lines[i].width ?? 2) === w);
        this.overlay.add(makeLines(part, { width: w, opacity: 0.9 }));
      }
    }
    for (const mk of view.markers ?? []) {
      const color = new THREE.Color(mk.color ?? '#ffffff');
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, wireframe: !!mk.wire }));
      m.position.copy(this.resolve(mk.pos));
      if (mk.label) {
        const l = makeLabel('name-label', mk.label, { center: [0.5, 0] });
        l.position.set(0, 0.3, 0);
        m.add(l);
      }
      m.userData.info = mk.info ? () => mk.info : null;
      this.overlay.add(m);
      this.markerMeshes.push(m);
    }
    setLineResolution(this.overlay, this.kit.width, this.kit.height);
  }

  tween(m, { pos, color }) {
    this.tweens = this.tweens.filter(t => !(t.m === m && ((pos && t.pos) || (color && t.color))));
    this.tweens.push({ m, t: 0, pos, from: m.position.clone(), color, fromColor: m.material.color.clone() });
  }

  frame(dt) {
    if (!this.tweens.length) return;
    for (const tw of this.tweens) {
      tw.t = Math.min(1, tw.t + dt / 0.6);
      const e = tw.t * tw.t * (3 - 2 * tw.t);
      if (tw.pos) { tw.m.position.lerpVectors(tw.from, tw.pos, e); this.updateCoord(tw.m); }
      if (tw.color) { tw.m.material.color.lerpColors(tw.fromColor, tw.color, e); tw.m.material.emissive.copy(tw.m.material.color); }
    }
    this.tweens = this.tweens.filter(t => t.t < 1);
  }

  /** Мгновенно завершить анимации (для тестов) */
  finishTweens() { this.frame(10); }

  bindControls() {
    for (const c of this.space.controls ?? []) {
      const el = this.$(`c-${c.id}`);
      if (c.kind === 'select') {
        el.addEventListener('change', () => this.apply(c.run(this.state, el.value)));
      } else if (c.kind === 'range') {
        el.addEventListener('input', () => {
          this.$(`c-${c.id}-v`).textContent = el.value;
          this.apply(c.run(this.state, Number(el.value)));
        });
      } else if (c.kind === 'auto') {
        // Кнопка-переключатель: повторяет run каждые interval мс, пока run не вернёт done
        el.addEventListener('click', () => {
          if (this.autoTimer) return this.stopAuto(c, el);
          el.textContent = c.stopLabel ?? '⏸ Пауза';
          this.autoTimer = setInterval(() => {
            const v = c.run(this.state);
            this.apply(v);
            if (!v || v.done) this.stopAuto(c, el);
          }, c.interval ?? 700);
        });
      } else {
        el.addEventListener('click', () => this.apply(c.run(this.state)));
      }
    }
  }

  stopAuto(c, el) {
    clearInterval(this.autoTimer);
    this.autoTimer = null;
    el.textContent = c.label;
  }
}
