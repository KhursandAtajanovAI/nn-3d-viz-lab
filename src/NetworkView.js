import * as THREE from 'three';

const LAYER_GAP = 4;
const NEURON_GAP = 1.2;
const RADIUS = 0.28;

const COLOR_IDLE = new THREE.Color(0x30363d);
const COLOR_ACTIVE = new THREE.Color(0xffd166);
const COLOR_NEG = new THREE.Color(0x58a6ff);
const COLOR_POS = new THREE.Color(0xf78166);

// 3D-представление сети: сферы-нейроны и линии-связи, сгруппированные по слоям.
export class NetworkView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sphereGeo = new THREE.SphereGeometry(RADIUS, 32, 16);
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

    this.neurons = this.positions.map(layer => layer.map(p => {
      const mat = new THREE.MeshStandardMaterial({
        color: COLOR_IDLE.clone(), emissive: COLOR_ACTIVE.clone(), emissiveIntensity: 0,
        roughness: 0.4, metalness: 0.1,
      });
      const mesh = new THREE.Mesh(this.sphereGeo, mat);
      mesh.position.copy(p);
      this.group.add(mesh);
      return mesh;
    }));

    // Одна LineSegments на каждый промежуток между слоями; цвет — знак веса, яркость — |w|
    this.connections = [];
    this.pulses = [];
    for (let l = 0; l < layers.length - 1; l++) {
      const pts = [], cols = [], ends = [];
      const W = network.weights[l];
      const maxW = Math.max(...W.flat().map(Math.abs)) || 1;
      W.forEach((row, j) => row.forEach((w, i) => {
        const a = this.positions[l][i], b = this.positions[l + 1][j];
        pts.push(a, b);
        ends.push([a, b]);
        const c = (w >= 0 ? COLOR_POS : COLOR_NEG).clone().multiplyScalar(0.25 + 0.75 * Math.abs(w) / maxW);
        cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.25,
      }));
      this.group.add(lines);
      this.connections.push(lines);

      // «Импульсы» — точки, бегущие по связям во время forward-pass
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ends.length * 3), 3));
      const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
        color: COLOR_ACTIVE, size: 0.12, transparent: true, opacity: 0, depthWrite: false,
      }));
      points.userData.ends = ends;
      this.group.add(points);
      this.pulses.push(points);
    }
    this.reset();
  }

  reset() {
    this.neurons?.flat().forEach(m => {
      m.material.color.copy(COLOR_IDLE);
      m.material.emissiveIntensity = 0;
      m.scale.setScalar(1);
    });
    this.connections?.forEach(c => { c.material.opacity = 0.25; });
    this.pulses?.forEach(p => { p.material.opacity = 0; });
  }

  /** Подсветить нейрон с учётом величины активации (amount 0..1 — прогресс анимации) */
  setNeuron(l, i, activation, amount) {
    const m = this.neurons[l][i];
    const a = Math.min(1, Math.abs(activation));
    m.material.color.copy(COLOR_IDLE).lerp(COLOR_ACTIVE, a * amount);
    m.material.emissiveIntensity = a * amount * 0.9;
    m.scale.setScalar(1 + 0.35 * a * amount);
  }

  /** Анимация связей между слоями l и l+1: t 0..1 — позиция импульса, fade — затухание */
  setConnections(l, t, fade = 1) {
    this.connections[l].material.opacity = 0.25 + 0.6 * fade;
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

  get size() {
    const box = new THREE.Box3().setFromObject(this.group);
    return box.getSize(new THREE.Vector3());
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry && o.geometry !== this.sphereGeo) o.geometry.dispose();
      o.material?.dispose();
    });
    this.group.clear();
  }
}
