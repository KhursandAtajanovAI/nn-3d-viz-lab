export default {
  title: 'MNIST: handwritten digit recognition',
  summary: 'Draw a digit — a convolutional network shows the feature maps of every layer and the probabilities of all 10 classes.',
  uses: 'Reading postal codes on envelopes, amounts on bank checks, numbers on forms; MNIST is the "Hello, world" of computer vision.',
  accuracy: 'Accuracy on new synthetic digits (fonts)',
  introHtml: `
    <p>The real MNIST dataset has 70,000 handwritten 28×28-pixel digits. Here is a network of the same shape:
    two convolutions with pooling, then fully connected layers and a softmax over 10 classes.
    <b>Draw a digit on the black square</b> under "Controls" or pick an example — and watch
    the image turn into feature maps and then into probabilities.</p>`,
  tryTitle: 'What to try',
  tryHtml: `
        <ul class="steps">
          <li>Draw a "1" and a "7" and look at the "Horizontal edges" map: the seven has a bright stripe at the top, the one does not.</li>
          <li>Draw a very crooked digit or two digits at once: the probabilities "smear" across several classes — the network is unsure.</li>
          <li>Hover over a first-layer map to see the weights of the 5×5 filter that built it.</li>
        </ul>
        <p class="muted small">The network has only seen "printed" digits in various fonts with distortions, so it sometimes confuses unusual handwriting — just as real models get confused by data that does not look like their training data.</p>`,
};
