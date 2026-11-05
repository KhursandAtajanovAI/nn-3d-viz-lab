export default {
  title: 'Perceptron: a single neuron (1958)',
  summary: 'The simplest neural network: two inputs, weights and a threshold. With well-chosen weights the neuron computes logical AND.',
  uses: 'Historically the first trainable neural network (it recognized letters). Today every neuron of any large network works the same way.',
  outName: 'A AND B',
  correct: 'Correct: {a} AND {b} = {y}.',
  orXorHtml: 'To get OR, a threshold of −3 instead of −9 is enough. But XOR cannot be computed by one neuron with any weights — see the <a href="space.html?id=xor">XOR</a> space.',
  introHtml: `<p>A neuron adds up its inputs multiplied by weights, adds a bias and passes the sum through an activation function:
    <b>y = σ(w₁·A + w₂·B + b)</b>. Geometrically it draws a <b>straight line</b> that separates "yes" from "no".
    Pick an input under "Controls" and run the forward pass.</p>`,
  historyTitle: 'History',
  historyHtml: `<p>Frank Rosenblatt built the "Mark I" perceptron in 1958 — a machine with photocells and small motors instead of weights.
      In 1969 Minsky and Papert showed that a single perceptron cannot solve XOR, and interest in neural networks faded for years.
      The solution is hidden layers trained with backpropagation (see the <a href="space.html?id=backprop">Backpropagation</a> space).</p>`,
};
