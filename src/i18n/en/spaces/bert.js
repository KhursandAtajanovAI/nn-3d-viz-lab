export default {
  title: 'BERT: understanding text (2018)',
  fidelityNote: 'The BERT-base architecture (12 blocks, 110M weights) is exact; the word candidates are a demonstration.',
  summary: 'A transformer encoder that sees words both to the left and to the right. It is trained to guess masked words ([MASK]) and then fine-tuned for any language understanding task.',
  uses: 'Google Search (understanding queries), classifying emails and reviews, extracting names and dates from documents, answering questions about a text.',
  preview: ['[CLS]', 'cat', '[MASK]', 'on', 'sofa'],
  l: {
    out: 'Word at [MASK]',
  },
  n: {
    tokens: 'Text with special tokens: [CLS] at the start, [SEP] at the end, [MASK] in place of the hidden word.',
    out: 'For the [MASK] position — the probabilities of every word in the vocabulary.',
  },
  ex: [
    { name: '"The capital of Kazakhstan is [MASK]."', c: ['Astana', 'Almaty', 'Nur-Sultan', 'located', 'Shymkent'] },
    { name: '"The cat [MASK] on the sofa."', c: ['sleeps', 'lies', 'sits', 'purrs', 'plays'] },
    { name: '"I drink [MASK] with milk."', c: ['coffee', 'tea', 'cocoa', 'chocolate', 'water'] },
  ],
  paramsNote: 'this is the rounded number from the paper; the row sum is approximate: the table leaves out the positional embeddings and the pooler, and the output head for [MASK] is counted in a simplified way',
  group: 'Encoder ×12 (bidirectional attention)',
  explainHtml: `<p>The word at [MASK] is most likely <b>"{w1}"</b> ({p1}%), less often "{w2}" ({p2}%).
      BERT uses context on both sides: the words <i>after</i> the gap affect the answer just as much as the words before it.</p>`,
  introHtml: `<p>GPT reads text from left to right and writes a continuation. BERT is the opposite — <b>only an encoder</b>: it sees the whole sentence at once
    and builds "understanding" vectors for every word. Pretraining means guessing 15% of randomly masked words.
    Then a small layer for a specific task is added on top of BERT: sentiment, search, fact extraction.</p>`,
};
