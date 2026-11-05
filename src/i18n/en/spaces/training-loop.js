export default {
  title: 'Training by epochs: a live loss curve',
  summary: 'A 2 → 8 → 8 → 1 network learns to separate points of two classes. You can see the loss fall, the accuracy rise, the weights change and the decision boundary "being drawn".',
  uses: 'Every model training run looks like this: engineers watch the loss and accuracy curves to see whether the network is learning and whether it is time to stop.',
  cls: 'class',
  introHtml: `<p>Under "Controls" on the left you see the data (points of two classes) and the <b>decision boundary</b>: the background color shows which class the network predicts
    at every point of the plane. Click "Train": every epoch the network goes over all points and slightly adjusts its weights.</p>`,
  tryTitle: 'What to try',
  tryHtml: `<ul class="steps">
          <li>"Circle inside a ring" learns in ~100 epochs: the boundary turns into a circle.</li>
          <li>"Two spirals" is a hard task: the loss sits on a plateau for a long time, then drops sharply.</li>
          <li>Set η = 0.5 — the loss curve becomes "noisy" or starts to grow. Set η = 0.01 — training becomes very slow.</li>
        </ul>`,
  curveTitle: 'How to read the loss curve',
  curveHtml: `<p>The loss is on the Y axis in log scale. If the curve falls, the network is learning. If it reaches a plateau, either the task is solved,
        or the network lacks "capacity", or the learning rate is a poor choice. In real tasks the loss on <b>held-out</b> data is plotted alongside:
        if it starts to grow, the network is overfitting — memorizing examples instead of the pattern.</p>`,
};
