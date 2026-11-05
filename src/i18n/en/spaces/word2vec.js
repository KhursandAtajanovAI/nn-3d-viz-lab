export default {
  title: 'Word2Vec: words as points in space',
  fidelityNote: 'The vectors are three-dimensional and set by hand along meaning directions rather than learned from text. The vector arithmetic and the neighbor search are real.',
  summary: 'Words with similar meanings end up close together, and vector differences encode relations: khan − man + woman ≈ khanum.',
  uses: 'Semantic search, recommendations, synonym suggestions; embeddings are the input layer of almost every language model.',
  resultTitle: 'Computation',
  w: {
    man: 'man', woman: 'woman', khan: 'khan', khanum: 'khanum', boy: 'boy', girl: 'girl', sultan: 'sultan', khanzada: 'khanzada',
    kz: 'Kazakhstan', uz: 'Uzbekistan', kg: 'Kyrgyzstan', tj: 'Tajikistan',
    astana: 'Astana', tashkent: 'Tashkent', bishkek: 'Bishkek', dushanbe: 'Dushanbe',
    camel: 'camel', sheep: 'sheep', eagle: 'golden eagle', horse: 'horse',
    camelCalf: 'camel calf', lamb: 'lamb', eaglet: 'eaglet', foal: 'foal',
    apple: 'apple', kurt: 'kurt', beshbarmak: 'beshbarmak', flatbread: 'flatbread', baursak: 'baursak',
    car: 'car', bus: 'bus', train: 'train', plane: 'plane',
  },
  group: { people: 'people', countries: 'countries', capitals: 'capitals', animals: 'animals', cubs: 'young animals', food: 'food', transport: 'transport' },
  status: '{n} words in a 3D space of meanings',
  analogyLabel: 'Analogy: A − B + C ≈ ?',
  pick: '— choose —',
  analogy: '{a} − {b} + {c}',
  diff: '{a} − {b}',
  calcTitle: 'Computation result',
  nearestWord: 'Nearest word: <b>{w}</b>',
  analogyHtml: 'The word nearest to this point is <b class="pos">"{best}"</b> (distance {d}), the next one is "{second}" ({d2}).',
  parallelNote: 'The orange arrows are parallel: "{b} → {a}" and "{c} → ?" are the same meaning direction. This is how embeddings "understand" relations between words.',
  wordLabel: 'Word neighbors',
  pickWord: '— choose a word —',
  neighborsHtml: 'Words nearest to "{w}": {list}.',
  distNote: 'Closeness is the distance between points. Real models more often use cosine similarity — the angle between vectors.',
  quoted: '"{w}"',
  groupInfo: 'Group: <b>{g}</b>',
  vector: 'Vector:',
  nearest: 'Nearest: {list}',
  legendHtml: `<ul class="legend">
      <li><span class="dot glow-pos"></span><span><b>A point is a word</b>; the color is its meaning group (people, countries, capitals, animals…).</span></li>
      <li><span class="line pos"></span><span><b>Orange arrows</b> are vector differences (for example, "man → khan" = "ruler's title").</span></li>
      <li><span class="line neg"></span><span><b>Blue lines</b> are the nearest neighbors of the chosen word.</span></li>
    </ul>`,
  introHtml: `<p>Word2Vec (Google, 2013) learns from a huge text corpus: words that appear in similar contexts get similar vectors.
    Here there are 33 words in three dimensions so they can be drawn. Pick an analogy or a word under "Controls".</p>`,
  simplifiedTitle: 'What is simplified here',
  simplifiedHtml: `<p>Real Word2Vec vectors have 100–300 dimensions and are learned from billions of words; they cannot be drawn without compression (PCA, t-SNE),
        and analogies in them hold only approximately. Here the vectors are three-dimensional and built by hand along meaning directions
        ("gender", "title", "young", "capital") with a little noise — but the arithmetic and the neighbor search are real.</p>`,
};
