// Хранилище пользовательских пространств и датасетов в IndexedDB браузера.
// У всех проектов на *.github.io один origin, поэтому база названа с префиксом проекта («nnlab-»),
// чтобы не пересекаться с базами других сайтов пользователя.
//
// Хранилища:
//   spaces   — { id, createdAt, updatedAt, file }  (file — объект формата nn3d-space, уже проверенный)
//   datasets — { id, name, kind, createdAt, size, data } (данные блочного конструктора)
import { isValidUserId, isValidDatasetId, validateSpaceFile, newId } from './spaceFormat.js';
import { t } from '../i18n/i18n.js';

const DB_NAME = 'nnlab-user';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error(t('store.noIndexedDb'))); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('spaces')) db.createObjectStore('spaces', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('datasets')) db.createObjectStore('datasets', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(t('store.openFailed', { msg: req.error?.message ?? t('store.unknown') })));
    req.onblocked = () => reject(new Error(t('store.blocked')));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tr = db.transaction(store, mode);
    const s = tr.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; }, reject);
    tr.oncomplete = () => resolve(result);
    tr.onerror = () => reject(new Error(tr.error?.name === 'QuotaExceededError'
      ? t('store.quota')
      : t('store.error', { msg: tr.error?.message ?? t('store.unknown') })));
    tr.onabort = tr.onerror;
  });
}

const req2promise = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

// ---------- Пространства ----------

/** Список пространств (новые сверху); битые записи пропускаются */
export async function listSpaces() {
  const all = await tx('spaces', 'readonly', s => req2promise(s.getAll()));
  return all.filter(r => isValidUserId(r?.id) && r.file?.meta)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/** Загрузить пространство; файл заново проверяется валидатором (в базе мог оказаться старый или испорченный объект) */
export async function getSpace(id) {
  if (!isValidUserId(id)) return null;
  const rec = await tx('spaces', 'readonly', s => req2promise(s.get(id)));
  if (!rec) return null;
  const check = validateSpaceFile(rec.file);
  return { ...rec, check };
}

/** Сохранить пространство (file должен пройти validateSpaceFile). Возвращает id */
export async function saveSpace(file, id = null) {
  const check = validateSpaceFile(file);
  if (!check.ok) throw new Error(check.errors.join('\n'));
  const now = Date.now();
  const recId = id && isValidUserId(id) ? id : newId('u');
  const prev = id ? await tx('spaces', 'readonly', s => req2promise(s.get(recId))) : null;
  await tx('spaces', 'readwrite', s => s.put({ id: recId, createdAt: prev?.createdAt ?? now, updatedAt: now, file: check.space }));
  return recId;
}

export async function renameSpace(id, title) {
  const rec = await getSpace(id);
  if (!rec?.check.ok) throw new Error(t('store.notFound'));
  const file = { ...rec.check.space, meta: { ...rec.check.space.meta, title } };
  return saveSpace(file, id);
}

export async function deleteSpace(id) {
  if (!isValidUserId(id)) return;
  await tx('spaces', 'readwrite', s => s.delete(id));
}

// ---------- Датасеты ----------

export async function listDatasets() {
  const all = await tx('datasets', 'readonly', s => req2promise(s.getAll()));
  return all.filter(r => isValidDatasetId(r?.id)).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function getDataset(id) {
  if (!isValidDatasetId(id)) return null;
  return tx('datasets', 'readonly', s => req2promise(s.get(id)));
}

/** dataset — уже проверенный cleanDataset() объект { name, kind, ... } */
export async function saveDataset(dataset, id = null) {
  const recId = id && isValidDatasetId(id) ? id : newId('d');
  const size = JSON.stringify(dataset).length;
  await tx('datasets', 'readwrite', s => s.put({ id: recId, name: dataset.name, kind: dataset.kind, createdAt: Date.now(), size, data: dataset }));
  return recId;
}

export async function deleteDataset(id) {
  if (!isValidDatasetId(id)) return;
  await tx('datasets', 'readwrite', s => s.delete(id));
}
