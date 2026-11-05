export default {
  title: 'Fully connected network builder',
  summary: 'Set any number of layers and neurons, pick an activation function and see how the signal flow changes.',
  uses: 'A sandbox for experiments: this is how the architecture of small networks for tabular data is chosen.',
  introHtml: `<p class="muted">Enter the architecture separated by commas (for example, <code>2, 8, 8, 1</code>) and click "Build".
    Layers with more than 8 neurons are laid out as a grid.</p>`,
  tryTitle: 'What to try',
  tryHtml: `
        <ul class="steps">
          <li>Switch the activation to <b>ReLU</b>: many hidden neurons become exactly 0 and stay gray — these are "switched-off" neurons.</li>
          <li>Make the network deep and narrow (<code>4, 3, 3, 3, 3, 2</code>) — the signal may "fade" from layer to layer.</li>
          <li>Make one layer wide (<code>4, 32, 3</code>) — hover over an output neuron and see how many connections go into it.</li>
        </ul>`,
};
