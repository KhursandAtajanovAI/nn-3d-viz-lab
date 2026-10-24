// Данные блочного конструктора.
//
// Таблица (тип порта «data»):
//   { name, columns: string[], rows: (number|string|null)[][], target: string|null, image: null | { width, height } }
//   У датасета картинок image задан, первый столбец — label, дальше пиксели 0…1 (по строкам).
// Разбиение (тип порта «split»): { train: data, test: data }
import { rng } from './nn.js';

export const isNum = v => typeof v === 'number' && Number.isFinite(v);

export function cloneData(d, rows = d.rows) {
  return { name: d.name, columns: d.columns.slice(), rows, target: d.target, image: d.image ? { ...d.image } : null };
}

/** Индекс столбца-цели (или −1) */
export const targetIndex = d => (d.target ? d.columns.indexOf(d.target) : -1);

/**
 * Числовой ли столбец: не меньше 90 % заполненных ячеек — числа (пустые не считаются).
 * Редкие нечисла в числовом столбце (опечатки) при обучении считаются пропусками.
 */
export function isNumericColumn(d, c) {
  let nums = 0, other = 0;
  for (const r of d.rows) {
    const v = r[c];
    if (v === null || v === undefined || v === '') continue;
    if (isNum(v)) nums++; else other++;
  }
  return nums > 0 && other <= (nums + other) * 0.1;
}

/**
 * Признаки и ответы для обучения.
 * @returns {{ X: Float32Array[], y: (number|Float32Array)[], task: 'class'|'regression', classes: string[]|null, featureNames: string[], inputShape: number[], warnings: string[] }}
 */
export function toXY(d, { classes: knownClasses = null } = {}) {
  const t = targetIndex(d);
  if (t < 0) throw new Error(d.target ? `Нет столбца-цели «${d.target}»` : 'Не выбран столбец-цель (что предсказывать) — укажите его в блоке данных');
  const feats = d.columns.map((_, c) => c).filter(c => c !== t);
  const warnings = [];
  for (const c of feats) {
    if (!isNumericColumn(d, c) && d.rows.some(r => r[c] !== null && r[c] !== '')) {
      throw new Error(`Столбец «${d.columns[c]}» текстовый — добавьте блок «One-hot» перед обучением`);
    }
  }
  let missing = 0;
  const X = d.rows.map(r => Float32Array.from(feats, c => {
    const v = r[c];
    if (!isNum(v)) { missing++; return 0; }
    return v;
  }));
  if (missing) warnings.push(`Пустых или нечисловых ячеек в признаках: ${missing} — заменены нулями`);

  // Классификация: текстовая цель или немного целых значений; иначе регрессия
  const tv = d.rows.map(r => r[t]);
  const distinct = new Set(tv.filter(v => v !== null && v !== ''));
  const numericTarget = [...distinct].every(isNum);
  const isClass = d.image || !numericTarget || (distinct.size <= 20 && [...distinct].every(Number.isInteger));
  let y, classes = null;
  if (isClass) {
    classes = knownClasses ?? [...distinct].map(String).sort((a, b) => (numericTarget ? Number(a) - Number(b) : a.localeCompare(b, 'ru')));
    const idx = new Map(classes.map((c, i) => [c, i]));
    y = tv.map(v => idx.get(String(v)) ?? -1);
    const unknown = y.filter(v => v < 0).length;
    if (unknown) warnings.push(`Строк с пустой или незнакомой целью: ${unknown} — пропущены`);
  } else {
    y = tv.map(v => Float32Array.of(isNum(v) ? v : NaN));
  }
  // Пропускаем строки без ответа
  const keep = y.map(v => (isClass ? v >= 0 : Number.isFinite(v[0])));
  const Xk = X.filter((_, i) => keep[i]), yk = y.filter((_, i) => keep[i]);
  if (!Xk.length) throw new Error('Нет строк с заполненной целью');
  return {
    X: Xk, y: yk, task: isClass ? 'class' : 'regression', classes,
    featureNames: feats.map(c => d.columns[c]),
    inputShape: d.image ? [d.image.height, d.image.width, 1] : [feats.length],
    warnings,
  };
}

