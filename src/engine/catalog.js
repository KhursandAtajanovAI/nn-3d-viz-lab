// Категории каталога. Модуль без зависимостей — используется и хабом, и страницей пространства.
// Чтобы добавить категорию, достаточно дописать её сюда; пространства ссылаются на неё по id.

export const CATEGORIES = [
  { id: 'basics', title: 'Основы', icon: '◉', description: 'Как устроен нейрон, слой и прямой проход сигнала.' },
  { id: 'vision', title: 'Изображения', icon: '▦', description: 'Классификация картинок: свёртки, карты признаков, вероятности классов.' },
  { id: 'nlp', title: 'Текст (NLP)', icon: '¶', description: 'Как слова превращаются в числа: эмбеддинги, рекуррентные сети, внимание.' },
  { id: 'tasks', title: 'Другие задачи', icon: '◇', description: 'Регрессия, автоэнкодеры, рекомендации и кластеризация.' },
  { id: 'training', title: 'Обучение', icon: '↘', description: 'Градиентный спуск, обратное распространение ошибки, кривые loss.' },
  { id: 'library', title: 'Библиотека моделей', icon: '▤', description: 'Известные архитектуры и датасеты: от LeNet до Transformer.' },
];

export const categoryById = id => CATEGORIES.find(c => c.id === id);

/** Уровень сложности для бейджа карточки */
export const LEVELS = {
  1: 'Начальный',
  2: 'Средний',
  3: 'Продвинутый',
};

/** Разрешённый id пространства (он же имя файла spaces/<id>.js) */
export const isValidSpaceId = id => /^[a-z0-9][a-z0-9-]*$/.test(id ?? '');

/** Загрузить список пространств (генерируется tools/build-manifest.sh при деплое) */
export async function loadManifest(base = '') {
  const res = await fetch(`${base}spaces/manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Не удалось загрузить spaces/manifest.json (${res.status})`);
  return (await res.json()).filter(isValidSpaceId);
}
