import * as THREE from 'three';
import { BaseLab, MODE_TOGGLE_HTML, bindModeToggle } from './BaseLab.js';
import { makeLabel, makeLines, setLineResolution, paintValue, valueMaterial } from './three-utils.js';
import { lineChartSvg } from './chart.js';
import { seededRandom } from './models/mlp.js';
import { formatValue } from './format.js';

const ACTIONS = [
  { name: 'вверх', dr: -1, dc: 0, arrow: '↑' },
  { name: 'вправо', dr: 0, dc: 1, arrow: '→' },
  { name: 'вниз', dr: 1, dc: 0, arrow: '↓' },
  { name: 'влево', dr: 0, dc: -1, arrow: '←' },
];

/**
 * Обучение с подкреплением в клетчатом мире (type: 'gridworld'), алгоритм Q-learning.
 * Конфиг: map: ['S..#G', …] (S — старт, G — цель, X — яма, # — стена), rewards: { goal, pit, step }, params: { alpha, gamma, epsilon }
 */
export class GridLab extends BaseLab {
  constructor(space, dom) {
    super(space, dom);
    const s = space;
    const P = s.params ?? {};
    const slider = (id, label, v, min, max, step) => `<label for="${id}">${label}: <b id="${id}-v">${v}</b></label>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" />`;
    this.mount({
      controls: `
        <div class="row">
          <button id="step">Шаг агента</button>
          <button id="play" class="primary">▶ Авто</button>
        </div>
        <div class="row">
          <button id="fast">+100 эпизодов быстро</button>
          <button id="best">Показать лучший путь</button>
        </div>
        ${slider('epsilon', 'ε — доля случайных ходов (исследование)', P.epsilon ?? 0.2, 0, 1, 0.05)}
        ${slider('alpha', 'α — скорость обучения', P.alpha ?? 0.5, 0.05, 1, 0.05)}
        ${slider('gamma', 'γ — важность будущих наград', P.gamma ?? 0.9, 0, 0.99, 0.01)}
        <button id="reset" style="width:100%;margin-top:8px">Сбросить знания агента</button>
        ${MODE_TOGGLE_HTML}`,
      resultTitle: 'Обучение агента',
      hoverHint: 'Наведите курсор на клетку, чтобы увидеть Q-значения её действий.',
      cards: [{ title: 'Как читать сцену', open: !(s.sections?.length), html: `
        <ul class="legend">
          <li><span class="dot" style="background:#2f9bff;box-shadow:0 0 8px #2f9bff"></span><span><b>Синий шар — агент.</b> Он ходит по клеткам и получает награды.</span></li>
          <li><span class="dot" style="background:#ffd166"></span><span><b>Золотая клетка — цель</b> (+${s.rewards.goal}), <b class="bad">красные — ямы</b> (${s.rewards.pit}), серые блоки — стены. Каждый шаг стоит ${s.rewards.step}.</span></li>
          <li><span class="dot glow-pos"></span><span><b>Стрелки в клетке</b> — четыре действия. Цвет — Q-значение: <b class="pos">тёплый</b> — действие ведёт к награде, <b class="neg">холодный</b> — к штрафу. Самая большая стрелка — лучшее действие.</span></li>
        </ul>` }],
      hint: 'Мышь: ЛКМ — вращать · колесо — масштаб · ПКМ — сдвиг. Пробел — авто, N — Q-значения.',
    });

    this.parse();
    this.group = new THREE.Group();
    this.kit.scene.add(this.group);
    this.build();
    this.kit.onResize((w, h) => setLineResolution(this.group, w, h));
    this.kit.onFrame(dt => this.frame(dt));
    this.enablePicking(() => this.tiles.flat().filter(Boolean));
    bindModeToggle(this, on => { this.showNumbers = on; this.refreshQ(); });
    this.bindControls();
    this.reset();
  }

  parse() {
    this.map = this.space.map.map(r => r.replace(/\s+/g, '').split(''));
    this.R = this.map.length;
    this.C = this.map[0].length;
    this.map.forEach((row, r) => row.forEach((ch, c) => { if (ch === 'S') this.startCell = [r, c]; }));
  }

