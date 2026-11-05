export default {
  title: 'Backpropagation: the error flows backward',
  summary: 'One training step stage by stage: forward pass, loss, backward pass layer by layer (purple pulses) and the weight update — with every number shown.',
  uses: 'Backpropagation trains virtually every modern neural network — from image classifiers to language models.',
  introHtml: `<p>The network starts with <b>random weights</b> and answers at random. One training step on one example:</p>
    <ol class="steps">
      <li><b>Forward pass</b> — compute the network's answer.</li>
      <li><b>Loss</b> — compare the answer with the correct one (cross-entropy).</li>
      <li><b>Backward pass</b> — use the chain rule to compute δ = ∂L/∂z for every neuron, starting from the output.</li>
      <li><b>Update</b> — every weight moves by −η·δ<sub>after</sub>·a<sub>before</sub>.</li>
    </ol>`,
  chainTitle: 'The chain rule in plain words',
  chainHtml: `<p>To see how a weight affects the loss, follow the chain: weight → the neuron's sum z → its activation → the next neurons → … → loss.
        The derivatives along this chain are multiplied. Backpropagation computes them <b>once</b> for all weights, moving from the output to the input
        and reusing the δ values already computed — this is what makes training networks with billions of weights possible at all.</p>
        <p class="small muted">All numbers here are real: the gradients were checked numerically (with a finite-difference derivative).</p>`,
  tryTitle: 'What to try',
  tryHtml: `<ul class="steps">
          <li>Take 4 steps over all examples ("Next example") and watch the table in "What this step changed".</li>
          <li>Click "+100 epochs fast" a few times — the network learns XOR, and the answers get close to 0 and 1.</li>
          <li>Set η = 2: the steps become too large, and the loss may start to grow.</li>
        </ul>`,
};
