// Transformer (2017): «Attention is all you need» — энкодер и декодер на внимании, без рекуррентности.
import { tokensIn, embedding, positions, block } from '../src/engine/models/transformerLayers.js';
import { demoActivations } from '../src/engine/models/libraryHelpers.js';

const N = 8, D = 512;
const encoder = block({ n: N, d: D, heads: 8, repeat: 6 });
const decoder = block({ n: N, d: D, heads: 8, repeat: 6, masked: true, cross: true, label: ' (декодер)' });
const layers = [
  tokensIn(N, 'Исходная фраза на русском, разрезанная на токены.'),
  embedding(N, D, 37000),
  positions(N, D),
  ...encoder,
  ...decoder,
  { name: 'Linear + softmax', kind: 'output', shape: [37000], params: D * 37000, note: 'Вероятности следующего слова перевода по всему словарю.' },
];

const EXAMPLES = [
  { name: 'я люблю кошек → «I love ___»', cands: [['cats', 0.78], ['kittens', 0.09], ['dogs', 0.03], ['my', 0.03], ['the', 0.02]] },
  { name: 'сегодня хорошая погода → «The weather ___»', cands: [['is', 0.83], ['today', 0.06], ['was', 0.04], ['looks', 0.03], ['seems', 0.02]] },
  { name: 'где находится вокзал? → «Where ___»', cands: [['is', 0.91], ['the', 0.03], ['can', 0.02], ['do', 0.01], ['station', 0.01]] },
];

export default {
  meta: {
    id: 'transformer',
    title: 'Transformer: внимание — всё, что нужно (2017)',
    category: 'library',
    order: 100,
    level: 3,
    fidelity: 'demo',
    fidelityNote: 'Архитектура «Transformer base» (6 + 6 блоков, 65 млн весов) точная; варианты перевода — демонстрационные.',
    summary: 'Энкодер из 6 блоков читает исходную фразу, декодер из 6 блоков пишет перевод слово за словом, «заглядывая» в энкодер через cross-attention.',
    uses: 'Машинный перевод; архитектура стала основой GPT, BERT, моделей для изображений (ViT), речи, белков (AlphaFold) — почти всего современного ИИ.',
    tags: ['NLP', 'Transformer', 'attention', 'перевод', 'энкодер-декодер'],
    preview: { tokens: ['я', 'люблю', 'кошек', '→', 'I'] },
  },

  type: 'stack',
  layers,
  totalParams: 65000000,
  groups: [
    { from: 3, to: 3 + encoder.length - 1, label: 'Энкодер ×6', color: 0xff6fa3 },
    { from: 3 + encoder.length, to: 3 + encoder.length + decoder.length - 1, label: 'Декодер ×6', color: 0xb48cff },
  ],
  skips: [{ from: 3 + encoder.length - 1, to: 3 + encoder.length + 1, label: 'выход энкодера → cross-attention' }],
  inputs: EXAMPLES.map(e => ({ name: e.name })),
  resultClasses: EXAMPLES[0].cands.map(c => c[0]),

  demo(img, { preset, rnd }) {
    const ex = EXAMPLES.find(e => e.name === preset?.name) ?? EXAMPLES[0];
    return { classes: ex.cands.map(c => c[0]), probs: ex.cands.map(c => c[1]), vectors: { 0: demoActivations(rnd, 8), [layers.length - 1]: ex.cands.map(c => c[1]) }, example: ex };
  },

  explainResult(r) {
    return `<p>Следующее слово перевода: <b>«${r.example.cands[0][0]}»</b> (${Math.round(r.example.cands[0][1] * 100)}%).
      Затем оно добавится к переводу, и декодер предскажет следующее — так, слово за словом, строится вся фраза.</p>
      <p class="small muted">Как устроено само внимание — с настоящими весами и дугами — смотрите в пространстве <a href="space.html?id=next-word">«Автодополнение и внимание»</a>.</p>`;
  },

  intro: `<p>До 2017 года перевод делали рекуррентными сетями, которые читают слова по одному. Трансформер обрабатывает все слова <b>одновременно</b>:
    каждое слово через <b>self-attention</b> смотрит на все остальные. Это быстрее и лучше учитывает дальние связи.
    Розовые блоки — внимание, фиолетовые — полносвязные слои, бирюзовые — нормализация с остаточной связью.</p>`,
};
