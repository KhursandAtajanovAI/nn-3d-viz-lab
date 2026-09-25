import * as THREE from 'three';
import { BaseLab } from './BaseLab.js';
import { makeLabel, makeLines, setLineResolution, disposeTree } from './three-utils.js';
import { lineChartSvg } from './chart.js';
import { OPTIMIZERS, numGrad } from './models/optimizers.js';
import { escapeHtml, formatValue } from './format.js';

const SIZE = 8;      // сторона поверхности в мировых единицах
const HEIGHT = 3.2;  // высота рельефа
const RES = 90;      // сетка поверхности

/**
 * Поверхность ошибки и градиентный спуск (type: 'surface').
 * Конфиг: surfaces: [{ id, name, f(x, y), range: [x0, x1, y0, y1], start: [x, y], log?, lr, note }]
 */
export class SurfaceLab extends BaseLab {
  constructor(space, dom) {
    super(space, dom);
    const s = space;
    this.mount({
      controls: `
        <label for="surface">Поверхность ошибки</label>
        <select id="surface">${s.surfaces.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}</select>
        <label>Оптимизаторы</label>
        <div class="opt-list">${Object.entries(OPTIMIZERS).map(([id, o], i) => `
          <label class="check"><input type="checkbox" data-opt="${id}" ${i === 0 ? 'checked' : ''} />
            <span class="swatch" style="background:${o.color}"></span>${o.name}</label>`).join('')}</div>
        <label for="lr">Скорость обучения η: <b id="lr-v"></b></label>
        <input id="lr" type="range" min="-3" max="0" step="0.05" />
        <div class="row">
          <button id="play" class="primary">▶ Старт</button>
          <button id="step">Шаг</button>
          <button id="reset">Сброс</button>
        </div>
        <p class="small muted">Кликните по поверхности, чтобы поставить шарики в новую точку.</p>`,
      resultTitle: 'Ошибка (loss) по шагам',
      hoverHint: 'Наведите курсор на поверхность или шарик.',
      cards: [{ title: 'Как читать сцену', open: !(s.sections?.length), html: `
        <ul class="legend">
          <li><span class="dot" style="background:linear-gradient(90deg,#2f9bff,#ff9f1c)"></span><span><b>Поверхность</b> — значение ошибки L(w₁, w₂) для каждой пары весов: <b class="neg">синее</b> — ошибка мала, <b class="pos">оранжевое</b> — велика.</span></li>
          <li><span class="dot glow-pos"></span><span><b>Шарик</b> — текущие веса модели. На каждом шаге он сдвигается против градиента — «вниз по склону».</span></li>
          <li><span class="line thick"></span><span><b>След</b> — путь оптимизатора. Белая стрелка у шарика — направление −∇L.</span></li>
        </ul>` }],
      hint: 'Мышь: ЛКМ — вращать · колесо — масштаб · ПКМ — сдвиг. Пробел — старт/пауза.',
    });

    this.group = new THREE.Group();
    this.kit.scene.add(this.group);
    this.kit.onResize((w, h) => setLineResolution(this.group, w, h));
    this.playing = false;
    this.acc = 0;
    this.kit.onFrame(dt => this.frame(dt));
    this.enablePicking(() => [this.mesh, ...(this.balls ?? []).map(b => b.mesh)].filter(Boolean));
    this.onSceneClick = (ev, rc) => {
      const hit = rc.intersectObject(this.mesh, false)[0];
      if (hit) this.resetBalls(this.toParam(hit.point));
    };
    this.bindControls();
    this.loadSurface(s.surfaces[0].id);
  }

  get surf() { return this.space.surfaces.find(f => f.id === this.$('surface').value); }
  get lr() { return 10 ** Number(this.$('lr').value); }

