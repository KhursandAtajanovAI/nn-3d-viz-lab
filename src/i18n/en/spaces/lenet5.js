export default {
  fidelityNote: 'The LeNet-5 architecture is exact. The maps of the first two layers are really computed on your image (edge-detector filters); the later layers and the answer are a demonstration.',
  summary: "Yann LeCun's network: two convolutions with pooling and three fully connected layers — just 61 thousand weights. The ancestor of every modern CNN.",
  uses: 'In the 1990s it read handwritten amounts on millions of bank checks in the US; today it is the textbook reference convolutional network.',
  l: {
    input: 'Input 32×32',
    c1: 'C1: 5×5 convolution',
    s2: 'S2: pooling',
    c3: 'C3: 5×5 convolution',
    s4: 'S4: pooling',
    c5: 'C5: 120 neurons',
    f6: 'F6: 84 neurons',
    out: 'Output: 10 digits',
  },
  n: {
    input: 'A 28×28 digit zero-padded to 32×32 — as in the original.',
    c1: '6 filters. The maps shown here come from edge-detector filters; in LeNet the filters were learned.',
    s2: 'In the original — average pooling with a trainable multiplier.',
    c3: 'Here C3 is fully connected, as in modern implementations: 6 × 16 × 25 weights + 16 biases = 2,416. In the original 1998 paper C3 was sparse — each map looked at only some of the S2 maps (a trick to save computation), and it had 1,516 parameters.',
  },
  introHtml: `<p>LeNet-5 is the network that started the era of convolutional networks. The idea that survives to this day:
    <b>convolution → pooling → convolution → pooling → fully connected layers</b>. Compare it with the
    <a href="space.html?id=mnist">MNIST</a> space — a network of almost the same shape is trained right in the browser there.</p>`,
  historyTitle: 'Historical note',
  historyHtml: `<p>Yann LeCun and colleagues at AT&T Bell Labs published LeNet-5 in 1998. The network was trained on a database of handwritten digits
      that later became MNIST. Back then training took days on the best computers; now it takes seconds on a phone.</p>`,
};
