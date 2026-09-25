// BERT (2018): энкодер трансформера, читающий текст в обе стороны; учится угадывать закрытые слова.
import { tokensIn, embedding, positions, block } from '../src/engine/models/transformerLayers.js';
import { demoActivations } from '../src/engine/models/libraryHelpers.js';

const N = 10, D = 768;
const blocks = block({ n: N, d: D, heads: 12, repeat: 12 });
const layers = [
  tokensIn(N, 'Текст со служебными токенами: [CLS] в начале, [SEP] в конце, [MASK] вместо закрытого слова.'),
  embedding(N, D, 30522),
  positions(N, D),
  ...blocks,
  { name: 'Слово на месте [MASK]', kind: 'output', shape: [30522], params: D * D + 30522, note: 'Для позиции [MASK] — вероятности всех слов словаря.' },
];

const EXAMPLES = [
  { name: '«Столица Франции — [MASK].»', cands: [['Париж', 0.93], ['Лион', 0.02], ['Марсель', 0.01], ['Ницца', 0.01], ['город', 0.01]] },
  { name: '«Кошка [MASK] на диване.»', cands: [['спит', 0.61], ['лежит', 0.27], ['сидит', 0.07], ['мурлычет', 0.02], ['играет', 0.01]] },
  { name: '«Я пью [MASK] с молоком.»', cands: [['кофе', 0.58], ['чай', 0.36], ['какао', 0.03], ['коктейль', 0.01], ['воду', 0.01]] },
];

export default {
  meta: {
    id: 'bert',
    title: 'BERT: понимание текста (2018)',
    category: 'library',
    order: 120,
    level: 3,
    fidelity: 'demo',
    fidelityNote: 'Архитектура BERT-base (12 блоков, 110 млн весов) точная; варианты слова — демонстрационные.',
    summary: 'Энкодер трансформера, который видит слова и слева, и справа. Обучается угадывать закрытые слова ([MASK]) и потом дообучается под любые задачи понимания.',
    uses: 'Поиск Google (понимание запросов), классификация писем и отзывов, извлечение имён и дат из документов, ответы на вопросы по тексту.',
    tags: ['NLP', 'BERT', 'Transformer', 'понимание текста', 'эмбеддинги'],
    preview: { tokens: ['[CLS]', 'кошка', '[MASK]', 'на', 'диване'] },
  },

  type: 'stack',
  layers,
  totalParams: 110000000,
  groups: [{ from: 3, to: 3 + blocks.length - 1, label: 'Энкодер ×12 (внимание в обе стороны)', color: 0xff6fa3 }],
  inputs: EXAMPLES.map(e => ({ name: e.name })),
  resultClasses: EXAMPLES[0].cands.map(c => c[0]),

  demo(img, { preset, rnd }) {
    const ex = EXAMPLES.find(e => e.name === preset?.name) ?? EXAMPLES[0];
    return { classes: ex.cands.map(c => c[0]), probs: ex.cands.map(c => c[1]), vectors: { 0: demoActivations(rnd, 10), [layers.length - 1]: ex.cands.map(c => c[1]) }, example: ex };
  },

  explainResult(r) {
    const [[w1, p1], [w2, p2]] = r.example.cands;
    return `<p>На месте [MASK] скорее всего <b>«${w1}»</b> (${Math.round(p1 * 100)}%), реже «${w2}» (${Math.round(p2 * 100)}%).
      BERT использует контекст с обеих сторон: слова <i>после</i> пропуска влияют на ответ так же, как слова до него.</p>`;
  },

  intro: `<p>GPT читает текст слева направо и пишет продолжение. BERT — наоборот, <b>только энкодер</b>: он видит всё предложение сразу
    и строит «понимающие» векторы для каждого слова. Предобучение — угадывание 15% случайно закрытых слов.
    Потом к BERT добавляют маленький слой под конкретную задачу: тональность, поиск, извлечение фактов.</p>`,
};
