// Простой линейный график в SVG (без зависимостей): loss по эпохам, награда по эпизодам и т.п.

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function niceNum(v) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2).replace(/\.?0+$/, '');
  return v.toPrecision(2);
}

/**
 * @param {{ values: number[], color?: string, label?: string }[]} series
 * @param {object} [o]
 * @returns {string} SVG-разметка
 */
export function lineChartSvg(series, { width = 320, height = 150, xLabel = '', yLabel = '', yMin, yMax, logY = false, marker } = {}) {
  const pad = { l: 42, r: 10, t: 12, b: 28 };
  const all = series.flatMap(s => s.values).filter(Number.isFinite);
  if (!all.length) return `<svg class="chart" viewBox="0 0 ${width} ${height}"><text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="chart-empty">Нет данных</text></svg>`;
  const tf = v => (logY ? Math.log10(Math.max(v, 1e-6)) : v);
  let lo = yMin ?? Math.min(...all), hi = yMax ?? Math.max(...all);
  lo = tf(lo); hi = tf(hi);
  if (hi - lo < 1e-9) { hi += 0.5; lo -= 0.5; }
  const n = Math.max(...series.map(s => s.values.length));
  const X = i => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (width - pad.l - pad.r));
  const Y = v => pad.t + (1 - (tf(v) - lo) / (hi - lo)) * (height - pad.t - pad.b);

  let grid = '';
  for (let k = 0; k <= 3; k++) {
    const t = lo + ((hi - lo) * k) / 3;
    const y = pad.t + (1 - k / 3) * (height - pad.t - pad.b);
    grid += `<line class="grid" x1="${pad.l}" x2="${width - pad.r}" y1="${y}" y2="${y}" />
      <text class="tick" x="${pad.l - 5}" y="${y + 3}" text-anchor="end">${niceNum(logY ? 10 ** t : t)}</text>`;
  }
  grid += `<text class="tick" x="${pad.l}" y="${height - 10}">1</text><text class="tick" x="${width - pad.r}" y="${height - 10}" text-anchor="end">${n}</text>`;

  const paths = series.map((s, si) => {
    const pts = s.values.map((v, i) => (Number.isFinite(v) ? `${X(i).toFixed(1)},${Y(v).toFixed(1)}` : null)).filter(Boolean);
    const color = s.color ?? ['#ff9f1c', '#2f9bff', '#7ee081'][si % 3];
    const last = s.values.length ? `<circle cx="${X(s.values.length - 1)}" cy="${Y(s.values.at(-1))}" r="3" fill="${color}" />` : '';
    return `<polyline fill="none" stroke="${color}" stroke-width="2" points="${pts.join(' ')}" />${last}`;
  }).join('');

  const legend = series.some(s => s.label)
    ? `<g class="legend">${series.map((s, i) => `<text x="${width - pad.r}" y="${pad.t + 10 + i * 12}" text-anchor="end" fill="${s.color ?? ['#ff9f1c', '#2f9bff', '#7ee081'][i % 3]}">${esc(s.label ?? '')}</text>`).join('')}</g>`
    : '';
  const mark = marker !== undefined && n > 1 ? `<line class="marker" x1="${X(marker)}" x2="${X(marker)}" y1="${pad.t}" y2="${height - pad.b}" />` : '';

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(yLabel)}">
    ${grid}${mark}${paths}${legend}
    <text class="axis" x="${(pad.l + width - pad.r) / 2}" y="${height - 2}" text-anchor="middle">${esc(xLabel)}</text>
    <text class="axis" x="10" y="${(pad.t + height - pad.b) / 2}" text-anchor="middle" transform="rotate(-90 10 ${(pad.t + height - pad.b) / 2})">${esc(yLabel)}</text>
  </svg>`;
}
