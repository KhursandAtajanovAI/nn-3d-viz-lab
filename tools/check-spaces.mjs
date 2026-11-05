// Check space configs before deploy: node tools/check-spaces.mjs
// Imports every spaces/<id>.js from the manifest and checks the required fields and the dictionaries (ru/en).
// The check itself is in check-spaces-core.js; tools/check-spaces.html runs the same check in the browser.
// Configs must not import Three.js — otherwise the import here fails (and the catalog would become heavy).
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initI18n } from '../src/i18n/i18n.js';
import { checkSpaces } from './check-spaces-core.js';

await initI18n('ru');
const root = fileURLToPath(new URL('..', import.meta.url));
const ids = JSON.parse(await readFile(`${root}spaces/manifest.json`, 'utf8'));
const errors = await checkSpaces(ids, async id => (await import(pathToFileURL(`${root}spaces/${id}.js`).href)).default);

if (errors.length) {
  console.error(`Errors in the spaces (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Spaces OK: ${ids.length} (${ids.join(', ')})`);
