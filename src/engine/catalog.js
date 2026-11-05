// Категории каталога. Используется и хабом, и страницей пространства; тексты — в словарях (cat.*, level.*, fid.*).
import { L, t } from '../i18n/i18n.js';

// Чтобы добавить категорию, достаточно дописать её сюда; пространства ссылаются на неё по id.

export const CATEGORIES = [
  { id: 'basics', icon: '◉' },
  { id: 'vision', icon: '▦' },
  { id: 'nlp', icon: '¶' },
  { id: 'tasks', icon: '◇' },
  { id: 'training', icon: '↘' },
  { id: 'library', icon: '▤' },
  // Пространства пользователя (IndexedDB): отдельный блок «Мои» в каталоге, в фильтрах встроенных не участвует
  { id: 'user', icon: '✎', user: true },
].map(c => ({ ...c, title: L(`cat.${c.id}.title`), description: L(`cat.${c.id}.description`) }));

export const categoryById = id => CATEGORIES.find(c => c.id === id);

/** Уровень сложности для бейджа карточки (тексты — в словаре, level.1 …) */
export const LEVELS = { 1: L('level.1'), 2: L('level.2'), 3: L('level.3') };

/**
 * Насколько «настоящие» вычисления в пространстве — честная пометка на карточке и в шапке.
 *   real    — все числа реально вычисляются по показанным весам/формулам
 *   trained — сеть обучается прямо в браузере (на синтетических данных)
 *   demo    — упрощённая иллюстрация архитектуры: структура верная, выходы демонстрационные
 */
export const FIDELITY = Object.fromEntries(['real', 'trained', 'demo'].map(id => [id, { title: L(`fid.${id}.title`), hint: L(`fid.${id}.hint`) }]));

/** Разрешённый id пространства (он же имя файла spaces/<id>.js) */
export const isValidSpaceId = id => /^[a-z0-9][a-z0-9-]*$/.test(id ?? '');

/** Загрузить список пространств (генерируется tools/build-manifest.sh при деплое) */
export async function loadManifest(base = '') {
  const res = await fetch(`${base}spaces/manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(t('catalog.manifestFailed', { status: res.status }));
  return (await res.json()).filter(isValidSpaceId);
}
