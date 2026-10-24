// Типы слоёв для визуализатора архитектур (type: 'stack'): цвет блока, название и объяснение.
// Без зависимостей — используется сценой, легендой, панелью и проверкой конфигов.

export const KINDS = {
  input: { title: 'Вход', color: 0x8a9ab3, info: 'Исходные данные: пиксели картинки, номера слов или числа. Сеть ничего здесь не вычисляет.' },
  noise: { title: 'Случайный шум', color: 0x8a9ab3, info: 'Вектор случайных чисел z — «зерно», из которого генератор строит картинку. Разный шум → разные картинки.' },
  conv: { title: 'Свёртка', color: 0xff9f1c, info: 'Маленький фильтр (например, 3×3) скользит по карте и в каждой точке считает взвешенную сумму соседних пикселей. Каждый канал — отдельный фильтр, который ищет свой признак: край, угол, текстуру.' },
  dwconv: { title: 'Depthwise-свёртка', color: 0xffb347, info: 'Облегчённая свёртка: каждый канал фильтруется отдельно, а потом каналы смешиваются свёрткой 1×1. Почти то же качество при в 8–9 раз меньшем числе вычислений.' },
  deconv: { title: 'Разворачивающая свёртка', color: 0xffc46b, info: 'Транспонированная свёртка («деконволюция»): увеличивает карту в размерах. Используется, когда из сжатого представления нужно снова получить картинку.' },
  pool: { title: 'Пулинг', color: 0x2f9bff, info: 'Уменьшает карту: из каждого квадрата 2×2 оставляет максимум (max-pooling) или среднее. Сеть становится устойчивее к небольшим сдвигам и считает быстрее.' },
  norm: { title: 'Нормализация', color: 0x5ad1b3, info: 'Приводит значения к среднему 0 и разбросу 1 (BatchNorm, LayerNorm). Так глубокие сети учатся заметно стабильнее.' },
  add: { title: 'Сложение (skip)', color: 0x2f9bff, info: 'Остаточное соединение: к выходу блока прибавляется его же вход. Сигнал и градиент могут «перепрыгнуть» блок — поэтому сети в сотни слоёв вообще обучаются.' },
  concat: { title: 'Объединение', color: 0x5ad1b3, info: 'Склейка карт признаков из разных веток по каналам (как в U-Net и Inception).' },
  inception: { title: 'Inception-модуль', color: 0xff9f1c, info: 'Несколько свёрток разного размера (1×1, 3×3, 5×5) и пулинг работают параллельно, а их выходы склеиваются. Сеть сама выбирает подходящий масштаб признаков.' },
  flatten: { title: 'Выпрямление', color: 0x6b7385, info: 'Трёхмерная карта признаков (высота × ширина × каналы) вытягивается в один длинный вектор, чтобы передать его полносвязным слоям.' },
  dense: { title: 'Полносвязный', color: 0xb48cff, info: 'Каждый нейрон связан со всеми нейронами предыдущего слоя: взвешенная сумма + функция активации. Здесь признаки комбинируются в решение.' },
  dropout: { title: 'Dropout', color: 0x6b7385, info: 'Во время обучения случайно «выключает» часть нейронов, чтобы сеть не заучивала примеры наизусть. При работе ничего не меняет.' },
  embed: { title: 'Эмбеддинг', color: 0xffd166, info: 'Таблица векторов: каждому слову (токену) соответствует строка чисел. Близкие по смыслу слова получают близкие векторы.' },
  posenc: { title: 'Позиции', color: 0xffd166, info: 'К векторам слов прибавляется информация о позиции в предложении — иначе self-attention не отличил бы «кот ест рыбу» от «рыбу ест кот».' },
  attention: { title: 'Self-attention', color: 0xff6fa3, info: 'Каждое слово «смотрит» на все остальные и решает, какие из них важны для его смысла (веса внимания). Затем собирает их векторы с этими весами.' },
  ffn: { title: 'Feed-forward', color: 0xb48cff, info: 'Два полносвязных слоя, применяемые к каждой позиции отдельно: расширение (обычно ×4) и сжатие обратно.' },
  rnn: { title: 'Рекуррентный слой', color: 0x5ad1b3, info: 'Обрабатывает последовательность по одному элементу и передаёт «память» (скрытое состояние) на следующий шаг.' },
  latent: { title: 'Скрытое представление', color: 0xffd166, info: 'Самое узкое место сети — сжатый код данных. Всё, что сеть «запомнила» о входе, должно поместиться сюда.' },
  sample: { title: 'Сэмплирование', color: 0xffd166, info: 'Вариационный автоэнкодер предсказывает не точку, а распределение (среднее μ и разброс σ) и берёт из него случайную точку z = μ + σ·ε.' },
  heads: { title: 'Головы детекции', color: 0x7ee081, info: 'Для каждой клетки сетки предсказываются рамки объектов, уверенность и класс.' },
  output: { title: 'Выход', color: 0x7ee081, info: 'Итог работы сети: вероятности классов (softmax), число или картинка.' },
};

