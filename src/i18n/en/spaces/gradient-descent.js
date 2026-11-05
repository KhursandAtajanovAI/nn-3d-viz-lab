export default {
  title: 'Gradient descent on a loss surface',
  summary: 'The ball is the model weights, the terrain is the loss. Watch gradient descent, momentum and Adam look for the minimum, get stuck in pits and "fly off" when the step is too large.',
  uses: 'This is how almost every neural network is trained: from face recognition to GPT. Choosing the optimizer and learning rate is everyday work for an ML engineer.',
  bowl: {
    name: 'Bowl (an easy task)',
    note: 'One minimum, slopes of different steepness. Try η = 0.3: the ball starts "bouncing" between the walls and may diverge.',
  },
  rosenbrock: {
    name: 'Valley (Rosenbrock function)',
    note: 'A narrow curved valley: the ball quickly drops to the bottom and then crawls slowly along it. Momentum "builds up speed" and reaches the minimum much faster. Adam takes steps of roughly size η regardless of the steepness — with η = 0.01 it is cautious; try η = 0.1.',
  },
  multi: {
    name: 'Several minima',
    formula: 'a bowl + three "pits" of different depth',
    note: 'Gradient descent rolls into the nearest pit and gets stuck in a local minimum. Click on different spots of the surface — the result depends on the starting point.',
  },
  saddle: {
    name: 'Saddle',
    note: 'In the center there is a saddle point: the gradient is almost zero, but it is not a minimum. Descent "lingers" near it for a long time before rolling into one of the troughs.',
  },
  introHtml: `<p>Training a neural network means searching for the weights with the lowest loss. Here the "model" has just two weights, so the loss can be drawn
    as a terrain. At every step the <b>gradient</b> is computed — the direction in which the loss grows fastest — and the weights move the opposite way
    by an amount set by <b>η</b> (the learning rate).</p>`,
  tryTitle: 'What to try',
  tryHtml: `<ul class="steps">
          <li>Turn on all three optimizers and start — which one reaches the minimum of the "valley" first?</li>
          <li>On the "Bowl", raise η to 0.3–0.5: the step becomes too large, and the loss grows instead of falling.</li>
          <li>On "Several minima", click at different points: gradient descent always rolls into the nearest pit.</li>
        </ul>
        <p class="muted small">Real networks have millions of weights and the "terrain" cannot be drawn, but the process works exactly the same way.</p>`,
};
