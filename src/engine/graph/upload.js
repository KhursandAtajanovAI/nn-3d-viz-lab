// Загрузка датасетов пользователем: CSV, JSON, картинки → объект датасета (как cleanDataset в spaceFormat.js).
// Файлы только читаются как текст или декодируются как изображения; ничего из них не исполняется.
import { LIMITS, cleanDataset, newId } from '../spaceFormat.js';
import { L, t as tl } from '../../i18n/i18n.js';
import { fail } from './fail.js';

export const UPLOAD_LIMITS = {
  tableBytes: 5 * 1024 * 1024, // CSV / JSON
  imageBytes: 2 * 1024 * 1024, // одна картинка
};

const baseName = f => f.name.replace(/\.[^.]+$/, '').slice(0, LIMITS.name) || tl('graph.up.datasetName');

function finish(raw) {
  const errors = [];
  const ds = cleanDataset(raw, errors, tl('graph.up.fileWhere'));
  if (!ds) throw errors[0] ? new Error(errors[0]) : fail('graph.err.datasetInvalid');
  return ds;
}

// ---------- CSV ----------

/** Разбор CSV: разделитель , ; или табуляция, кавычки по RFC 4180, первая строка — заголовки */
export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.indexOf('\n') >>> 0);
  const delim = [',', ';', '\t'].map(d => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
      if (rows.length > LIMITS.datasetRows + 1) throw fail('graph.err.fileRows', { max: LIMITS.datasetRows });
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  if (rows.length < 2) throw fail('graph.err.csvMin');
  const columns = rows[0].map((c, i) => c.trim() || tl('graph.up.columnN', { n: i + 1 }));
  if (columns.length > LIMITS.datasetColumns) throw fail('graph.err.fileCols', { n: columns.length, max: LIMITS.datasetColumns });
  const num = s => {
    const t = s.trim();
    if (t === '') return null;
    const v = Number(delim === ';' ? t.replace(',', '.') : t);
    return Number.isFinite(v) ? v : t;
  };
  return { columns, rows: rows.slice(1).map(r => columns.map((_, c) => num(r[c] ?? ''))) };
}

// ---------- JSON ----------

/** JSON: массив объектов [{a: 1, b: 2}, …] или { columns: [...], rows: [[...]] } */
export function parseJsonTable(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw fail('graph.err.jsonBad', { msg: e.message }); }
  if (Array.isArray(data)) {
    if (!data.length || typeof data[0] !== 'object' || data[0] === null) throw fail('graph.err.jsonArray');
    const columns = [...new Set(data.slice(0, 1000).flatMap(o => (o && typeof o === 'object' ? Object.keys(o) : [])))];
    return { columns, rows: data.map(o => columns.map(c => o?.[c] ?? null)) };
  }
  if (data && Array.isArray(data.columns) && Array.isArray(data.rows)) return { columns: data.columns, rows: data.rows };
  throw fail('graph.err.jsonShape');
}

export async function readTableFile(f) {
  if (f.size > UPLOAD_LIMITS.tableBytes) throw fail('graph.err.fileBig', { size: { num: f.size / 1048576, d: 1 }, max: UPLOAD_LIMITS.tableBytes / 1048576 });
  const text = await f.text();
  const t = /\.json$/i.test(f.name) ? parseJsonTable(text) : parseCsv(text);
  return finish({ id: newId('d'), name: baseName(f), kind: 'table', columns: t.columns, rows: t.rows });
}

// ---------- Картинки ----------

/** Метка из имени файла: «cat_01.png» → «cat», «7-12.png» → «7»; без разделителя — имя целиком */
export const labelFromName = name => name.replace(/\.[^.]+$/, '').split(/[_\-\s.]/)[0].slice(0, LIMITS.name) || '?';

/**
 * Картинки → датасет: каждая переводится в оттенки серого и уменьшается до side × side.
 * @param {File[]} files
 * @param {number} side — сторона в пикселях (до LIMITS.imageSide)
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function readImageFiles(files, side, name, onProgress) {
  side = Math.max(4, Math.min(LIMITS.imageSide, Math.round(side)));
  const list = [...files].filter(f => /^image\//.test(f.type));
  if (!list.length) throw fail('graph.err.noImages');
  if (list.length > LIMITS.images) throw fail('graph.err.manyImages', { n: list.length, max: LIMITS.images });
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = side;
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  const items = [];
  const skipped = [];
  for (let k = 0; k < list.length; k++) {
    const f = list[k];
    if (f.size > UPLOAD_LIMITS.imageBytes) { skipped.push(L('graph.up.skipBig', { name: f.name, mb: UPLOAD_LIMITS.imageBytes / 1048576 })); continue; }
    let bmp;
    try { bmp = await createImageBitmap(f); } catch { skipped.push(L('graph.up.skipDecode', { name: f.name })); continue; }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, side, side);
    // Вписываем с сохранением пропорций
    const s = side / Math.max(bmp.width, bmp.height);
    const w = bmp.width * s, h = bmp.height * s;
    ctx.drawImage(bmp, (side - w) / 2, (side - h) / 2, w, h);
    bmp.close?.();
    const px = ctx.getImageData(0, 0, side, side).data;
    const pixels = new Array(side * side);
    for (let p = 0; p < side * side; p++) pixels[p] = Math.round(0.299 * px[p * 4] + 0.587 * px[p * 4 + 1] + 0.114 * px[p * 4 + 2]);
    items.push({ label: labelFromName(f.name), pixels });
    if (k % 20 === 0) { onProgress?.(k + 1, list.length); await new Promise(r => setTimeout(r)); }
  }
  if (!items.length) throw fail('graph.err.noneRead', { list: skipped.slice(0, 5).map(s => tl(s.k, s.p)).join('\n') });
  const ds = finish({ id: newId('d'), name: name || tl('graph.up.imagesName'), kind: 'images', width: side, height: side, items });
  return { ds, skipped };
}