/**
 * Описание вида слоя: сначала свои виды пространства (поле kinds в конфиге), затем встроенные.
 * Неизвестный вид рисуется как полносвязный — так старое поведение не меняется.
 */
export const kindInfo = (kind, custom = null) => customKind(custom, kind) ?? KINDS[kind] ?? KINDS.dense;

/** Свой вид слоя из конфига → { title, color (число 0xRRGGBB), info } или null */
function customKind(custom, kind) {
  const k = custom && Object.prototype.hasOwnProperty.call(custom, kind) ? custom[kind] : null;
  if (!k || typeof k !== 'object') return null;
  return { title: String(k.title ?? kind), color: parseColor(k.color) ?? 0x8a9ab3, info: String(k.info ?? '') };
}

/** Цвет: число 0xRRGGBB или строка «#rrggbb» / «#rgb» */
export function parseColor(c) {
  if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 0xffffff) return c;
  if (typeof c !== 'string') return null;
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return parseInt(m[1], 16);
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  return m ? parseInt(m[1] + m[1] + m[2] + m[2] + m[3] + m[3], 16) : null;
}

/**
 * Проверка своих видов слоёв (поле kinds конфига stack). Возвращает список ошибок.
 * Нужны: id латиницей, название; цвет — 0xRRGGBB или «#rrggbb»; пояснение — по желанию.
 */
export function checkCustomKinds(kinds) {
  if (kinds === undefined) return [];
  if (!kinds || typeof kinds !== 'object' || Array.isArray(kinds)) return ['kinds: нужен объект { id: { title, color, info } }'];
  const errors = [];
  for (const [id, k] of Object.entries(kinds)) {
    if (!/^[a-z][a-zA-Z0-9-]{0,30}$/.test(id)) errors.push(`kinds.${id}: id — латиница, цифры и дефис`);
    else if (KINDS[id]) errors.push(`kinds.${id}: такой вид уже есть среди встроенных — выберите другой id`);
    if (!k || typeof k !== 'object') { errors.push(`kinds.${id}: нужен объект { title, color, info }`); continue; }
    if (typeof k.title !== 'string' || !k.title.trim()) errors.push(`kinds.${id}: не заполнено title`);
    if (k.color !== undefined && parseColor(k.color) === null) errors.push(`kinds.${id}: цвет — число 0xRRGGBB или строка "#rrggbb"`);
    if (k.info !== undefined && typeof k.info !== 'string') errors.push(`kinds.${id}: info — строка`);
  }
  return errors;
}

/** Форма тензора по-человечески: [28, 28, 6] → «28×28×6» */
export const formatShape = shape => shape.join('×');

export const shapeSize = shape => shape.reduce((a, b) => a * b, 1);

/**
 * Число обучаемых параметров слоя по формам (если в конфиге не задано явно поле params).
 * conv: (k·k·C_in + 1)·C_out, dense: (N_in + 1)·N_out, остальные — 0.
 */
export function layerParams(layer, prev) {
  if (layer.params !== undefined) return layer.params;
  if (!prev) return 0;
  const out = layer.shape;
  switch (layer.kind) {
    case 'conv':
    case 'deconv': {
      const k = layer.kernel ?? 3, cin = prev.shape.at(-1), cout = out.at(-1);
      return (k * k * cin + 1) * cout;
    }
    case 'dwconv': {
      const k = layer.kernel ?? 3, cin = prev.shape.at(-1), cout = out.at(-1);
      return k * k * cin + (cin + 1) * cout;
    }
    case 'dense':
    case 'output':
      return (shapeSize(prev.shape) + 1) * shapeSize(out);
    case 'norm':
      return 2 * out.at(-1);
    default:
      return 0;
  }
}

/** 1234567 → «1,2 млн» */
export function formatCount(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} млрд`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} млн`;
  if (n >= 1e4) return `${Math.round(n / 1e3)} тыс.`;
  return n.toLocaleString('ru-RU');
}
