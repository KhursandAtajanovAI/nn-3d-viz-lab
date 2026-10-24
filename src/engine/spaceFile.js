// Экспорт и импорт файла пространства (*.nn3d.json): скачивание через Blob и чтение файла,
// выбранного пользователем. Импортированный файл проходит общий валидатор и сохраняется как новое
// пространство в «Мои»; неизвестные поля отбрасываются.
import { LIMITS, parseSpaceFileText, validateSpaceFile } from './spaceFormat.js';
import { saveSpace } from './userStore.js';

/** Имя файла из названия: буквы, цифры и дефисы */
function fileName(title) {
  const slug = String(title ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${slug || 'space'}.nn3d.json`;
}

/** Скачать файл пространства */
export function downloadSpaceFile(file) {
  const check = validateSpaceFile(file);
  if (!check.ok) throw new Error(`Файл не прошёл проверку: ${check.errors[0]}`);
  const text = JSON.stringify({ ...check.space, exportedAt: new Date().toISOString() });
  if (text.length > LIMITS.fileBytes) throw new Error(`Пространство слишком большое для файла (${(text.length / 1048576).toFixed(1)} МБ)`);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(check.space.meta.title);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Прочитать выбранный файл, проверить и сохранить как новое пространство.
 * @returns {Promise<{ id: string, title: string, warnings: string[] }>}
 * @throws Error с понятным текстом (несколько ошибок — через перевод строки)
 */
export async function importSpaceFile(f) {
  if (!f) throw new Error('Файл не выбран');
  if (f.size > LIMITS.fileBytes) {
    throw new Error(`Файл слишком большой: ${(f.size / 1048576).toFixed(1)} МБ, допустимо до ${LIMITS.fileBytes / 1048576} МБ`);
  }
  let text;
  try { text = await f.text(); } catch { throw new Error('Не удалось прочитать файл'); }
  const check = parseSpaceFileText(text);
  if (!check.ok) throw new Error(`Файл «${f.name}» не открыт:\n${check.errors.join('\n')}`);
  const id = await saveSpace(check.space);
  return { id, title: check.space.meta.title, warnings: check.warnings };
}

/** Невидимый input[type=file]; onFile вызывается с выбранным File */
export function pickFile(onFile, accept = '.json,application/json') {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); });
  input.click();
}
