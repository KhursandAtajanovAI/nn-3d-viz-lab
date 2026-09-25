// Общие описания слоёв для трансформеров (Transformer, GPT, BERT) — чтобы не повторять одно и то же.

export const tokensIn = (n, note) => ({ name: 'Токены', kind: 'input', shape: [n], note: note ?? 'Текст, разрезанный на токены (слова и их части). Каждый токен — номер в словаре.' });

export const embedding = (n, d, vocab) => ({
  name: 'Эмбеддинги', kind: 'embed', shape: [n, d], params: vocab * d,
  note: `Таблица ${vocab.toLocaleString('ru-RU')} × ${d}: каждому токену — вектор из ${d} чисел.`,
});

export const positions = (n, d) => ({ name: 'Позиции', kind: 'posenc', shape: [n, d], note: 'К каждому вектору прибавляется «код позиции», чтобы сеть знала порядок слов.' });

/** Блок трансформера: внимание + норма + feed-forward (+ норма). repeat — сколько таких блоков подряд */
export function block({ n, d, heads, repeat, masked = false, cross = false, label = '' }) {
  const attnParams = 4 * d * d + 4 * d;
  const ffnParams = 2 * d * 4 * d + 5 * d;
  const layers = [
    { name: `${masked ? 'Маскированное ' : ''}self-attention${label}`, kind: 'attention', shape: [n, d], repeat, params: attnParams * repeat,
      note: `${heads} «голов» внимания работают параллельно.${masked ? ' Маска запрещает смотреть на будущие слова — модель не должна подглядывать в ответ.' : ''}` },
  ];
  if (cross) layers.push({ name: `Cross-attention${label}`, kind: 'attention', shape: [n, d], repeat, params: attnParams * repeat, note: 'Декодер «смотрит» на выход энкодера — так перевод опирается на исходную фразу.' });
  layers.push(
    { name: `Add & Norm${label}`, kind: 'norm', shape: [n, d], repeat, params: 2 * d * repeat, note: 'Остаточная связь (вход + выход) и нормализация слоя.' },
    { name: `Feed-forward${label}`, kind: 'ffn', shape: [n, 4 * d], repeat, params: ffnParams * repeat, note: `Два полносвязных слоя для каждого токена: ${d} → ${4 * d} → ${d}.` },
  );
  return layers;
}
