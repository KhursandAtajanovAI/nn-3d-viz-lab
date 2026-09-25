import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { PALETTE, weightColor, signColor } from './palette.js';
import { formatValue, layerShortName } from './format.js';

const LAYER_GAP = 4;
const NEURON_GAP = 1.2;
const RADIUS = 0.28;

// Связи: в покое — тонкие и приглушённые, при прохождении сигнала — толстые и яркие.
// GAIN > 1 выводит цвет за порог bloom, и линия начинает светиться.
const LINE_REST = { width: 1, opacity: 0.45, gain: 0.55 };
const LINE_ACTIVE = { width: 3.5, opacity: 1, gain: 1.9 };

const COLOR_IDLE = new THREE.Color(PALETTE.neuronIdle);

function makeLabel(className, text = '') {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return new CSS2DObject(el);
}

// 3D-представление сети: сферы-нейроны и линии-связи, сгруппированные по слоям.
export class NetworkView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sphereGeo = new THREE.SphereGeometry(RADIUS, 32, 16);
    this.resolution = new THREE.Vector2(1, 1);
    this.showNumbers = false;
  }

  build(network) {
    this.dispose();
    this.network = network;
    const { layers } = network;

    // Большие слои раскладываем в сетку по Y/Z, чтобы сцена оставалась компактной
    this.positions = layers.map((count, l) => {
      const x = (l - (layers.length - 1) / 2) * LAYER_GAP;
      const cols = count > 8 ? Math.ceil(Math.sqrt(count)) : 1;
      const rows = Math.ceil(count / cols);
      return Array.from({ length: count }, (_, i) => {
        const r = i % rows, c = Math.floor(i / rows);
        return new THREE.Vector3(x, ((rows - 1) / 2 - r) * NEURON_GAP, (c - (cols - 1) / 2) * NEURON_GAP);
      });
    });

    this.valueLabels = new THREE.Group();
    this.valueLabels.visible = this.showNumbers;
    this.group.add(this.valueLabels);

    this.neurons = this.positions.map((layer, l) => layer.map((p, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: COLOR_IDLE.clone(), emissive: COLOR_IDLE.clone(), emissiveIntensity: 0.15,
        roughness: 0.6, metalness: 0,
      });
      const mesh = new THREE.Mesh(this.sphereGeo, mat);
      mesh.position.copy(p);
      mesh.userData = { layer: l, index: i };
      this.group.add(mesh);

      const label = makeLabel('value-label');
      label.position.copy(p).add(new THREE.Vector3(0, -RADIUS - 0.32, 0));
      this.valueLabels.add(label);
      mesh.userData.label = label;
      return mesh;
    }));

    // Подписи слоёв над каждым столбцом нейронов
    this.positions.forEach((layer, l) => {
      const top = Math.max(...layer.map(p => p.y));
      const label = makeLabel('layer-label', `${layerShortName(l, layers.length)} · ${layers[l]}`);
      label.position.set(layer[0].x, top + 0.9, 0);
      this.group.add(label);
    });

    // Одна LineSegments2 на каждый промежуток между слоями; цвет — знак и сила веса
    this.connections = [];
    this.pulses = [];
    for (let l = 0; l < layers.length - 1; l++) {
      const pos = [], cols = [], ends = [], pairs = [];
      const W = network.weights[l];
      const maxW = Math.max(...W.flat().map(Math.abs)) || 1;
      const c = new THREE.Color();
      W.forEach((row, j) => row.forEach((w, i) => {
        const a = this.positions[l][i], b = this.positions[l + 1][j];
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        weightColor(w, maxW, c);
        cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
        ends.push([a, b]);
        pairs.push([i, j]);
      }));
      const geo = new LineSegmentsGeometry();
      geo.setPositions(pos);
      geo.setColors(cols);
      const mat = new LineMaterial({
        vertexColors: true, transparent: true, depthWrite: false, worldUnits: false,
      });
      mat.resolution.copy(this.resolution);
      const lines = new LineSegments2(geo, mat);
      lines.userData = { gap: l, pairs };
      this.group.add(lines);
      this.connections.push(lines);

      // «Импульсы» — точки, бегущие по связям во время forward-pass
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ends.length * 3), 3));
      const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
        color: PALETTE.pulse, size: 0.14, transparent: true, opacity: 0, depthWrite: false,
      }));
      points.userData.ends = ends;
      this.group.add(points);
      this.pulses.push(points);
    }

    // Подсветка при наведении: связи выбранного нейрона/линии, ореолы и подписи весов
    this.highlight = new THREE.Group();
    this.group.add(this.highlight);

    this.reset();
  }

  setResolution(w, h) {
    this.resolution.set(w, h);
    this.connections?.forEach(c => c.material.resolution.set(w, h));
    this.highlight?.traverse(o => o.material?.resolution?.set(w, h));
  }

  setShowNumbers(on) {
    this.showNumbers = on;
    if (this.valueLabels) this.valueLabels.visible = on;
    if (this.hover) this.setHover(this.hover);
  }

  reset() {
    this.values = this.network.layers.map(n => Array(n).fill(null));
    this.neurons.forEach((layer, l) => layer.forEach((_, i) => this.setNeuron(l, i, 0, 0)));
    // Значения ещё не вычислены — показываем прочерк, а не 0
    this.values = this.network.layers.map(n => Array(n).fill(null));
    this.neurons.flat().forEach(m => { m.userData.label.element.textContent = '—'; });
    this.connections.forEach((_, l) => this.setConnections(l, 0, 0));
  }

  /** Подсветить нейрон с учётом величины активации (amount 0..1 — прогресс анимации) */
  setNeuron(l, i, activation, amount) {
    const m = this.neurons[l][i];
    const k = Math.min(1, Math.abs(activation)) * amount;
    const sign = signColor(activation);
    m.material.color.copy(COLOR_IDLE).lerp(sign, Math.min(1, k * 1.5));
    m.material.emissive.copy(COLOR_IDLE).lerp(sign, Math.min(1, k * 3));
    // Сила свечения растёт с активацией: всё, что выше порога bloom, начинает светиться
    m.material.emissiveIntensity = 0.15 + k * 1.6;
    m.scale.setScalar(1 + 0.3 * k);

    const shown = activation * amount;
    this.values[l][i] = shown;
    const el = m.userData.label.element;
    el.textContent = formatValue(shown);
    el.classList.toggle('pos', k > 0.05 && shown > 0);
    el.classList.toggle('neg', k > 0.05 && shown < 0);
  }

  /** Анимация связей между слоями l и l+1: t 0..1 — позиция импульса, fade — насколько связь «активна» */
  setConnections(l, t, fade = 1) {
    const mat = this.connections[l].material;
    mat.linewidth = LINE_REST.width + (LINE_ACTIVE.width - LINE_REST.width) * fade;
    mat.opacity = LINE_REST.opacity + (LINE_ACTIVE.opacity - LINE_REST.opacity) * fade;
    mat.color.setScalar(LINE_REST.gain + (LINE_ACTIVE.gain - LINE_REST.gain) * fade);

    const p = this.pulses[l];
    const arr = p.geometry.attributes.position.array;
    p.userData.ends.forEach(([a, b], k) => {
      arr[k * 3] = a.x + (b.x - a.x) * t;
      arr[k * 3 + 1] = a.y + (b.y - a.y) * t;
      arr[k * 3 + 2] = a.z + (b.z - a.z) * t;
    });
    p.geometry.attributes.position.needsUpdate = true;
    p.material.opacity = t > 0 && t < 1 ? fade : 0;
  }

  /** Связь по индексу сегмента в LineSegments2 */
  connectionAt(gap, segment) {
    const [i, j] = this.connections[gap].userData.pairs[segment];
    return { gap, from: i, to: j, weight: this.network.weights[gap][j][i] };
  }

  /**
   * Подсветка наведённого объекта.
   * hover: { type: 'neuron', layer, index } | { type: 'weight', gap, from, to } | null
   */
  setHover(hover) {
    this.hover = hover;
    this.highlight.traverse(o => {
      if (o.isCSS2DObject) o.element.remove();
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.highlight.clear();
    if (!hover) return;

    const W = this.network.weights;
    const { layers } = this.network;
    const MAX_LABELS = 12; // в больших слоях подписываем только самые сильные связи
    const byStrength = (a, b) => Math.abs(W[b[0]][b[2]][b[1]]) - Math.abs(W[a[0]][a[2]][a[1]]);
    const range = n => [...Array(n).keys()];

    const links = []; // [gap, from, to, подписывать?]
    const halos = [];
    if (hover.type === 'neuron') {
      const { layer: l, index: n } = hover;
      halos.push(this.positions[l][n]);
      const sides = [];
      if (l > 0) sides.push(range(layers[l - 1]).map(i => [l - 1, i, n]));
      if (l < layers.length - 1) sides.push(range(layers[l + 1]).map(j => [l, n, j]));
      for (const side of sides) {
        side.sort(byStrength).forEach((link, k) => links.push([...link, k < MAX_LABELS]));
      }
    } else {
      const { gap, from, to } = hover;
      links.push([gap, from, to, true]);
      halos.push(this.positions[gap][from], this.positions[gap + 1][to]);
    }

    if (links.length) {
      const pos = [], cols = [];
      const c = new THREE.Color();
      for (const [g, i, j, labeled] of links) {
        const a = this.positions[g][i], b = this.positions[g + 1][j];
        const w = W[g][j][i];
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        weightColor(w, Math.max(...W[g].flat().map(Math.abs)), c);
        cols.push(c.r, c.g, c.b, c.r, c.g, c.b);

        if (this.showNumbers && labeled) {
          // Подпись ставим ближе к «веерному» концу, где линии расходятся и не накладываются
          const t = hover.type === 'weight' ? 0.5 : g === hover.layer ? 0.7 : 0.3;
          const label = makeLabel(`weight-label ${w >= 0 ? 'pos' : 'neg'}`, formatValue(w));
          label.position.lerpVectors(a, b, t);
          this.highlight.add(label);
        }
      }
      const geo = new LineSegmentsGeometry();
      geo.setPositions(pos);
      geo.setColors(cols);
      const mat = new LineMaterial({ vertexColors: true, linewidth: 3, worldUnits: false, depthTest: false, transparent: true });
      mat.color.setScalar(1.6);
      mat.resolution.copy(this.resolution);
      const lines = new LineSegments2(geo, mat);
      lines.renderOrder = 10;
      this.highlight.add(lines);
    }

    for (const p of halos) {
      const halo = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({
        color: PALETTE.hover, transparent: true, opacity: 0.18, depthWrite: false,
      }));
      halo.position.copy(p);
      halo.scale.setScalar(1.8);
      this.highlight.add(halo);
    }
  }

  get pickables() {
    return { neurons: this.neurons.flat(), connections: this.connections };
  }

  get size() {
    const box = new THREE.Box3();
    this.positions.flat().forEach(p => box.expandByPoint(p));
    box.expandByScalar(RADIUS * 2);
    return box.getSize(new THREE.Vector3());
  }

  dispose() {
    this.group.traverse(o => {
      if (o.isCSS2DObject) o.element.remove();
      if (o.geometry && o.geometry !== this.sphereGeo) o.geometry.dispose();
      o.material?.dispose();
    });
    this.group.clear();
    this.hover = null;
  }
}
