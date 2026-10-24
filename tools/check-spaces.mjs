// Проверка конфигов пространств перед деплоем: node tools/check-spaces.mjs
// Импортирует каждый spaces/<id>.js из манифеста и проверяет обязательные поля.
// Сама проверка — в check-spaces-core.js; в браузере ту же проверку запускает tools/check-spaces.html.
// Конфиги не должны импортировать Three.js — иначе импорт здесь упадёт (и каталог станет тяжёлым).
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkSpaces } from './check-spaces-core.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const ids = JSON.parse(await readFile(`${root}spaces/manifest.json`, 'utf8'));
const errors = await checkSpaces(ids, async id => (await import(pathToFileURL(`${root}spaces/${id}.js`).href)).default);

if (errors.length) {
  console.error(`Ошибки в пространствах (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Пространства в порядке: ${ids.length} (${ids.join(', ')})`);
