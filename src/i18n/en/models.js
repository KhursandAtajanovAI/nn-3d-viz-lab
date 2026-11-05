// Shared models: convolution filters, image classes, synthetic classifiers, transformer layers, text.
export default {
  cnn: {
    f: [
      { name: 'Vertical edges', desc: 'responds to a "dark → light" transition from left to right' },
      { name: 'Horizontal edges', desc: 'responds to a "dark → light" transition from top to bottom' },
      { name: 'Diagonal ↘', desc: 'responds to slanted lines from top-left to bottom-right' },
      { name: 'Diagonal ↗', desc: 'responds to slanted lines from bottom-left to top-right' },
      { name: 'Spot / dot', desc: 'responds to small bright spots and stroke ends (center minus surround)' },
      { name: 'Blur (brightness)', desc: 'averages the brightness around a point — shows where there is any "ink" at all' },
    ],
    combo: 'Combination of channels {a} and {b}',
  },
  gen: {
    fashion: ['T-shirt', 'Trousers', 'Pullover', 'Dress', 'Coat', 'Sandal', 'Shirt', 'Sneaker', 'Bag', 'Ankle boot'],
    cifar: ['Airplane', 'Automobile', 'Bird', 'Cat', 'Deer', 'Dog', 'Frog', 'Horse', 'Ship', 'Truck'],
  },
  sv: {
    colorNote: ' The vector also includes the average colors of the image over 4×4 patches (48 numbers): the convolutions here look at brightness, and color helps to tell, say, a frog from a ship.',
    input: 'Input',
    inputColor: 'A 32×32 color image: three channels — red, green, blue.',
    inputGray: 'A 28×28 grayscale image: 784 numbers from 0 (black) to 1 (white).',
    conv1: 'Convolution 1 + ReLU',
    conv1Note: 'Six 5×5 filters set by hand — classic edge detectors. In real networks such filters emerge by themselves during training (see the "How it works" card).',
    pool1: 'Pooling 1',
    pool1Note: '2×2 max pooling: the map is halved along each side.',
    conv2: 'Convolution 2 + ReLU',
    conv2Desc: 'adds up two channels of the first layer with fixed random weights — producing more complex combinations of features',
    conv2Note: 'Eight 3×3 filters, each looking at a pair of first-layer channels. The weights are fixed (random) — this is a working technique too: "random features".',
    pool2: 'Pooling 2',
    flat: 'Feature vector',
    flatNote: 'All maps are flattened into one vector of {n} numbers.{color}',
    hidden: 'Hidden layer (ReLU)',
    hiddenNote: 'Trained in the browser: combines features into "concepts" such as "a closed loop at the top".',
    out: 'Probabilities (softmax)',
    outNote: 'Softmax turns the outputs into probabilities that add up to 100%. Trained in the browser.',
    howTitle: 'How it works',
    howHtml: `
  <ol class="steps">
    <li><b>Convolutions</b> scan the image with small filters and build <b>feature maps</b>: where there are vertical edges, horizontal edges, spots.</li>
    <li><b>Pooling</b> shrinks the maps, keeping the strongest responses — the network becomes robust to small shifts.</li>
    <li>The second convolution layer combines simple features into more complex ones.</li>
    <li>The maps are <b>flattened</b> into a vector, and the <b>fully connected layers</b> turn it into class probabilities.</li>
  </ol>
  <p class="muted small">What is real here: all convolutions, poolings and probabilities are actually computed for your image.
    What is simplified: the convolution filters are set by hand, and the fully connected layers are trained right when the page opens
    on <b>synthetic</b> images (drawn by a program) rather than on the real dataset — that one weighs tens of megabytes.
    The accuracy on new synthetic images is shown in the status line.</p>`,
    sureHigh: 'is confident',
    sureMid: 'is fairly confident',
    sureLow: 'is unsure',
    explainHtml: `<p>The network {sure} that this is <b>"{c1}"</b> ({p1}%). The second option is "{c2}" ({p2}%).
      The probabilities come from the last layer through softmax and add up to 100%.</p>`,
  },
  tf: {
    tokens: 'Tokens',
    tokensNote: 'Text split into tokens (words and word pieces). Each token is an id in the vocabulary.',
    embed: 'Embeddings',
    embedNote: 'A {vocab} × {d} table: every token gets a vector of {d} numbers.',
    pos: 'Positions',
    posNote: 'A "position code" is added to every vector so the network knows the word order.',
    selfAttn: 'Self-attention{label}',
    maskedAttn: 'Masked self-attention{label}',
    heads: '{n} attention "heads" work in parallel.',
    headsMasked: '{n} attention "heads" work in parallel. The mask forbids looking at future words — the model must not peek at the answer.',
    cross: 'Cross-attention{label}',
    addNorm: 'Add & Norm{label}',
    ffn: 'Feed-forward{label}',
    crossNote: 'The decoder "looks" at the encoder output — this is how a translation relies on the source phrase.',
    normNote: 'Residual connection (input + output) and layer normalization.',
    ffnNote: 'Two fully connected layers for every token: {d} → {d4} → {d}.',
  },
  txt: {
    word: 'word',
    adjEndings: '',
    adjBases: '',
  },
};
