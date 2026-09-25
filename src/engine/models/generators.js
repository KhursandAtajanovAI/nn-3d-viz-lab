// Генераторы синтетических картинок для классификаторов (работают только в браузере — нужен canvas).
// Каждый генератор: (classIndex, rnd) → { w, h, c, data: Float32Array } (значения 0..1, каналы плоскостями).

function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

/** Пиксели canvas → изображение (1 канал — яркость, 3 канала — RGB) */
export function canvasToImage(cv, channels = 1) {
  const { width: w, height: h } = cv;
  const px = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const n = w * h, data = new Float32Array(n * channels);
  for (let i = 0; i < n; i++) {
    if (channels === 1) data[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 765;
    else for (let c = 0; c < 3; c++) data[c * n + i] = px[i * 4 + c] / 255;
  }
  return { w, h, c: channels, data };
}

/** Изображение → canvas (для превью на панели и текстур) */
export function imageToCanvas(img, cv = makeCanvas(img.w, img.h)) {
  cv.width = img.w;
  cv.height = img.h;
  const ctx = cv.getContext('2d');
  const out = ctx.createImageData(img.w, img.h);
  const n = img.w * img.h;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const v = img.c === 1 ? img.data[i] : img.data[c * n + i];
      out.data[i * 4 + c] = Math.round(Math.min(1, Math.max(0, v)) * 255);
    }
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return cv;
}

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const rr = (rnd, a, b) => a + rnd() * (b - a);

// ---------- Рукописные цифры (MNIST-подобные) ----------

const FONTS = ['Arial', 'Georgia', 'Verdana', 'Times New Roman', 'Courier New', 'Trebuchet MS',
  'Comic Sans MS', 'Segoe Print', 'Segoe Script', 'Ink Free', 'serif', 'sans-serif', 'monospace', 'cursive'];

/**
 * Нормализация как в MNIST: обрезать по рамке «чернил», вписать в 20×20 с сохранением пропорций
 * и поставить в центр поля 28×28. Применяется и к синтетическим цифрам, и к нарисованным мышью.
 */
export function normalizeGlyph(src) {
  const w = src.width, h = src.height;
  const px = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4] > 60) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const out = makeCanvas(28, 28);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 28, 28);
  if (x1 < 0) return canvasToImage(out, 1); // пусто
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const s = 20 / Math.max(bw, bh);
  const dw = bw * s, dh = bh * s;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, x0, y0, bw, bh, 14 - dw / 2, 14 - dh / 2, dw, dh);
  return canvasToImage(out, 1);
}

const digitCanvas = makeCanvasLazy(64, 64);
function makeCanvasLazy(w, h) {
  let cv = null;
  return () => (cv ??= makeCanvas(w, h));
}

