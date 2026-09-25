// Мелкие общие помощники для 3D-визуализаторов: подписи, толстые линии, кривые, цвета значений.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { PALETTE, signColor } from './palette.js';

export function makeLabel(className, text = '', { center } = {}) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  if (center) obj.center.set(...center);
  return obj;
}

/**
 * Толстые линии (ширина в пикселях). segments: [[Vector3, Vector3, color?], …]
 * Все материалы LineMaterial нужно обновлять при изменении размера — см. setLineResolution.
 */
export function makeLines(segments, { width = 1.5, color = PALETTE.neutral, opacity = 0.8, depthTest = true } = {}) {
  const pos = [], cols = [];
  const c = new THREE.Color();
  const perVertex = segments.some(s => s[2] !== undefined);
  for (const [p, q, col] of segments) {
    pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
    if (perVertex) { c.set(col ?? color); cols.push(c.r, c.g, c.b, c.r, c.g, c.b); }
  }
  const geo = new LineSegmentsGeometry();
  geo.setPositions(pos.length ? pos : [0, 0, 0, 0, 0, 0]);
  if (perVertex && cols.length) geo.setColors(cols);
  const mat = new LineMaterial({
    color: perVertex ? 0xffffff : color, vertexColors: perVertex, linewidth: width,
    transparent: true, opacity, worldUnits: false, depthWrite: false, depthTest,
  });
  mat.resolution.set(innerWidth, innerHeight);
  return new LineSegments2(geo, mat);
}

/** Точки кривой как отрезки для makeLines */
export function curveSegments(curve, n = 24, color) {
  const pts = curve.getPoints(n);
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1], color]);
  return segs;
}

export function setLineResolution(root, w, h) {
  root.traverse(o => o.material?.resolution?.set(w, h));
}

/** Материал «нейрона/ячейки» и окраска по значению: серый → тёплый (+) / холодный (−), яркость ∝ |v| */
const IDLE = new THREE.Color(PALETTE.neuronIdle);
export function valueMaterial() {
  return new THREE.MeshStandardMaterial({ color: IDLE.clone(), emissive: IDLE.clone(), emissiveIntensity: 0.15, roughness: 0.6 });
}
export function paintValue(mesh, value, amount = 1, maxAbs = 1, { scale = true } = {}) {
  const k = Math.min(1, Math.abs(value) / (maxAbs || 1)) * amount;
  const s = signColor(value);
  mesh.material.color.copy(IDLE).lerp(s, Math.min(1, k * 1.5));
  mesh.material.emissive.copy(IDLE).lerp(s, Math.min(1, k * 3));
  mesh.material.emissiveIntensity = 0.15 + k * 1.5;
  if (scale) mesh.scale.setScalar(1 + 0.3 * k);
}

/** Категориальная палитра для групп/кластеров */
export const GROUP_COLORS = ['#ff9f1c', '#2f9bff', '#7ee081', '#c9a7ff', '#ff6fa3', '#ffd166', '#5ad1b3', '#ff6b6b', '#9fb4ff', '#e0a060'];

export function disposeTree(root) {
  root.traverse(o => {
    if (o.isCSS2DObject) o.element.remove();
    o.geometry?.dispose();
    if (o.material) { o.material.map?.dispose(); o.material.dispose?.(); }
  });
  root.clear();
}
