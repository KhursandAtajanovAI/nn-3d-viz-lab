export default {
  title: 'Transformer: attention is all you need (2017)',
  fidelityNote: 'The "Transformer base" architecture (6 + 6 blocks) is exact. The original has ≈65M weights; the table counts the output layer separately, so the row sum is about 82M. The translation candidates are a demonstration.',
  summary: 'An encoder of 6 blocks reads the source phrase, and a decoder of 6 blocks writes the translation word by word, "peeking" into the encoder through cross-attention.',
  uses: 'Machine translation; the architecture became the basis of GPT, BERT, image models (ViT), speech, proteins (AlphaFold) — almost all of modern AI.',
  preview: ['I', 'love', 'cats', '→', "J'aime"],
  decoderLabel: ' (decoder)',
  n: {
    tokens: 'The source phrase in English, split into tokens.',
    out: 'Probabilities of the next word of the translation over the whole vocabulary.',
  },
  ex: [
    { name: 'I love cats → «J\'aime les ___»', c: ['chats', 'chatons', 'chiens', 'animaux', 'oiseaux'] },
    { name: 'the weather is nice today → «Il fait ___»', c: ['beau', 'chaud', 'bon', 'très', 'soleil'] },
    { name: 'where is the train station? → «Où ___»', c: ['est', 'se', 'puis', 'sont', 'gare'] },
  ],
  paramsNote: 'the difference comes mostly from the "Linear + softmax" layer (18,944,000 weights): in the original it shares weights with the embedding table and is not counted separately. Without it the row sum is 63,064,064; the remaining gap is because the row sum is approximate',
  groupEnc: 'Encoder ×6',
  groupDec: 'Decoder ×6',
  skip: 'encoder output → cross-attention',
  explainHtml: `<p>Next word of the translation: <b>"{word}"</b> ({p}%).
      Then it is appended to the translation, and the decoder predicts the next one — this is how the whole phrase is built, word by word.</p>
      <p class="small muted">To see how attention itself works — with real weights and arcs — open the <a href="space.html?id=next-word">"Autocomplete and attention"</a> space.</p>`,
  introHtml: `<p>Before 2017 translation was done by recurrent networks that read words one at a time. A transformer processes all words <b>at once</b>:
    through <b>self-attention</b> every word looks at all the others. This is faster and captures long-range dependencies better.
    Pink blocks are attention, purple ones are fully connected layers, teal ones are normalization with a residual connection.</p>`,
};