export function generateDigit(d, rnd) {
  const cv = digitCanvas();
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 64);
  ctx.translate(32 + rr(rnd, -3, 3), 34 + rr(rnd, -3, 3));
  ctx.rotate(rr(rnd, -0.22, 0.22));
  ctx.transform(1, 0, rr(rnd, -0.25, 0.25), 1, 0, 0); // наклон, как у почерка
  const bold = rnd() < 0.5 ? 'bold ' : '';
  const italic = rnd() < 0.25 ? 'italic ' : '';
  ctx.font = `${italic}${bold}${Math.round(rr(rnd, 36, 48))}px "${pick(FONTS, rnd)}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = rr(rnd, 0, 5); // толщина «пера»
  ctx.lineJoin = 'round';
  if (ctx.lineWidth > 0.5) ctx.strokeText(String(d), 0, 0);
  ctx.fillText(String(d), 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return normalizeGlyph(cv);
}

// ---------- Одежда (Fashion-MNIST-подобные силуэты 28×28) ----------

export const FASHION_CLASSES = ['Футболка', 'Брюки', 'Свитер', 'Платье', 'Пальто', 'Сандалия', 'Рубашка', 'Кроссовок', 'Сумка', 'Ботинок'];

const fashionCanvas = makeCanvasLazy(28, 28);

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

const FASHION_DRAW = [
  // 0 Футболка: корпус + короткие рукава
  (ctx, r) => {
    const w = rr(r, 4.5, 6);
    poly(ctx, [[14 - w, 7], [14 + w, 7], [14 + w + 5, 11], [14 + w + 3, 14], [14 + w, 12], [14 + w, 24], [14 - w, 24], [14 - w, 12], [14 - w - 3, 14], [14 - w - 5, 11]]);
  },
  // 1 Брюки: две штанины
  (ctx, r) => {
    const gap = rr(r, 0.6, 1.6);
    poly(ctx, [[9, 4], [19, 4], [19.5, 25], [14 + gap, 25], [14, 11], [14 - gap, 25], [8.5, 25]]);
  },
  // 2 Свитер: корпус + длинные рукава
  (ctx, r) => {
    const w = rr(r, 5, 6);
    poly(ctx, [[14 - w, 6], [14 + w, 6], [14 + w + 4, 10], [14 + w + 6, 22], [14 + w + 3, 23], [14 + w, 13], [14 + w, 23], [14 - w, 23], [14 - w, 13], [14 - w - 3, 23], [14 - w - 6, 22], [14 - w - 4, 10]]);
  },
  // 3 Платье: узкий верх и расширяющийся низ
  (ctx, r) => {
    const b = rr(r, 7, 10);
    poly(ctx, [[11.5, 4], [16.5, 4], [17, 10], [14 + b, 25], [14 - b, 25], [11, 10]]);
  },
  // 4 Пальто: длинное, с тёмной застёжкой посередине
  (ctx, r) => {
    const w = rr(r, 5.5, 7);
    poly(ctx, [[14 - w, 4], [14 + w, 4], [14 + w + 4, 9], [14 + w + 5, 24], [14 + w + 2, 25], [14 + w, 13], [14 + w, 26], [14 - w, 26], [14 - w, 13], [14 - w - 2, 25], [14 - w - 5, 24], [14 - w - 4, 9]]);
    ctx.fillStyle = '#000';
    ctx.fillRect(13.4, 6, 1.2, 20);
  },
  // 5 Сандалия: подошва и тонкие ремешки
  (ctx, r) => {
    ctx.fillRect(3, 19, 22, 2.5);
    ctx.lineWidth = rr(r, 1, 1.8);
    ctx.beginPath();
    for (const x of [7, 12, 17]) { ctx.moveTo(x, 19); ctx.lineTo(x + rr(r, 2, 4), 12); }
    ctx.moveTo(20, 19); ctx.lineTo(23, 11);
    ctx.stroke();
  },
  // 6 Рубашка: длинные рукава, воротник и пуговицы, клетка
  (ctx, r) => {
    const w = rr(r, 5, 6);
    poly(ctx, [[14 - w, 6], [14 + w, 6], [14 + w + 4, 10], [14 + w + 5, 22], [14 + w + 2, 23], [14 + w, 13], [14 + w, 24], [14 - w, 24], [14 - w, 13], [14 - w - 2, 23], [14 - w - 5, 22], [14 - w - 4, 10]]);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let y = 9; y < 24; y += 3) ctx.fillRect(14 - w, y, 2 * w, 0.8);
    ctx.fillStyle = '#000';
    poly(ctx, [[12, 6], [14, 9], [16, 6]]);
    for (let y = 10; y < 23; y += 3) ctx.fillRect(13.6, y, 0.9, 0.9);
  },
  // 7 Кроссовок: низкий профиль, светлая подошва
  (ctx, r) => {
    const h = rr(r, 6, 8);
    poly(ctx, [[3, 21], [3, 18], [9, 20 - h], [15, 20 - h + 1], [18, 16], [25, 17.5], [25.5, 21]]);
    ctx.fillStyle = '#fff';
    ctx.fillRect(3, 21, 22.5, 2);
  },
  // 8 Сумка: корпус и ручка
  (ctx, r) => {
    const top = rr(r, 10, 12);
    ctx.fillRect(5, top, 18, 24 - top);
    ctx.lineWidth = rr(r, 1.2, 2.2);
    ctx.beginPath();
    ctx.arc(14, top, rr(r, 4, 6), Math.PI, 0);
    ctx.stroke();
  },
  // 9 Ботинок: высокое голенище и каблук
  (ctx, r) => {
    const top = rr(r, 4, 8);
    poly(ctx, [[12, top], [20, top], [20, 17], [25, 19], [25, 23], [4, 23], [4, 19], [12, 16]]);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(4, 22.2, 21, 0.8);
  },
];

export function generateFashion(cls, rnd) {
  const cv = fashionCanvas();
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 28, 28);
  const s = rr(rnd, 0.88, 1.04);
  ctx.translate(14 + rr(rnd, -1.2, 1.2), 14 + rr(rnd, -1.2, 1.2));
  ctx.rotate(rr(rnd, -0.08, 0.08));
  ctx.scale(s, s);
  ctx.translate(-14, -14);
  const v = Math.round(rr(rnd, 120, 255));
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  ctx.strokeStyle = ctx.fillStyle;
  FASHION_DRAW[cls](ctx, rnd);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvasToImage(cv, 1);
}

// ---------- CIFAR-10-подобные цветные сцены 32×32 ----------

export const CIFAR_CLASSES = ['Самолёт', 'Автомобиль', 'Птица', 'Кошка', 'Олень', 'Собака', 'Лягушка', 'Лошадь', 'Корабль', 'Грузовик'];

const cifarCanvas = makeCanvasLazy(32, 32);
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

function sky(ctx, r) {
  const grad = ctx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, hsl(rr(r, 195, 220), rr(r, 50, 80), rr(r, 55, 75)));
  grad.addColorStop(1, hsl(rr(r, 195, 215), rr(r, 30, 60), rr(r, 75, 88)));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
}
function ground(ctx, r, y, hue = rr(r, 80, 120), l = rr(r, 25, 40)) {
  ctx.fillStyle = hsl(hue, rr(r, 30, 60), l);
  ctx.fillRect(0, y, 32, 32 - y);
}
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}
function wheels(ctx, xs, y, rad) {
  ctx.fillStyle = '#111';
  for (const x of xs) ellipse(ctx, x, y, rad, rad);
}
function legs(ctx, xs, y0, y1, w = 1.4) {
  for (const x of xs) ctx.fillRect(x, y0, w, y1 - y0);
}

const CIFAR_DRAW = [
  // 0 Самолёт: небо, фюзеляж и крылья
  (ctx, r) => {
    sky(ctx, r);
    ctx.save();
    ctx.translate(16, 15);
    ctx.rotate(rr(r, -0.5, 0.5));
    ctx.fillStyle = hsl(0, 0, rr(r, 70, 95));
    ellipse(ctx, 0, 0, 12, 2.2);
    poly(ctx, [[-2, 0], [4, 0], [-4, 10], [-7, 10]]);
    poly(ctx, [[-2, 0], [4, 0], [-4, -10], [-7, -10]]);
    poly(ctx, [[-10, 0], [-8, 0], [-12, -5], [-13, -5]]);
    ctx.restore();
  },
  // 1 Автомобиль: дорога, кузов с кабиной, колёса
  (ctx, r) => {
    ctx.fillStyle = hsl(rr(r, 0, 360), rr(r, 5, 25), rr(r, 50, 75));
    ctx.fillRect(0, 0, 32, 32);
    ground(ctx, r, 22, 0, rr(r, 25, 40));
    ctx.fillStyle = hsl(rr(r, 0, 360), rr(r, 60, 90), rr(r, 35, 55));
    ctx.fillRect(3, 14, 26, 7);
    poly(ctx, [[8, 14], [11, 9], [21, 9], [24, 14]]);
    ctx.fillStyle = hsl(200, 40, 75);
    ctx.fillRect(12, 10, 4, 3.5); ctx.fillRect(17, 10, 4, 3.5);
    wheels(ctx, [9, 23], 21.5, 3);
  },
  // 2 Птица: небо или листва, маленькое тело, клюв, крыло
  (ctx, r) => {
    if (r() < 0.5) sky(ctx, r); else { ctx.fillStyle = hsl(rr(r, 90, 130), 40, rr(r, 30, 45)); ctx.fillRect(0, 0, 32, 32); }
    const x = rr(r, 12, 20), y = rr(r, 12, 18);
    ctx.fillStyle = hsl(rr(r, 0, 50), rr(r, 30, 80), rr(r, 15, 40));
    ellipse(ctx, x, y, 6, 4, -0.2);
    ellipse(ctx, x + 5, y - 3, 2.8, 2.6);
    ctx.fillStyle = hsl(35, 90, 55);
    poly(ctx, [[x + 7.5, y - 3.5], [x + 11, y - 2.5], [x + 7.5, y - 2]]);
    ctx.fillStyle = hsl(0, 0, 10);
    poly(ctx, [[x - 2, y - 1], [x + 3, y - 1], [x - 6, y - 8]]);
    ctx.fillStyle = '#ff9';
    ellipse(ctx, x + 5.5, y - 3.5, 0.7, 0.7);
  },
  // 3 Кошка: морда, треугольные уши, зелёные глаза
  (ctx, r) => {
    ctx.fillStyle = hsl(rr(r, 20, 45), rr(r, 20, 45), rr(r, 50, 75));
    ctx.fillRect(0, 0, 32, 32);
    const fur = hsl(pick([25, 30, 0, 35], r), rr(r, 0, 70), rr(r, 20, 60));
    ctx.fillStyle = fur;
    ellipse(ctx, 16, 18, 10, 8.5);
    poly(ctx, [[7, 13], [9, 3], [14, 11]]);
    poly(ctx, [[25, 13], [23, 3], [18, 11]]);
    ctx.fillStyle = hsl(rr(r, 80, 130), 80, 45);
    ellipse(ctx, 12, 16, 2, 1.6); ellipse(ctx, 20, 16, 2, 1.6);
    ctx.fillStyle = '#000';
    ellipse(ctx, 12, 16, 0.6, 1.4); ellipse(ctx, 20, 16, 0.6, 1.4);
    ctx.fillStyle = hsl(350, 60, 65);
    poly(ctx, [[15, 20], [17, 20], [16, 21.5]]);
  },
  // 4 Олень: лес, коричневое тело, тонкие ноги, рога
  (ctx, r) => {
    ctx.fillStyle = hsl(rr(r, 90, 130), rr(r, 25, 45), rr(r, 30, 45));
    ctx.fillRect(0, 0, 32, 32);
    ground(ctx, r, 25, rr(r, 70, 110), rr(r, 20, 30));
    ctx.fillStyle = hsl(rr(r, 22, 32), rr(r, 45, 65), rr(r, 30, 42));
    ellipse(ctx, 15, 17, 8, 4);
    legs(ctx, [9, 11.5, 18, 20.5], 19, 28, 1.1);
    poly(ctx, [[20, 16], [23, 8], [25.5, 9], [23, 17]]);
    ellipse(ctx, 25, 8.5, 2.5, 1.6);
    ctx.strokeStyle = hsl(30, 30, 25);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(24, 7); ctx.lineTo(22, 2); ctx.moveTo(23, 4); ctx.lineTo(20, 3);
    ctx.moveTo(26, 7); ctx.lineTo(28, 2); ctx.moveTo(27, 4); ctx.lineTo(30, 3);
    ctx.stroke();
  },
  // 5 Собака: морда, висячие уши, чёрный нос
  (ctx, r) => {
    ctx.fillStyle = hsl(rr(r, 0, 360), rr(r, 10, 30), rr(r, 55, 80));
    ctx.fillRect(0, 0, 32, 32);
    const fur = hsl(rr(r, 20, 40), rr(r, 20, 60), rr(r, 25, 70));
    ctx.fillStyle = fur;
    ellipse(ctx, 16, 16, 8, 9);
    ctx.fillStyle = hsl(25, 40, rr(r, 12, 30));
    ellipse(ctx, 7, 17, 3, 7, 0.3); ellipse(ctx, 25, 17, 3, 7, -0.3);
    ctx.fillStyle = hsl(30, 20, rr(r, 70, 90));
    ellipse(ctx, 16, 21, 5, 3.5);
    ctx.fillStyle = '#000';
    ellipse(ctx, 16, 19.5, 2, 1.4);
    ellipse(ctx, 12.5, 13.5, 1.1, 1.1); ellipse(ctx, 19.5, 13.5, 1.1, 1.1);
  },
  // 6 Лягушка: тёмный фон, широкое зелёное тело, глаза-бугорки
  (ctx, r) => {
    ctx.fillStyle = hsl(rr(r, 30, 60), rr(r, 20, 40), rr(r, 15, 30));
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = hsl(rr(r, 85, 130), rr(r, 50, 80), rr(r, 30, 45));
    ellipse(ctx, 16, 19, 11, 6.5);
    ellipse(ctx, 10, 13, 3, 3); ellipse(ctx, 22, 13, 3, 3);
    ellipse(ctx, 6, 24, 4, 2); ellipse(ctx, 26, 24, 4, 2);
    ctx.fillStyle = '#000';
    ellipse(ctx, 10, 12.5, 1.2, 1.2); ellipse(ctx, 22, 12.5, 1.2, 1.2);
  },
  // 7 Лошадь: трава и небо, большое тело, длинные ноги и шея, хвост
  (ctx, r) => {
    sky(ctx, r);
    ground(ctx, r, 22);
    ctx.fillStyle = hsl(rr(r, 15, 30), rr(r, 30, 60), rr(r, 12, 35));
    ellipse(ctx, 14, 15, 9, 4.5);
    legs(ctx, [7, 9.5, 17, 19.5], 17, 29, 1.6);
    poly(ctx, [[19, 13], [23, 4], [26, 5], [23, 15]]);
    ellipse(ctx, 26, 5.5, 3.5, 1.8, 0.4);
    poly(ctx, [[5, 13], [2, 22], [3.5, 22], [6, 15]]);
  },
  // 8 Корабль: море внизу, небо сверху, корпус и надстройка
  (ctx, r) => {
    sky(ctx, r);
    ctx.fillStyle = hsl(rr(r, 200, 225), rr(r, 50, 80), rr(r, 25, 40));
    ctx.fillRect(0, 19, 32, 13);
    ctx.fillStyle = hsl(0, rr(r, 0, 50), rr(r, 15, 35));
    poly(ctx, [[3, 15], [29, 15], [25, 21], [7, 21]]);
    ctx.fillStyle = hsl(0, 0, rr(r, 80, 95));
    ctx.fillRect(10, 10, 10, 5);
    ctx.fillRect(13, 6, 4, 4);
  },
  // 9 Грузовик: дорога, длинный кузов-фургон, кабина, три колеса
  (ctx, r) => {
    ctx.fillStyle = hsl(rr(r, 0, 360), rr(r, 5, 20), rr(r, 55, 80));
    ctx.fillRect(0, 0, 32, 32);
    ground(ctx, r, 24, 0, rr(r, 25, 40));
    ctx.fillStyle = hsl(rr(r, 0, 360), rr(r, 10, 60), rr(r, 50, 85));
    ctx.fillRect(1, 8, 20, 14);
    ctx.fillStyle = hsl(rr(r, 0, 360), rr(r, 50, 90), rr(r, 30, 50));
    poly(ctx, [[21, 12], [27, 12], [30, 17], [30, 22], [21, 22]]);
    ctx.fillStyle = hsl(200, 40, 75);
    poly(ctx, [[23, 13], [26.5, 13], [28.5, 17], [23, 17]]);
    wheels(ctx, [6, 13, 25], 23, 2.6);
  },
];

export function generateCifar(cls, rnd) {
  const cv = cifarCanvas();
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Небольшие случайные сдвиг, масштаб и отражение — как аугментация данных
  // Масштаб ≥ 1.1 и сдвиг ≤ 1.2 px — фон всегда закрывает кадр целиком, без чёрных полос
  const s = rr(rnd, 1.1, 1.25), flip = rnd() < 0.5 ? -1 : 1;
  ctx.translate(16 + rr(rnd, -1.2, 1.2), 16 + rr(rnd, -1.2, 1.2));
  ctx.scale(s * flip, s);
  ctx.translate(-16, -16);
  ctx.fillStyle = '#000';
  ctx.fillRect(-4, -4, 40, 40);
  CIFAR_DRAW[cls](ctx, rnd);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Лёгкий шум сенсора
  const img = canvasToImage(cv, 3);
  for (let i = 0; i < img.data.length; i++) img.data[i] = Math.min(1, Math.max(0, img.data[i] + (rnd() - 0.5) * 0.06));
  return img;
}

export const DIGIT_CLASSES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
