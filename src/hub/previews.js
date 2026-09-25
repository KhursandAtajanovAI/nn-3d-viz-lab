// Мини-схемы для карточек каталога (SVG). Формат задаётся полем meta.preview пространства:
//   [3, 4, 2]                                 — полносвязная сеть: столбцы нейронов
//   { blocks: [[h, c], …], skips: [[a, b]] }  — свёрточная/блочная архитектура: прямоугольники
//                                              (h — относительная высота 0..1, c — «толщина» 0..1)
//   { tokens: ['я', 'люблю', …] }             — последовательность слов с дугами внимания
//   { scatter: 3 }                            — облако точек из N кластеров
//   { surface: true }                         — линии уровня поверхности ошибки с траекторией
//   { grid: 5 }                               — клетчатая среда (обучение с подкреплением)
const W = 220, H = 96;

function svg(content, cls = '') {
  return `<svg class="preview ${cls}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${content}</svg>`;
}

function mlp(layers) {
  const MAX = 7, R = 4;
  const colX = i => 18 + (i * (W - 36)) / (layers.length - 1);
  const cols = layers.map((n, i) => {
    const count = Math.min(n, MAX);
    const gap = Math.min(13, (H - 20) / Math.max(count - 1, 1));
    return Array.from({ length: count }, (_, k) => ({
      x: colX(i), y: H / 2 + (k - (count - 1) / 2) * gap, more: n > MAX && k === count - 1,
    }));
  });
  let lines = '';
  for (let i = 0; i < cols.length - 1; i++) {
    for (const a of cols[i]) for (const b of cols[i + 1]) {
      lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
    }
  }
  const dots = cols.flat().map(p => p.more
    ? `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle">⋯</text>`
    : `<circle cx="${p.x}" cy="${p.y}" r="${R}" />`).join('');
  return svg(`<g class="links">${lines}</g><g class="nodes">${dots}</g>`);
}

function blocks({ blocks: list, skips = [] }) {
  const n = list.length;
  const step = (W - 24) / n;
  let out = '';
  const centers = [];
  list.forEach(([h, c], i) => {
    const bh = 10 + h * 62, bw = Math.max(3, 3 + c * (step - 8));
    const x = 12 + i * step + (step - bw) / 2, y = H / 2 - bh / 2 + 8;
    centers.push({ x: x + bw / 2, top: y });
    out += `<rect class="block" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" />`;
  });
  const arcs = skips.map(([a, b]) => {
    const p = centers[a], q = centers[b];
    if (!p || !q) return '';
    const top = Math.min(p.top, q.top) - 10;
    return `<path class="skip" d="M${p.x},${p.top} C${p.x},${top} ${q.x},${top} ${q.x},${q.top}" />`;
  }).join('');
  return svg(`${out}${arcs}`, 'blocks');
}

function tokens({ tokens: words }) {
  const n = words.length;
  const step = (W - 20) / n;
  const xs = words.map((_, i) => 10 + step * (i + 0.5));
  const last = xs[n - 1];
  const arcs = xs.slice(0, -1).map((x, i) => {
    const w = 0.6 + 2.4 * ((i * 37) % 10) / 10;
    return `<path class="attn" style="stroke-width:${w.toFixed(1)}" d="M${x},${H - 34} Q${(x + last) / 2},${H - 34 - 18 - (last - x) / 5} ${last},${H - 34}" />`;
  }).join('');
  const boxes = words.map((w, i) => `
    <rect class="token" x="${(xs[i] - step / 2 + 2).toFixed(1)}" y="${H - 30}" width="${(step - 4).toFixed(1)}" height="18" rx="4" />
    <text x="${xs[i].toFixed(1)}" y="${H - 17}" text-anchor="middle">${w}</text>`).join('');
  return svg(`${arcs}${boxes}`, 'tokens');
}

function scatter({ scatter: k }) {
  // Детерминированный «шум», чтобы картинка не прыгала при перезагрузке
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const centers = Array.from({ length: k }, (_, i) => [40 + (i * 150) / Math.max(1, k - 1), 30 + ((i * 53) % 40)]);
  let dots = '';
  centers.forEach(([cx, cy], g) => {
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 18;
      dots += `<circle class="g${g % 4}" cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + 12 + Math.sin(a) * r * 0.8).toFixed(1)}" r="3" />`;
    }
    dots += `<circle class="centroid" cx="${cx}" cy="${cy + 12}" r="5" />`;
  });
  return svg(dots, 'scatter');
}

function surface() {
  let rings = '';
  for (let i = 1; i <= 6; i++) {
    rings += `<ellipse cx="130" cy="52" rx="${i * 15}" ry="${i * 7}" />`;
  }
  const path = 'M24,14 L52,26 L76,36 L96,43 L112,48 L122,50 L128,51 L130,52';
  return svg(`<g class="rings">${rings}</g><path class="trail" d="${path}" /><circle class="ball" cx="130" cy="52" r="5" /><circle class="start" cx="24" cy="14" r="3" />`, 'surface');
}

function grid({ grid: n }) {
  const size = 14, x0 = W / 2 - (n * size) / 2, y0 = H / 2 - (n * size) / 2;
  let cells = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const cls = r === 0 && c === n - 1 ? 'goal' : (r === 1 && c === 2) || (r === 3 && c === 1) ? 'pit' : (r === 2 && c === 3) ? 'wall' : '';
    cells += `<rect class="cell ${cls}" x="${x0 + c * size}" y="${y0 + r * size}" width="${size - 2}" height="${size - 2}" rx="2" />`;
  }
  return svg(`${cells}<circle class="agent" cx="${x0 + 6}" cy="${y0 + (n - 1) * size + 6}" r="4" />`, 'grid');
}

export function previewSvg(p) {
  if (!p) return svg('');
  if (Array.isArray(p)) return mlp(p);
  if (p.blocks) return blocks(p);
  if (p.tokens) return tokens(p);
  if (p.scatter) return scatter(p);
  if (p.surface) return surface();
  if (p.grid) return grid(p);
  return svg('');
}
