// Элементы панели результатов: числа, текст, таблицы, графики и картинки.
// Всё строится через createElement/textContent — значения из файлов пользователя не попадают в innerHTML.
// Цвета графиков берутся из CSS-переменных темы в момент рисования.

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
/** Цвета классов: те же акценты, что в 3D-сценах */
export const classColor = i => [css('--pos'), css('--neg'), css('--ok'), css('--demo'), '#c06cff', '#ff6b9a', '#4fd1c5', '#a3a948', '#8d6e63', '#7f8c8d'][i % 10];

export function fmt(v, digits = 3) {
  if (typeof v !== 'number') return v === null || v === undefined ? '—' : String(v);
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toExponential(2);
  return String(+v.toFixed(digits));
}

/** Крупные числа с подписями: [[«Точность (тест)», «93.5 %»], …] */
export function numbers(pairs) {
  const box = el('div', 'gv-numbers');
  for (const [label, value, hint] of pairs) {
    const item = el('div', 'gv-number');
    item.append(el('b', '', value), el('span', '', label));
    if (hint) item.title = hint;
    box.append(item);
  }
  return box;
}

/** Моноширинный текст (вывод чисел) */
export function text(lines) {
  return el('pre', 'gv-text', Array.isArray(lines) ? lines.join('\n') : lines);
}

export function note(t, kind = '') {
  return el('p', `gv-note ${kind}`, t);
}

/**
 * Таблица. cells — значения или { text, cls, title }.
 * @param {string[]} columns
 * @param {Array<Array<any>>} rows
 */
export function table(columns, rows, { caption } = {}) {
  const wrap = el('div', 'gv-table-wrap');
  const t = el('table', 'gv-table');
  if (caption) t.append(el('caption', '', caption));
  const tr = el('tr');
  for (const c of columns) tr.append(el('th', '', c));
  t.append(el('thead'));
  t.tHead.append(tr);
  const body = el('tbody');
  for (const r of rows) {
    const row = el('tr');
    for (const v of r) {
      const isObj = v && typeof v === 'object';
      const td = el('td', isObj ? v.cls ?? '' : typeof v === 'number' ? 'num' : '', isObj ? v.text : fmt(v));
      if (isObj && v.title) td.title = v.title;
      if (isObj && v.bg) td.style.background = v.bg;
      row.append(td);
    }
    body.append(row);
  }
  t.append(body);
  wrap.append(t);
  return wrap;
}

/** Канва фиксированного размера с devicePixelRatio; draw(ctx, w, h) */
export function canvas(w, h, draw) {
  const c = el('canvas', 'gv-canvas');
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = '100%';
  c.style.aspectRatio = `${w} / ${h}`;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  draw(ctx, w, h);
  return c;
}

/**
 * Линейный график: series = [{ name, values, color }], ось X — эпохи.
 */
export function lineChart(series, { yLabel = '', w = 320, h = 180 } = {}) {
  const box = el('div', 'gv-chart');
  const all = series.flatMap(s => s.values).filter(Number.isFinite);
  if (!all.length) return note('Нет данных для графика');
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-9) { hi += 0.5; lo -= 0.5; }
  const n = Math.max(...series.map(s => s.values.length));
  const pad = { l: 40, r: 8, t: 8, b: 22 };
  box.append(canvas(w, h, (ctx, W, H) => {
    const x = i => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
    const y = v => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    ctx.font = '10px system-ui, sans-serif';
    ctx.strokeStyle = css('--border');
    ctx.fillStyle = css('--muted');
    ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = lo + (hi - lo) * k / 4, yy = y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
      ctx.fillText(fmt(v, 2), 2, yy + 3);
    }
    ctx.fillText(`эпохи: ${n}`, W - pad.r - 50, H - 6);
    if (yLabel) ctx.fillText(yLabel, pad.l, H - 6);
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
      ctx.stroke();
    }
  }));
  const legend = el('div', 'gv-legend');
  for (const s of series) {
    const item = el('span', '', s.name);
    item.style.setProperty('--c', s.color);
    legend.append(item);
  }
  box.append(legend);
  return box;
}

/**
 * Диаграмма рассеяния: points = [{ x, y, c, ok? }]; background(x, y) → индекс класса или null — области решений.
 */
export function scatter(points, { classes = [], xLabel = 'x', yLabel = 'y', background = null, w = 320, h = 260 } = {}) {
  const box = el('div', 'gv-chart');
  if (!points.length) return note('Нет точек');
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const mx = (x1 - x0 || 1) * 0.06, my = (y1 - y0 || 1) * 0.06;
  x0 -= mx; x1 += mx; y0 -= my; y1 += my;
  box.append(canvas(w, h, (ctx, W, H) => {
    const X = v => ((v - x0) / (x1 - x0)) * W, Y = v => H - ((v - y0) / (y1 - y0)) * H;
    if (background) {
      const step = 6;
      ctx.globalAlpha = 0.18;
      for (let px = 0; px < W; px += step) for (let py = 0; py < H; py += step) {
        const c = background(x0 + ((px + step / 2) / W) * (x1 - x0), y1 - ((py + step / 2) / H) * (y1 - y0));
        if (c === null || c === undefined) continue;
        ctx.fillStyle = classColor(c);
        ctx.fillRect(px, py, step, step);
      }
      ctx.globalAlpha = 1;
    }
    for (const p of points) {
      ctx.fillStyle = classColor(p.c);
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (p.ok === false) { ctx.strokeStyle = css('--error'); ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    ctx.fillStyle = css('--muted');
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(xLabel, W - 6 - ctx.measureText(xLabel).width, H - 4);
    ctx.fillText(yLabel, 4, 11);
  }));
  if (classes.length) {
    const legend = el('div', 'gv-legend');
    classes.slice(0, 10).forEach((c, i) => {
      const item = el('span', '', c);
      item.style.setProperty('--c', classColor(i));
      legend.append(item);
    });
    box.append(legend);
  }
  return box;
}

/** Картинка из значений 0…1 (оттенки серого или сине-оранжевая карта для признаков со знаком) */
export function imageCanvas(values, w, h, { signed = false, scale = 4, caption = '', cls = '' } = {}) {
  const fig = el('figure', `gv-img ${cls}`);
  const c = el('canvas');
  c.width = w;
  c.height = h;
  c.style.width = `${w * scale}px`;
  c.style.imageRendering = 'pixelated';
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  let lo = 0, hi = 1;
  if (signed) {
    const m = Math.max(1e-6, ...Array.from(values, Math.abs));
    lo = -m; hi = m;
  }
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(1, (values[i] - lo) / (hi - lo)));
    let r, g, b;
    if (signed) { // синий (−) → чёрный (0) → оранжевый (+)
      const t = v * 2 - 1;
      [r, g, b] = t >= 0 ? [255 * t, 159 * t, 28 * t] : [47 * -t, 155 * -t, 255 * -t];
    } else r = g = b = v * 255;
    img.data.set([r, g, b, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  fig.append(c);
  if (caption) fig.append(el('figcaption', '', caption));
  return fig;
}

export function grid(children) {
  const g = el('div', 'gv-grid');
  g.append(...children);
  return g;
}
