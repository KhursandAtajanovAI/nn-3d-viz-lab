// GPT (на примере GPT-2 small): только декодер трансформера, предсказывает следующий токен.
import { tokensIn, embedding, positions, block } from '../src/engine/models/transformerLayers.js';
import { demoActivations } from '../src/engine/models/libraryHelpers.js';

const N = 10, D = 768;
const blocks = block({ n: N, d: D, heads: 12, repeat: 12, masked: true });
const layers = [
  tokensIn(N),
  embedding(N, D, 50257),
  positions(N, D),
  ...blocks,
  { name: 'Норма', kind: 'norm', shape: [N, D], params: 2 * D },
  { name: 'Следующий токен', kind: 'output', shape: [50257], params: 0, note: 'Softmax по всему словарю. Веса выходного слоя общие с таблицей эмбеддингов.' },
];

const EXAMPLES = [
  { name: '«Однажды в студёную зимнюю…»', cands: [['пору', 0.71], ['ночь', 0.1], ['погоду', 0.06], ['стужу', 0.04], ['вьюгу', 0.03]] },
  { name: '«Столица России — город…»', cands: [['Москва', 0.88], ['Санкт-Петербург', 0.04], ['с', 0.02], ['федерального', 0.02], ['который', 0.01]] },
  { name: '«def add(a, b): return…»', cands: [['a + b', 0.82], ['a', 0.05], ['sum', 0.04], ['(a', 0.03], ['b + a', 0.02]] },
];

export default {
  meta: {
    id: 'gpt',
    title: 'GPT: языковая модель',
    category: 'library',
    order: 110,
    level: 3,
    fidelity: 'demo',
    fidelityNote: 'Архитектура GPT-2 small (12 блоков, 124 млн весов) точная; варианты продолжения — демонстрационные.',
    summary: 'Стопка из 12 блоков маскированного self-attention: каждый токен видит только предыдущие. На выходе — вероятность каждого из 50 257 возможных следующих токенов.',
    uses: 'Чат-боты и ассистенты, написание и редактирование текстов, программирование (автодополнение кода), перевод, ответы на вопросы.',
    tags: ['NLP', 'GPT', 'Transformer', 'генерация текста', 'LLM'],
    preview: { tokens: ['Однажды', 'в', 'зимнюю', '?'] },
  },

  type: 'stack',
  layers,
  totalParams: 124439808,
  groups: [{ from: 3, to: 3 + blocks.length - 1, label: 'Декодер ×12 (маскированное внимание)', color: 0xff6fa3 }],
  inputs: EXAMPLES.map(e => ({ name: e.name })),
  resultClasses: EXAMPLES[0].cands.map(c => c[0]),

  demo(img, { preset, rnd }) {
    const ex = EXAMPLES.find(e => e.name === preset?.name) ?? EXAMPLES[0];
    return { classes: ex.cands.map(c => c[0]), probs: ex.cands.map(c => c[1]), vectors: { 0: demoActivations(rnd, 10), [layers.length - 1]: ex.cands.map(c => c[1]) }, example: ex };
  },

  explainResult(r) {
    return `<p>Самое вероятное продолжение — <b>«${r.example.cands[0][0]}»</b> (${Math.round(r.example.cands[0][1] * 100)}%).
      Модель выбирает токен (не обязательно самый вероятный — для разнообразия есть «температура»), дописывает его к тексту и повторяет всё снова.
      Так пишется весь ответ чат-бота — по одному токену.</p>`;
  },

  intro: `<p>GPT (Generative Pre-trained Transformer) — это только <b>декодер</b> трансформера. Его учат одной задаче: по началу текста угадать следующий токен.
    На миллиардах страниц эта простая задача учит модель грамматике, фактам и даже программированию.
    GPT-2 small — 124 млн весов; GPT-3 — 175 млрд, у современных моделей ещё больше.</p>`,

  sections: [{
    title: 'Как из «угадай слово» получается чат-бот',
    open: false,
    html: `<ol class="steps">
        <li><b>Предобучение</b>: предсказание следующего токена на огромном корпусе текстов.</li>
        <li><b>Дообучение на диалогах</b>: модель учится отвечать в формате «вопрос — ответ».</li>
        <li><b>RLHF</b>: люди оценивают ответы, и модель дообучается с подкреплением давать более полезные.</li>
      </ol>`,
  }],
};
