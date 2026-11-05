export default {
  title: 'GPT: a language model',
  fidelityNote: 'The GPT-2 small architecture (12 blocks, 124M weights) is exact; the continuation candidates are a demonstration.',
  summary: 'A stack of 12 masked self-attention blocks: every token sees only the previous ones. The output is a probability for each of the 50,257 possible next tokens.',
  uses: 'Chatbots and assistants, writing and editing text, programming (code autocomplete), translation, question answering.',
  preview: ['Spring', 'steppe', 'blooms', '?'],
  l: {
    norm: 'Norm',
    out: 'Next token',
  },
  n: {
    out: 'Softmax over the whole vocabulary. The output layer shares its weights with the embedding table.',
  },
  ex: [
    { name: '"In spring the Kazakh steppe is covered with…"', c: ['tulips', 'poppies', 'snowdrops', 'flowers', 'irises'] },
    { name: '"The capital of Kazakhstan is the city of…"', c: ['Astana', 'Almaty', 'Nur-Sultan', 'the', 'a'] },
    { name: '"def add(a, b): return…"', c: ['a + b', 'a', 'sum', '(a', 'b + a'] },
  ],
  paramsNote: 'the table leaves out the positional embeddings (1024 × 768 = 786,432) and the second normalization in each of the 12 blocks (12 × 1,536 = 18,432) — together exactly 804,864, the whole difference',
  group: 'Decoder ×12 (masked attention)',
  explainHtml: `<p>The most likely continuation is <b>"{word}"</b> ({p}%).
      The model picks a token (not necessarily the most likely one — "temperature" adds variety), appends it to the text and repeats everything again.
      This is how a chatbot writes its whole answer — one token at a time.</p>`,
  introHtml: `<p>GPT (Generative Pre-trained Transformer) is just the <b>decoder</b> of a transformer. It is trained on a single task: guess the next token from the beginning of a text.
    On billions of pages this simple task teaches the model grammar, facts and even programming.
    GPT-2 small has 124M weights; GPT-3 has 175B, and modern models have even more.</p>`,
  chatTitle: 'How "guess the word" becomes a chatbot',
  chatHtml: `<ol class="steps">
        <li><b>Pretraining</b>: next-token prediction on a huge corpus of text.</li>
        <li><b>Fine-tuning on dialogues</b>: the model learns to answer in a "question — answer" format.</li>
        <li><b>RLHF</b>: people rate the answers, and the model is fine-tuned with reinforcement learning to give more helpful ones.</li>
      </ol>`,
};