// ---------- Подготовка ----------

/** Нормализация числовых признаков (цель не трогаем). fit — по какой таблице считать статистику */
export function normalize(d, method, fit = d) {
  const t = targetIndex(d);
  const stats = d.columns.map((_, c) => {
    if (c === t || !isNumericColumn(fit, c)) return null;
    const vals = fit.rows.map(r => r[c]).filter(isNum);
    if (method === 'zscore') {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
      return v => (v - mean) / sd;
    }
    let lo = Infinity, hi = -Infinity;
    for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const span = hi - lo || 1;
    return v => (v - lo) / span;
  });
  return cloneData(d, d.rows.map(r => r.map((v, c) => (stats[c] && isNum(v) ? stats[c](v) : v))));
}

/** Перемешать и разбить на обучающую и тестовую части */
export function split(d, testShare, seed) {
  const r = rng(seed);
  const idx = d.rows.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const nTest = Math.max(1, Math.min(d.rows.length - 1, Math.round(d.rows.length * testShare)));
  return {
    train: cloneData(d, idx.slice(nTest).map(i => d.rows[i])),
    test: cloneData(d, idx.slice(0, nTest).map(i => d.rows[i])),
  };
}

/** One-hot для текстовых столбцов-признаков (цель не трогаем). maxValues — не больше стольких новых столбцов на признак */
export function oneHot(d, maxValues = 30) {
  const t = targetIndex(d);
  const plan = d.columns.map((name, c) => {
    if (c === t || isNumericColumn(d, c)) return null;
    const values = [...new Set(d.rows.map(r => r[c]).filter(v => v !== null && v !== ''))].map(String).sort();
    if (values.length > maxValues) throw new Error(`В столбце «${name}» ${values.length} разных значений — для one-hot допустимо до ${maxValues}`);
    return values;
  });
  if (plan.every(p => !p)) return { data: d, expanded: [] };
  const columns = [];
  d.columns.forEach((name, c) => {
    if (plan[c]) plan[c].forEach(v => columns.push(`${name}=${v}`.slice(0, 60)));
    else columns.push(name);
  });
  const rows = d.rows.map(r => {
    const out = [];
    r.forEach((v, c) => {
      if (plan[c]) plan[c].forEach(val => out.push(String(v) === val ? 1 : 0));
      else out.push(v);
    });
    return out;
  });
  return { data: { ...cloneData(d, rows), columns }, expanded: d.columns.filter((_, c) => plan[c]) };
}

// ---------- Датасеты из хранилища → таблица ----------

/** Сохранённый датасет (cleanDataset) → таблица для графа */
export function datasetToData(ds, target) {
  if (ds.kind === 'images') {
    const n = ds.width * ds.height;
    return {
      name: ds.name,
      columns: ['label', ...Array.from({ length: n }, (_, i) => `p${i}`)],
      rows: ds.items.map(it => [it.label, ...it.pixels.map(p => p / 255)]),
      target: 'label',
      image: { width: ds.width, height: ds.height },
    };
  }
  const tgt = target && ds.columns.includes(target) ? target : ds.columns.at(-1);
  return { name: ds.name, columns: ds.columns.slice(), rows: ds.rows, target: tgt, image: null };
}

// ---------- Встроенные примеры ----------

export const EXAMPLES = [
  ['moons', 'Две луны (2 класса)'],
  ['circles', 'Круг в кольце (2 класса)'],
  ['spirals', 'Две спирали (2 класса)'],
  ['xor', 'XOR-облака (2 класса)'],
  ['blobs', 'Три облака (3 класса)'],
  ['sine', 'Синусоида (регрессия)'],
  ['digits', 'Цифры 12×12 (картинки, 10 классов)'],
];