  // Параметры (x, y) ↔ координаты сцены
  toScene(x, y, z) {
    const [x0, x1, y0, y1] = this.surf.range;
    return new THREE.Vector3(((x - x0) / (x1 - x0) - 0.5) * SIZE, this.heightOf(z), ((y - y0) / (y1 - y0) - 0.5) * SIZE);
  }
  toParam(v) {
    const [x0, x1, y0, y1] = this.surf.range;
    return [x0 + (v.x / SIZE + 0.5) * (x1 - x0), y0 + (v.z / SIZE + 0.5) * (y1 - y0)];
  }
  heightOf(z) {
    const t = this.surf.log ? Math.log1p(Math.max(0, z - this.zMin)) / Math.log1p(this.zMax - this.zMin) : (z - this.zMin) / (this.zMax - this.zMin);
    return Math.min(1.15, t) * HEIGHT;
  }

  loadSurface(id) {
    this.$('surface').value = id;
    const S = this.surf;
    this.$('lr').value = String(Math.log10(S.lr));
    this.$('lr-v').textContent = S.lr;
    disposeTree(this.group);

    // Диапазон высот
    const [x0, x1, y0, y1] = S.range;
    // Диапазон высот и глобальный минимум (поиском по сетке)
    let zMin = Infinity, zMax = -Infinity, argMin = null;
    for (let i = 0; i <= RES; i++) for (let j = 0; j <= RES; j++) {
      const x = x0 + (i / RES) * (x1 - x0), y = y0 + (j / RES) * (y1 - y0), z = S.f(x, y);
      if (z < zMin) { zMin = z; argMin = [x, y]; }
      if (z > zMax) zMax = z;
    }
    this.zMin = zMin;
    this.zMax = zMax;
    this.argMin = argMin;

    const geo = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = [];
    const lo = new THREE.Color('#1560c0'), mid = new THREE.Color('#5ad1b3'), hi = new THREE.Color('#ff9f1c');
    for (let k = 0; k < pos.count; k++) {
      const p = this.toParam(new THREE.Vector3(pos.getX(k), 0, pos.getZ(k)));
      const z = S.f(p[0], p[1]);
      const h = this.heightOf(z);
      pos.setY(k, h);
      const t = h / HEIGHT;
      const c = t < 0.5 ? lo.clone().lerp(mid, t * 2) : mid.clone().lerp(hi, (t - 0.5) * 2);
      colors.push(c.r * 0.8, c.g * 0.8, c.b * 0.8);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide, transparent: true, opacity: 0.93 }));
    this.mesh.userData.info = hit => this.pointInfo(hit);
    this.group.add(this.mesh);
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(SIZE, SIZE, 18, 18).rotateX(-Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: 0x0a0e17, transparent: true, opacity: 0.25 }));
    // Сетка «ложится» на рельеф
    const wp = wire.geometry.attributes.position;
    for (let k = 0; k < wp.count; k++) {
      const p = this.toParam(new THREE.Vector3(wp.getX(k), 0, wp.getZ(k)));
      wp.setY(k, this.heightOf(S.f(p[0], p[1])) + 0.01);
    }
    this.group.add(wire);

    // Глобальный минимум
    {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      m.rotation.x = Math.PI / 2;
      m.position.copy(this.toScene(argMin[0], argMin[1], zMin)).add(new THREE.Vector3(0, 0.05, 0));
      m.add(makeLabel('dim-label', 'глобальный минимум', { center: [0.5, 1.4] }));
      this.group.add(m);
    }
    // Подписи осей
    const lx = makeLabel('dim-label', 'вес w₁ →'); lx.position.set(0, -0.2, SIZE / 2 + 0.5); this.group.add(lx);
    const ly = makeLabel('dim-label', 'вес w₂ →'); ly.position.set(SIZE / 2 + 0.6, -0.2, 0); this.group.add(ly);
    const lz = makeLabel('dim-label', 'ошибка L ↑'); lz.position.set(-SIZE / 2 - 0.3, HEIGHT, -SIZE / 2); this.group.add(lz);

    this.setSceneInfo(`<p><b>${escapeHtml(S.name)}</b>: ${S.note}</p><p class="small muted">L(w₁, w₂) = ${S.formula}</p>`);
    const box = new THREE.Box3(new THREE.Vector3(-SIZE / 2, 0, -SIZE / 2), new THREE.Vector3(SIZE / 2, HEIGHT, SIZE / 2));
    this.kit.setAutoFrame(() => this.kit.fitBox(box, { dir: new THREE.Vector3(0.55, 0.85, 1), margin: 0.85 }));
    this.resetBalls(S.start);
  }

  resetBalls(start) {
    this.stop();
    (this.balls ?? []).forEach(b => { this.group.remove(b.mesh, b.trail, b.arrow); b.trail.geometry.dispose(); });
    this.start = start;
    const active = [...this.sidebar.querySelectorAll('[data-opt]')].filter(c => c.checked).map(c => c.dataset.opt);
    this.balls = active.map((id, k) => {
      const O = OPTIMIZERS[id];
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16),
        new THREE.MeshStandardMaterial({ color: O.color, emissive: O.color, emissiveIntensity: 1.2 }));
      const ball = { id, O, p: [start[0] + k * 1e-3, start[1]], state: O.init(), mesh, path: [], losses: [], steps: 0, diverged: false };
      mesh.userData.info = () => this.ballInfo(ball);
      ball.trail = makeLines([], { width: 3, color: O.color, opacity: 0.95 });
      ball.arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.8, 0xffffff, 0.2, 0.12);
      this.group.add(mesh, ball.trail, ball.arrow);
      this.placeBall(ball);
      return ball;
    });
    this.renderChart();
    this.setStatus(this.balls.length ? 'Нажмите «Старт» или «Шаг»' : 'Выберите хотя бы один оптимизатор', !this.balls.length);
  }

  placeBall(b) {
    const S = this.surf;
    const z = S.f(...b.p);
    const pos = this.toScene(b.p[0], b.p[1], z).add(new THREE.Vector3(0, 0.16, 0));
    b.mesh.position.copy(pos);
    b.path.push(pos.clone());
    b.losses.push(z);
    // След
    const segs = [];
    for (let i = 0; i < b.path.length - 1; i++) segs.push([b.path[i], b.path[i + 1]]);
    b.trail.geometry.dispose();
    const fresh = makeLines(segs, { width: 3, color: b.O.color, opacity: 0.95 });
    b.trail.geometry = fresh.geometry;
    setLineResolution(b.trail, this.kit.width, this.kit.height);
    // Стрелка антиградиента
    const g = numGrad(S.f, ...b.p);
    const ahead = this.toScene(b.p[0] - g[0] * 0.05, b.p[1] - g[1] * 0.05, z);
    const dir = new THREE.Vector3(ahead.x - pos.x, 0, ahead.z - pos.z);
    b.arrow.visible = dir.length() > 1e-4 && !b.diverged;
    if (b.arrow.visible) {
      b.arrow.position.copy(pos);
      b.arrow.setDirection(dir.normalize());
    }
  }

  stepAll() {
    const S = this.surf;
    const [x0, x1, y0, y1] = S.range;
    for (const b of this.balls) {
      if (b.diverged) continue;
      const g = numGrad(S.f, ...b.p);
      const next = b.O.step(b.p, g, b.state, { lr: this.lr, beta: 0.9 });
      b.lastStep = Math.hypot(next[0] - b.p[0], next[1] - b.p[1]);
      b.lastGrad = g;
      b.p = next;
      b.steps++;
      const out = next.some(v => !Number.isFinite(v)) || next[0] < x0 - (x1 - x0) || next[0] > x1 + (x1 - x0) || next[1] < y0 - (y1 - y0) || next[1] > y1 + (y1 - y0);
      if (out) { b.diverged = true; b.mesh.visible = false; b.arrow.visible = false; continue; }
      b.p = [Math.min(x1, Math.max(x0, next[0])), Math.min(y1, Math.max(y0, next[1]))];
      this.placeBall(b);
    }
    const txt = this.balls.map(b => `${b.O.name}: ${b.diverged ? 'разошёлся ✗' : `L = ${formatValue(b.losses.at(-1), 3)}`}`).join(' · ');
    this.setStatus(`Шаг ${this.balls[0]?.steps ?? 0}. ${txt}`);
    if (this.balls.every(b => b.diverged || b.lastStep < 1e-5)) this.stop();
  }

  renderChart() {
    const series = this.balls.map(b => ({ values: b.losses, color: b.O.color, label: b.O.name }));
    const div = this.balls.filter(b => b.diverged).map(b => b.O.name);
    this.setResult(`${lineChartSvg(series, { xLabel: 'шаг', yLabel: 'ошибка L', logY: this.surf.log })}
      ${div.length ? `<p class="small"><b class="bad">${div.join(', ')}: шаг слишком большой — ошибка растёт и оптимизатор «улетает».</b> Уменьшите η.</p>` : ''}
      <p class="small muted">Формулы шага: ${this.balls.map(b => `${b.O.name} — <code>${b.O.formula}</code>`).join('; ')}.</p>`);
  }

  frame(dt) {
    if (!this.playing) return;
    this.acc += dt;
    let did = false;
    while (this.acc > 1 / 14) {
      this.acc -= 1 / 14;
      this.stepAll();
      did = true;
      if (!this.playing) break;
    }
    if (did) {
      this.renderChart();
      if (this.hovered) this.refreshHover();
      if (this.balls[0]?.steps >= 400) this.stop();
    }
  }

  play() {
    if (!this.balls.length) return;
    this.playing = true;
    this.$('play').textContent = '⏸ Пауза';
  }

  stop() {
    this.playing = false;
    const btn = this.$('play');
    if (btn) btn.textContent = '▶ Старт';
  }

  pointInfo(hit) {
    if (!hit) return null;
    const [x, y] = this.toParam(hit.point);
    const S = this.surf;
    const z = S.f(x, y), g = numGrad(S.f, x, y);
    return {
      tooltip: `w = (${x.toFixed(2)}; ${y.toFixed(2)}) · L = ${formatValue(z, 3)}`,
      html: `<h3>Точка поверхности</h3>
        <p>Веса: <b class="num">w₁ = ${x.toFixed(3)}, w₂ = ${y.toFixed(3)}</b></p>
        <p>Ошибка: <b class="num">L = ${formatValue(z, 4)}</b></p>
        <p>Градиент: <b class="num">∇L = (${formatValue(g[0], 3)}; ${formatValue(g[1], 3)})</b>, крутизна |∇L| = ${Math.hypot(...g).toFixed(3)}</p>
        <p class="muted small">Градиент указывает, куда ошибка растёт быстрее всего. Спуск идёт в противоположную сторону. Кликните, чтобы начать отсюда.</p>`,
    };
  }

  ballInfo(b) {
    const g = b.lastGrad ?? numGrad(this.surf.f, ...b.p);
    return {
      tooltip: `${b.O.name}: шаг ${b.steps}, L = ${formatValue(b.losses.at(-1), 3)}`,
      html: `<h3>${escapeHtml(b.O.name)}</h3>
        <p>Шаг: <b>${b.steps}</b> · веса (${b.p.map(v => v.toFixed(3)).join('; ')})</p>
        <p>Ошибка: <b class="num">${formatValue(b.losses.at(-1), 4)}</b> (начальная ${formatValue(b.losses[0], 3)})</p>
        <p>Градиент: (${formatValue(g[0], 3)}; ${formatValue(g[1], 3)})${b.lastStep !== undefined ? ` · длина последнего шага ${b.lastStep.toFixed(4)}` : ''}</p>
        <p class="small muted"><code>${b.O.formula}</code>, η = ${this.lr.toPrecision(2)}</p>`,
    };
  }

  bindControls() {
    this.$('surface').addEventListener('change', e => this.loadSurface(e.target.value));
    this.$('lr').addEventListener('input', () => { this.$('lr-v').textContent = this.lr.toPrecision(2); });
    this.$('play').addEventListener('click', () => (this.playing ? this.stop() : this.play()));
    this.$('step').addEventListener('click', () => { this.stop(); this.stepAll(); this.renderChart(); this.refreshHover(); });
    this.$('reset').addEventListener('click', () => this.resetBalls(this.start ?? this.surf.start));
    this.sidebar.querySelectorAll('[data-opt]').forEach(c => c.addEventListener('change', () => this.resetBalls(this.start ?? this.surf.start)));
    this.onKey('Space', () => (this.playing ? this.stop() : this.play()));
  }
}