  cellType(r, c) { return this.map[r]?.[c] ?? '#'; }
  isTerminal(r, c) { return 'GX'.includes(this.cellType(r, c)); }
  pos(r, c, y = 0) { return new THREE.Vector3(c - (this.C - 1) / 2, y, r - (this.R - 1) / 2); }

  build() {
    this.tiles = [];
    this.arrows = [];
    const coneGeo = new THREE.ConeGeometry(0.09, 0.28, 12);
    for (let r = 0; r < this.R; r++) {
      this.tiles[r] = [];
      this.arrows[r] = [];
      for (let c = 0; c < this.C; c++) {
        const t = this.cellType(r, c);
        const wall = t === '#';
        const color = { G: 0xffd166, X: 0xff4d4d, '#': 0x4a5264 }[t] ?? 0x1b2436;
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.94, wall ? 0.8 : 0.1, 0.94),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: t === 'G' ? 0.9 : t === 'X' ? 0.5 : 0.05, roughness: 0.7 }));
        tile.position.copy(this.pos(r, c, wall ? 0.4 : 0));
        tile.userData.info = () => this.cellInfo(r, c);
        this.group.add(tile);
        this.tiles[r][c] = tile;
        const tag = (cls, text, x, y, z) => { const l = makeLabel(cls, text); l.position.set(x, y, z); tile.add(l); };
        if (t === 'G') tag('name-label', `цель +${this.space.rewards.goal}`, 0, 0.35, 0);
        if (t === 'X') tag('name-label', `яма ${this.space.rewards.pit}`, 0, 0.35, 0);
        if (t === 'S') tag('dim-label', 'старт', 0, -0.25, 0.42);
        if (wall || this.isTerminal(r, c)) continue;
        this.arrows[r][c] = ACTIONS.map(a => {
          const m = new THREE.Mesh(coneGeo, valueMaterial());
          m.position.copy(this.pos(r, c, 0.14)).add(new THREE.Vector3(a.dc * 0.28, 0, a.dr * 0.28));
          m.rotation.set(a.dr ? Math.PI / 2 * a.dr : 0, 0, a.dc ? -Math.PI / 2 * a.dc : 0);
          this.group.add(m);
          return m;
        });
        const lab = makeLabel('value-label', '');
        lab.position.copy(this.pos(r, c, 0.2));
        lab.visible = false;
        this.group.add(lab);
        this.arrows[r][c].label = lab;
      }
    }
    this.agent = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), new THREE.MeshStandardMaterial({ color: 0x2f9bff, emissive: 0x2f9bff, emissiveIntensity: 1.1 }));
    this.group.add(this.agent);
    const box = new THREE.Box3().setFromObject(this.group);
    this.kit.setAutoFrame(() => this.kit.fitBox(box, { dir: new THREE.Vector3(0, 1.3, 1), margin: 0.85 }));
  }

  reset() {
    this.rnd = seededRandom(5);
    this.Q = Array.from({ length: this.R }, () => Array.from({ length: this.C }, () => [0, 0, 0, 0]));
    this.visits = Array.from({ length: this.R }, () => new Array(this.C).fill(0));
    this.rewards = [];
    this.stepsHist = [];
    this.episode = 0;
    this.lastUpdate = null;
    this.bestPath?.removeFromParent();
    this.startEpisode();
    this.refreshQ();
    this.render();
    this.setStatus('Агент ничего не знает: все Q = 0. Нажмите «Авто» или «Шаг агента».');
  }

  startEpisode() {
    this.cell = [...this.startCell];
    this.epReward = 0;
    this.epSteps = 0;
    this.agent.position.copy(this.pos(...this.cell, 0.3));
    this.agentTarget = this.agent.position.clone();
  }

  get params() {
    return { eps: Number(this.$('epsilon').value), alpha: Number(this.$('alpha').value), gamma: Number(this.$('gamma').value) };
  }

  chooseAction([r, c], eps) {
    if (this.rnd() < eps) return Math.floor(this.rnd() * 4);
    const q = this.Q[r][c], m = Math.max(...q);
    const best = q.map((v, i) => [v, i]).filter(([v]) => v === m);
    return best[Math.floor(this.rnd() * best.length)][1];
  }

  /** Один шаг Q-learning; возвращает true, если эпизод закончился */
  step(animate = true) {
    const { eps, alpha, gamma } = this.params;
    const [r, c] = this.cell;
    const a = this.chooseAction(this.cell, eps);
    let nr = r + ACTIONS[a].dr, nc = c + ACTIONS[a].dc;
    if (this.cellType(nr, nc) === '#') { nr = r; nc = c; } // в стену — остаёмся на месте
    const t = this.cellType(nr, nc);
    const reward = t === 'G' ? this.space.rewards.goal : t === 'X' ? this.space.rewards.pit : this.space.rewards.step;
    const terminal = t === 'G' || t === 'X';
    const maxNext = terminal ? 0 : Math.max(...this.Q[nr][nc]);
    const old = this.Q[r][c][a];
    const target = reward + gamma * maxNext;
    this.Q[r][c][a] = old + alpha * (target - old);
    this.lastUpdate = { r, c, a, old, reward, maxNext, target, value: this.Q[r][c][a], alpha, gamma };
    this.visits[r][c]++;
    this.cell = [nr, nc];
    this.epReward += reward;
    this.epSteps++;
    if (animate) this.agentTarget = this.pos(nr, nc, 0.3);
    const done = terminal || this.epSteps >= 80;
    if (done) {
      this.rewards.push(this.epReward);
      this.stepsHist.push(this.epSteps);
      this.episode++;
      this.lastEnd = t === 'G' ? 'дошёл до цели' : t === 'X' ? 'упал в яму' : 'не успел за 80 шагов';
      if (animate) this.pendingRestart = true;
      else this.startEpisode();
    }
    return done;
  }

  refreshQ() {
    const all = this.Q.flat(2).map(Math.abs);
    const maxAbs = Math.max(0.05, ...all);
    for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
      const arr = this.arrows[r][c];
      if (!arr) continue;
      const q = this.Q[r][c], best = Math.max(...q);
      arr.forEach((m, i) => {
        paintValue(m, q[i], 1, maxAbs, { scale: false });
        m.scale.setScalar(q[i] === best && best !== 0 ? 1.7 : 1);
      });
      arr.label.visible = !!this.showNumbers;
      arr.label.element.textContent = formatValue(best, 2);
    }
  }

  render() {
    const avg = this.rewards.map((_, i) => {
      const w = this.rewards.slice(Math.max(0, i - 9), i + 1);
      return w.reduce((a, b) => a + b, 0) / w.length;
    });
    const u = this.lastUpdate;
    this.setResult(`
      <p>Эпизод <b>${this.episode + 1}</b>, шаг ${this.epSteps} · награда за эпизод ${formatValue(this.epReward, 2)}
        ${this.lastEnd ? `<br /><span class="muted small">Прошлый эпизод: агент ${this.lastEnd}.</span>` : ''}</p>
      ${u ? `<p class="small">Последнее обновление в клетке (${u.r + 1}, ${u.c + 1}), действие «${ACTIONS[u.a].name}»:<br />
        Q ← ${formatValue(u.old, 3)} + ${u.alpha} · (${formatValue(u.reward, 2)} + ${u.gamma} · ${formatValue(u.maxNext, 3)} − ${formatValue(u.old, 3)}) = <b class="num">${formatValue(u.value, 3)}</b></p>` : ''}
      <p class="list-title">Награда за эпизод (линия — среднее за 10)</p>
      ${lineChartSvg([{ values: this.rewards, color: 'rgba(149,163,186,.6)' }, { values: avg, color: '#ffd166' }], { xLabel: 'эпизод', yLabel: 'награда' })}
      <p class="list-title">Шагов до конца эпизода</p>
      ${lineChartSvg([{ values: this.stepsHist, color: '#2f9bff' }], { xLabel: 'эпизод', yLabel: 'шаги', height: 110 })}`);
    if (this.hovered) this.refreshHover();
  }

  cellInfo(r, c) {
    const t = this.cellType(r, c);
    if (t === '#') return { tooltip: 'Стена', html: '<h3>Стена</h3><p>Сюда нельзя пройти: агент остаётся на месте и получает штраф за шаг.</p>' };
    if (t === 'G') return { tooltip: 'Цель', html: `<h3>Цель</h3><p>Награда <b class="pos">+${this.space.rewards.goal}</b>, эпизод заканчивается.</p>` };
    if (t === 'X') return { tooltip: 'Яма', html: `<h3>Яма</h3><p>Штраф <b class="neg">${this.space.rewards.pit}</b>, эпизод заканчивается.</p>` };
    const q = this.Q[r][c], best = Math.max(...q);
    return {
      tooltip: `Клетка (${r + 1}, ${c + 1}) · лучшее: ${ACTIONS[q.indexOf(best)].arrow} ${formatValue(best, 2)}`,
      html: `<h3>Клетка (${r + 1}, ${c + 1})</h3>
        <table class="arch-table"><tbody>${ACTIONS.map((a, i) => `<tr><td>${a.arrow} ${a.name}</td><td class="num ${q[i] > 0 ? 'pos' : q[i] < 0 ? 'neg' : 'muted'}">${formatValue(q[i], 3)}</td><td>${q[i] === best && best !== 0 ? '<b>лучшее</b>' : ''}</td></tr>`).join('')}</tbody></table>
        <p class="small muted">Q(s, a) — ожидаемая суммарная награда, если сделать это действие и дальше действовать наилучшим образом. Агент был здесь ${this.visits[r][c]} раз.</p>`,
    };
  }

  showBestPath() {
    this.bestPath?.removeFromParent();
    let cell = [...this.startCell];
    const pts = [this.pos(...cell, 0.35)];
    const seen = new Set();
    for (let k = 0; k < 60 && !this.isTerminal(...cell); k++) {
      const key = cell.join(',');
      if (seen.has(key)) break;
      seen.add(key);
      const q = this.Q[cell[0]][cell[1]];
      const a = q.indexOf(Math.max(...q));
      const nr = cell[0] + ACTIONS[a].dr, nc = cell[1] + ACTIONS[a].dc;
      if (this.cellType(nr, nc) === '#') break;
      cell = [nr, nc];
      pts.push(this.pos(...cell, 0.35));
    }
    const segs = pts.slice(0, -1).map((p, i) => [p, pts[i + 1]]);
    this.bestPath = makeLines(segs, { width: 5, color: '#7ee081', opacity: 1 });
    setLineResolution(this.bestPath, this.kit.width, this.kit.height);
    this.group.add(this.bestPath);
    const reached = this.cellType(...cell) === 'G';
    this.setStatus(reached ? `Лучший путь (по максимуму Q) доходит до цели за ${segs.length} шагов` : 'Агент пока не знает пути до цели — обучите его дольше');
  }

  frame(dt) {
    // Плавное движение агента
    this.agent.position.lerp(this.agentTarget, Math.min(1, dt * 14));
    if (this.pendingRestart && this.agent.position.distanceTo(this.agentTarget) < 0.05) {
      this.pendingRestart = false;
      this.startEpisode();
    }
    if (!this.playing) return;
    this.acc = (this.acc ?? 0) + dt;
    if (this.acc < 0.09 || this.pendingRestart) return;
    this.acc = 0;
    this.step(true);
    this.refreshQ();
    this.render();
    this.setStatus(`Эпизод ${this.episode + 1}, шаг ${this.epSteps}`);
  }

  bindControls() {
    for (const id of ['epsilon', 'alpha', 'gamma']) {
      this.$(id).addEventListener('input', () => { this.$(`${id}-v`).textContent = this.$(id).value; });
    }
    const togglePlay = () => {
      this.playing = !this.playing;
      this.$('play').textContent = this.playing ? '⏸ Пауза' : '▶ Авто';
    };
    this.$('play').addEventListener('click', togglePlay);
    this.onKey('Space', togglePlay);
    this.$('step').addEventListener('click', () => {
      if (this.pendingRestart) { this.pendingRestart = false; this.startEpisode(); }
      this.step(true);
      this.refreshQ();
      this.render();
    });
    this.$('fast').addEventListener('click', () => {
      this.pendingRestart = false;
      const target = this.episode + 100;
      let guard = 0;
      while (this.episode < target && guard++ < 20000) this.step(false);
      this.startEpisode();
      this.refreshQ();
      this.render();
      this.setStatus(`Сыграно ещё 100 эпизодов (всего ${this.episode})`);
    });
    this.$('best').addEventListener('click', () => this.showBestPath());
    this.$('reset').addEventListener('click', () => this.reset());
  }
}