export function makeExample(kind, n, seed, noise) {
  const r = rng(seed);
  const g = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const rows = [];
  const pt = (x, y, cls) => rows.push([+(x + g() * noise).toFixed(4), +(y + g() * noise).toFixed(4), cls]);
  const table = (columns, title) => ({ name: title, columns, rows, target: columns.at(-1), image: null });
  switch (kind) {
    case 'moons':
      for (let i = 0; i < n; i++) {
        const a = Math.PI * r(), c = i % 2;
        if (c === 0) pt(Math.cos(a), Math.sin(a), 0); else pt(1 - Math.cos(a), 0.5 - Math.sin(a), 1);
      }
      return table(['x', 'y', 'класс'], 'Две луны');
    case 'circles':
      for (let i = 0; i < n; i++) {
        const a = 2 * Math.PI * r(), c = i % 2, rad = c ? 1 : 0.45;
        pt(rad * Math.cos(a), rad * Math.sin(a), c);
      }
      return table(['x', 'y', 'класс'], 'Круг в кольце');
    case 'spirals':
      for (let i = 0; i < n; i++) {
        const c = i % 2, t = 0.25 + 3 * r(), a = t * 2.2 + c * Math.PI;
        pt(t * Math.cos(a) / 3.3, t * Math.sin(a) / 3.3, c);
      }
      return table(['x', 'y', 'класс'], 'Две спирали');
    case 'xor':
      for (let i = 0; i < n; i++) {
        const sx = r() < 0.5 ? -1 : 1, sy = r() < 0.5 ? -1 : 1;
        pt(sx * 0.5, sy * 0.5, sx * sy > 0 ? 0 : 1);
      }
      return table(['x', 'y', 'класс'], 'XOR');
    case 'blobs': {
      const centers = [[-1, -0.6], [1, -0.6], [0, 1]];
      for (let i = 0; i < n; i++) { const c = i % 3; pt(centers[c][0], centers[c][1], ['A', 'B', 'C'][c]); }
      return table(['x', 'y', 'класс'], 'Три облака');
    }
    case 'sine':
      for (let i = 0; i < n; i++) {
        const x = -3 + 6 * r();
        rows.push([+x.toFixed(4), +(Math.sin(x) + g() * noise * 0.5).toFixed(4)]);
      }
      return table(['x', 'y'], 'Синусоида');
    case 'digits':
      return makeDigits(Math.min(n, 2000), r, noise);
    default:
      throw new Error(`Неизвестный пример «${kind}»`);
  }
}

/** Картинки цифр 12×12: цифра рисуется шрифтом с небольшими сдвигами, поворотом и шумом */
function makeDigits(n, r, noise) {
  const S = 12, big = 48;
  if (typeof document === 'undefined') throw new Error('Пример с картинками доступен только в браузере');
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = big;
  const c2 = cnv.getContext('2d', { willReadFrequently: true });
  const small = document.createElement('canvas');
  small.width = small.height = S;
  const s2 = small.getContext('2d', { willReadFrequently: true });
  const fonts = ['sans-serif', 'serif', 'monospace'];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const digit = i % 10;
    c2.fillStyle = '#000';
    c2.fillRect(0, 0, big, big);
    c2.save();
    c2.translate(big / 2 + (r() - 0.5) * 8, big / 2 + (r() - 0.5) * 8);
    c2.rotate((r() - 0.5) * 0.5);
    c2.fillStyle = '#fff';
    c2.font = `bold ${30 + Math.floor(r() * 10)}px ${fonts[Math.floor(r() * fonts.length)]}`;
    c2.textAlign = 'center';
    c2.textBaseline = 'middle';
    c2.fillText(String(digit), 0, 2);
    c2.restore();
    s2.drawImage(cnv, 0, 0, S, S);
    const px = s2.getImageData(0, 0, S, S).data;
    const pixels = [];
    for (let p = 0; p < S * S; p++) pixels.push(+Math.min(1, Math.max(0, px[p * 4] / 255 + (r() - 0.5) * noise)).toFixed(3));
    rows.push([String(digit), ...pixels]);
  }
  return {
    name: 'Цифры 12×12',
    columns: ['label', ...Array.from({ length: S * S }, (_, i) => `p${i}`)],
    rows, target: 'label', image: { width: S, height: S },
  };
}
