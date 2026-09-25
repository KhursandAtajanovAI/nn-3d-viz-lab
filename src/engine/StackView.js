import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { PALETTE, signColor } from './palette.js';
import { kindInfo, formatShape, formatCount } from './stackKinds.js';
import { formatValue } from './format.js';

const GAP = 0.7;
const MAX_SPHERES = 12;
const COLOR_IDLE = new THREE.Color(PALETTE.neuronIdle);

function label(className, text) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return new CSS2DObject(el);
}

/** Цветовая карта для карт признаков: 0 → тёмный фон, дальше через оранжевый к светло-жёлтому */
function heat(v) {
  const t = Math.min(1, Math.max(0, v));
  const stops = [[10, 14, 23], [120, 50, 10], [255, 159, 28], [255, 240, 190]];
  const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), u = f - i;
  return stops[i].map((a, k) => a + (stops[i + 1][k] - a) * u);
}

/**
 * 3D-вид «стопки слоёв» — для свёрточных сетей и любых архитектур из блоков.
 * Слой: { name, kind, shape: [h, w, c] | [seq, d] | [n], maps?: boolean, slices?: number, repeat?: number }
 */
export class StackView {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.resolution = new THREE.Vector2(1, 1);
    this.sphereGeo = new THREE.SphereGeometry(0.13, 20, 12);
    this.showNumbers = false;
  }

  build(layers, { skips = [], groups = [], outputNames = [] } = {}) {
    this.dispose();
    this.layers = layers;
    const spatial = layers.filter(l => l.shape.length === 3).map(l => Math.max(l.shape[0], l.shape[1]));
    const maxPx = Math.max(1, ...spatial);
    const size = px => 0.4 + 2.2 * Math.sqrt(px / maxPx);

    // 1. Каждый слой строим в своей группе вокруг (0, 0, 0) и запоминаем его габариты
    this.items = layers.map((L, i) => {
      const item = { index: i, layer: L, obj: new THREE.Group(), color: new THREE.Color(kindInfo(L.kind).color), pick: [] };
      const form = L.shape.length === 3 ? 'volume' : L.shape.length === 2 ? 'sequence' : 'vector';
      item.form = form;
      if (form === 'volume') this.buildVolume(item, size);
      else if (form === 'sequence') this.buildBlock(item, 0.5, Math.min(L.shape[0], 10) * 0.28 + 0.2, 0.4 + 0.35 * Math.log2(L.shape[1] / 32 + 1));
      else this.buildVector(item, i === layers.length - 1 ? outputNames : []);
      return item;
    });

    // 2. Раскладываем слои вдоль оси X и центрируем
    let x = 0;
    for (const it of this.items) {
      it.x0 = x;
      x += it.w;
      it.x1 = x;
      // Между столбиками нейронов нужен больший зазор — иначе подписи наезжают
      const next = this.items[it.index + 1];
      x += GAP * (it.layer.gapAfter ?? (it.spheres || next?.spheres ? 2 : 1));
    }
    const total = x - GAP;
    for (const it of this.items) {
      it.x0 -= total / 2;
      it.x1 -= total / 2;
      it.cx = (it.x0 + it.x1) / 2;
      it.obj.position.x = it.cx;
      this.group.add(it.obj);
    }
    this.bounds = { width: total, height: Math.max(...this.items.map(i => i.h)), depth: Math.max(...this.items.map(i => i.d)) };

    this.buildLabels();
    this.buildConnections();
    this.buildSkips(skips);
    this.buildGroups(groups);
    this.reset();
  }

  // ---------- Слои ----------

  buildVolume(item, size) {
    const L = item.layer;
    const [h, w, c] = L.shape;
    const hs = size(h), ws = size(w);
    if (L.maps) {
      // Стопка «карт признаков», повёрнутых к зрителю; каждая — текстура одного канала
      const ns = Math.min(c, L.slices ?? 6), dx = 0.08, dz = 0.3;
      item.slices = [];
      const geo = new THREE.PlaneGeometry(ws, hs);
      const edges = new THREE.EdgesGeometry(geo);
      for (let k = ns - 1; k >= 0; k--) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x1a2130, side: THREE.DoubleSide, transparent: true, opacity: 0.96 });
        const plane = new THREE.Mesh(geo, mat);
        plane.position.set(-((ns - 1) * dx) / 2 + k * dx, 0, ((ns - 1) * dz) / 2 - k * dz);
        plane.userData = { layer: item.index, channel: k };
        const border = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: item.color, transparent: true, opacity: 0.8 }));
        plane.add(border);
        plane.userData.border = border;
        item.obj.add(plane);
        item.slices[k] = plane;
        item.pick.push(plane);
      }
      item.w = ws + (ns - 1) * dx;
      item.h = hs;
      item.d = (ns - 1) * dz + 0.05;
      item.hidden = c - ns;
    } else {
      this.buildBlock(item, 0.12 + 0.2 * Math.log2(c + 1), hs, ws);
    }
  }

  buildBlock(item, w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: item.color, emissive: item.color, emissiveIntensity: 0.08,
      transparent: true, opacity: 0.55, roughness: 0.6, depthWrite: false,
    });
    const box = new THREE.Mesh(geo, mat);
    box.userData = { layer: item.index };
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: item.color, transparent: true, opacity: 0.9 }));
    box.add(border);
    box.userData.border = border;
    item.obj.add(box);
    item.box = box;
    item.pick.push(box);
    Object.assign(item, { w, h, d });
    // Несколько одинаковых блоков подряд («×6») — рисуем «тени» позади
    if (item.layer.repeat > 1) {
      for (let k = 1; k <= Math.min(2, item.layer.repeat - 1); k++) {
        const ghost = new THREE.LineSegments(border.geometry, new THREE.LineBasicMaterial({ color: item.color, transparent: true, opacity: 0.35 / k }));
        ghost.position.set(0.12 * k, 0.12 * k, -0.12 * k);
        item.obj.add(ghost);
      }
    }
  }

  buildVector(item, names) {
    const n = item.layer.shape[0], ns = Math.min(n, MAX_SPHERES);
    const step = Math.min(0.36, 3.8 / ns);
    item.spheres = [];
    for (let k = 0; k < ns; k++) {
      const mat = new THREE.MeshStandardMaterial({
        color: COLOR_IDLE.clone(), emissive: COLOR_IDLE.clone(), emissiveIntensity: 0.15, roughness: 0.6,
      });
      const s = new THREE.Mesh(this.sphereGeo, mat);
      s.position.y = ((ns - 1) / 2 - k) * step;
      s.userData = { layer: item.index, neuron: k };
      item.obj.add(s);
      item.spheres.push(s);
      item.pick.push(s);
      if (names[k]) {
        const l = label('name-label right', names[k]);
        l.center.set(0, 0.5);
        l.position.set(0.22, s.position.y, 0);
        item.obj.add(l);
      }
      const v = label('value-label', '');
      v.center.set(1, 0.5);
      v.position.set(-0.2, s.position.y, 0);
      item.obj.add(v);
      s.userData.valueLabel = v;
    }
    if (n > ns) {
      const more = label('shape-label', `⋮ всего ${formatCount(n)}`);
      more.position.set(0, -((ns - 1) / 2) * step - 0.35, 0);
      item.obj.add(more);
    }
    item.w = 0.4;
    item.h = (ns - 1) * step + 0.3;
    item.d = 0.3;
  }

  buildLabels() {
    this.numberLabels = [];
    this.items.forEach((it, i) => {
      const L = it.layer;
      // Чередуем высоту подписей, чтобы соседние не наезжали друг на друга
      const lift = 0.45 + (this.items.length > 5 && i % 2 ? 0.5 : 0);
      const name = label('layer-label', `${L.name}${L.repeat > 1 ? ` ×${L.repeat}` : ''}`);
      name.position.set(it.cx, it.h / 2 + lift, 0);
      this.group.add(name);
      const params = ''; // число параметров — в таблице «Сцена» и в «Под курсором», чтобы подписи не наезжали
      const extra = it.hidden > 0 && L.kind !== 'input' ? ` (показано ${L.shape[2] - it.hidden})` : '';
      const shape = label('shape-label', `${formatShape(L.shape)}${extra}${params}`);
      shape.position.set(it.cx, -it.h / 2 - 0.35, 0);
      shape.visible = this.showNumbers;
      this.group.add(shape);
      this.numberLabels.push(shape);
    });
  }

  // ---------- Связи ----------

  /** Точки «выхода» слоя (правая грань) и «входа» (левая грань, сжатая — как рецептивное поле) */
  facePoints(it, side, shrink = 1) {
    if (it.spheres && shrink === 1) return it.spheres.map(s => new THREE.Vector3(side === 'right' ? it.cx : it.cx, s.position.y, 0));
    const x = side === 'right' ? it.x1 : it.x0;
    const hh = (it.h / 2) * shrink, hd = (it.d / 2) * shrink;
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => new THREE.Vector3(x, a * hh, b * hd));
  }

  buildConnections() {
    this.flows = [];
    for (let i = 0; i < this.items.length - 1; i++) {
      const a = this.items[i], b = this.items[i + 1];
      if (a.layer.noLink) { this.flows.push(null); continue; }
      const segs = [];
      if (a.spheres && b.spheres && a.spheres.length * b.spheres.length <= 150) {
        for (const p of this.facePoints(a, 'right')) for (const q of this.facePoints(b, 'left')) segs.push([p, q]);
      } else {
        const from = a.spheres ? [new THREE.Vector3(a.cx, a.h / 2, 0), new THREE.Vector3(a.cx, -a.h / 2, 0)] : this.facePoints(a, 'right', 1);
        const to = this.facePoints(b, 'left', b.spheres ? 1 : 0.35);
        if (b.spheres) {
          const top = new THREE.Vector3(b.cx, b.h / 2, 0), bottom = new THREE.Vector3(b.cx, -b.h / 2, 0);
          from.forEach(p => { segs.push([p, top]); segs.push([p, bottom]); });
        } else {
          from.forEach((p, k) => segs.push([p, to[k % to.length]]));
        }
      }
      const pos = segs.flatMap(([p, q]) => [p.x, p.y, p.z, q.x, q.y, q.z]);
      const geo = new LineSegmentsGeometry();
      geo.setPositions(pos);
      const mat = new LineMaterial({ color: PALETTE.neutral, linewidth: 1, transparent: true, opacity: 0.5, worldUnits: false, depthWrite: false });
      mat.resolution.copy(this.resolution);
      const lines = new LineSegments2(geo, mat);
      this.group.add(lines);

      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(segs.length * 3), 3));
      const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: PALETTE.pulse, size: 0.14, transparent: true, opacity: 0, depthWrite: false }));
      this.group.add(points);
      this.flows.push({ lines, points, segs, color: b.color });
    }
  }

  buildSkips(skips) {
    this.skipLines = [];
    for (const { from, to, label: text = '+' } of skips) {
      const a = this.items[from], b = this.items[to];
      if (!a || !b) continue;
      const top = Math.max(a.h, b.h) / 2 + 0.9 + 0.08 * (to - from);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(a.cx, a.h / 2 + 0.1, 0),
        new THREE.Vector3((a.cx + b.cx) / 2, top * 1.6, 0),
        new THREE.Vector3(b.cx, b.h / 2 + 0.1, 0),
      );
      const pts = curve.getPoints(24);
      const pos = [];
      for (let k = 0; k < pts.length - 1; k++) pos.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
      const geo = new LineSegmentsGeometry();
      geo.setPositions(pos);
      const mat = new LineMaterial({ color: PALETTE.negative, linewidth: 2, transparent: true, opacity: 0.85, worldUnits: false });
      mat.resolution.copy(this.resolution);
      const line = new LineSegments2(geo, mat);
      this.group.add(line);
      const l = label('skip-label', text);
      l.position.copy(curve.getPoint(0.5)).add(new THREE.Vector3(0, 0.15, 0));
      this.group.add(l);
      this.skipLines.push({ line, from, to });
    }
  }

  buildGroups(groups) {
    const bottom = -this.bounds.height / 2 - 0.9;
    groups.forEach(({ from, to, label: text, color = PALETTE.accent ?? 0xffd166 }, k) => {
      const a = this.items[from], b = this.items[to];
      if (!a || !b) return;
      const y = bottom - (k % 2) * 0.1;
      const x0 = a.x0 - 0.1, x1 = b.x1 + 0.1;
      const geo = new LineSegmentsGeometry();
      geo.setPositions([x0, y + 0.25, 0, x0, y, 0, x0, y, 0, x1, y, 0, x1, y, 0, x1, y + 0.25, 0]);
      const mat = new LineMaterial({ color, linewidth: 2, worldUnits: false, transparent: true, opacity: 0.9 });
      mat.resolution.copy(this.resolution);
      this.group.add(new LineSegments2(geo, mat));
      const l = label('group-label', text);
      l.position.set((x0 + x1) / 2, y - 0.3, 0);
      l.element.style.setProperty('--group-color', `#${new THREE.Color(color).getHexString()}`);
      this.group.add(l);
    });
  }

  // ---------- Состояние ----------

  setResolution(w, h) {
    this.resolution.set(w, h);
    this.group.traverse(o => o.material?.resolution?.set(w, h));
  }

  setShowNumbers(on) {
    this.showNumbers = on;
    this.numberLabels?.forEach(l => { l.visible = on; });
    this.items?.forEach(it => it.spheres?.forEach(s => { s.userData.valueLabel.visible = on && s.userData.value !== undefined; }));
  }

  reset() {
    this.items.forEach((it, i) => {
      this.setActive(i, 0);
      it.spheres?.forEach(s => {
        delete s.userData.value;
        this.paintSphere(s, 0, 0);
        s.userData.valueLabel.visible = false;
      });
    });
    this.flows.forEach((_, g) => this.setFlow(g, 0, 0));
  }

  /** Подсветка слоя целиком (amount 0..1) */
  setActive(i, amount) {
    const it = this.items[i];
    it.active = amount;
    if (it.box) {
      it.box.material.emissiveIntensity = 0.08 + amount * 0.9;
      it.box.material.opacity = 0.55 + amount * 0.3;
      it.box.userData.border.material.color.copy(it.color).lerp(new THREE.Color(0xffffff), amount * 0.5);
    }
    it.slices?.forEach(p => {
      // Вход (светлая картинка) не разгоняем выше 0.85 — иначе он «засвечивается» свечением
      const gain = it.layer.kind === 'input' ? 0.35 : 0.75;
      p.material.color.setScalar(p.material.map ? 0.5 + amount * gain : 0.35 + amount * 0.4);
      p.userData.border.material.opacity = 0.5 + amount * 0.5;
    });
  }

  /** Карты признаков слоя: maps — массив { w, h, data } по каналам, либо картинка { w, h, c, data } для входа */
  setMaps(i, maps) {
    const it = this.items[i];
    if (!it.slices) return;
    const isImage = !Array.isArray(maps);
    const list = isImage ? [maps] : maps;
    const max = isImage ? 1 : Math.max(1e-6, ...list.map(m => m.data.reduce((a, v) => Math.max(a, v), 0)));
    it.maps = list;
    it.mapMax = max;
    it.slices.forEach((plane, k) => {
      const m = list[k];
      if (!m) return;
      const rgba = new Uint8Array(m.w * m.h * 4);
      const n = m.w * m.h;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const src = y * m.w + x, dst = ((m.h - 1 - y) * m.w + x) * 4; // DataTexture хранит строки снизу вверх
        let rgb;
        if (isImage && m.c === 3) rgb = [m.data[src], m.data[n + src], m.data[2 * n + src]].map(v => v * 255);
        else if (isImage) rgb = [m.data[src] * 255, m.data[src] * 255, m.data[src] * 255];
        else rgb = heat(m.data[src] / max);
        rgba[dst] = rgb[0]; rgba[dst + 1] = rgb[1]; rgba[dst + 2] = rgb[2]; rgba[dst + 3] = 255;
      }
      plane.material.map?.dispose();
      const tex = new THREE.DataTexture(rgba, m.w, m.h, THREE.RGBAFormat);
      tex.magFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      plane.material.map = tex;
      plane.material.needsUpdate = true;
    });
    this.setActive(i, it.active ?? 0);
  }

  clearMaps() {
    this.items?.forEach(it => it.slices?.forEach(p => {
      p.material.map?.dispose();
      p.material.map = null;
      p.material.needsUpdate = true;
    }));
    this.items?.forEach(it => { it.maps = null; });
  }

  paintSphere(s, value, amount, maxAbs = 1) {
    const k = Math.min(1, Math.abs(value) / (maxAbs || 1)) * amount;
    const sign = signColor(value);
    s.material.color.copy(COLOR_IDLE).lerp(sign, Math.min(1, k * 1.5));
    s.material.emissive.copy(COLOR_IDLE).lerp(sign, Math.min(1, k * 3));
    s.material.emissiveIntensity = 0.15 + k * 1.6;
    s.scale.setScalar(1 + 0.35 * k);
  }

  /** Значения нейронов векторного слоя (показываются первые MAX_SPHERES) */
  setVector(i, values, amount = 1) {
    const it = this.items[i];
    if (!it.spheres) return;
    const maxAbs = Math.max(1e-6, ...values.map(Math.abs));
    it.vector = values;
    it.spheres.forEach((s, k) => {
      const v = values[k] ?? 0;
      s.userData.value = v * amount;
      this.paintSphere(s, v, amount, it.layer.kind === 'output' ? 1 : maxAbs);
      const l = s.userData.valueLabel;
      l.element.textContent = it.layer.kind === 'output' ? `${Math.round(v * amount * 100)}%` : formatValue(v * amount);
      l.visible = this.showNumbers;
    });
  }

  /** Поток сигнала между слоями g и g+1: t — положение импульсов, fade — яркость связей */
  setFlow(g, t, fade) {
    const f = this.flows[g];
    if (!f) return;
    const mat = f.lines.material;
    mat.linewidth = 1 + fade * 2;
    mat.opacity = 0.5 + fade * 0.5;
    mat.color.set(PALETTE.neutral).lerp(f.color, fade);
    if (fade > 0) mat.color.multiplyScalar(1 + fade * 0.8);
    const arr = f.points.geometry.attributes.position.array;
    f.segs.forEach(([a, b], k) => {
      arr[k * 3] = a.x + (b.x - a.x) * t;
      arr[k * 3 + 1] = a.y + (b.y - a.y) * t;
      arr[k * 3 + 2] = a.z + (b.z - a.z) * t;
    });
    f.points.geometry.attributes.position.needsUpdate = true;
    f.points.material.opacity = t > 0 && t < 1 ? fade : 0;
  }

  /** Поток по остаточной связи (подсвечивает дугу) */
  setSkip(k, fade) {
    const s = this.skipLines[k];
    if (!s) return;
    s.line.material.linewidth = 2 + fade * 2;
    s.line.material.color.set(PALETTE.negative).multiplyScalar(1 + fade);
  }

  highlight(i) {
    this.items?.forEach((it, k) => {
      const on = k === i;
      it.pick.forEach(m => {
        const b = m.userData.border;
        if (b) b.material.color.copy(on ? new THREE.Color(0xffffff) : it.color);
      });
    });
  }

  get pickables() { return this.items?.flatMap(it => it.pick) ?? []; }

  get size() {
    return new THREE.Vector3(this.bounds.width, this.bounds.height + 1.6, this.bounds.depth);
  }

  dispose() {
    this.group.traverse(o => {
      if (o.isCSS2DObject) o.element.remove();
      if (o.geometry && o.geometry !== this.sphereGeo) o.geometry.dispose();
      if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
    });
    this.group.clear();
  }
}
