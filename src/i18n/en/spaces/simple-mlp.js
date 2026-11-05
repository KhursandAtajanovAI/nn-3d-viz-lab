export default {
  title: 'Simple network 3 → 4 → 2',
  summary: 'Three inputs, one hidden layer of four neurons and two outputs — the smallest network that shows all the key ideas.',
  uses: 'A teaching example: this is the "building block" of almost any neural network — a fully connected layer.',
  introHtml: `
    <p>This is the smallest "real" neural network: 9 neurons and 20 connections.
    The weights here are random (the network is not trained), but you can clearly see how the input numbers
    pass through the hidden layer and turn into two output values.</p>`,
  startTitle: 'Where to start',
  startHtml: `
        <ol class="steps">
          <li>Click <b>"Run forward pass"</b> and watch the layers light up one after another.</li>
          <li>Hover over a hidden neuron — the "Under the cursor" panel shows what its value is made of.</li>
          <li>Switch to <b>"Detailed · numbers"</b> mode to see exact values next to the neurons.</li>
          <li>Click <b>"New weights"</b> — with the same input the result changes: the weights define all of the network's behavior.</li>
        </ol>`,
};
