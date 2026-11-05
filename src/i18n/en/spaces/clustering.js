export default {
  title: 'Clustering: a Kohonen map',
  summary: 'A self-organizing map: a grid of 36 neurons "stretches" itself over a point cloud and splits it into groups — with no teacher and no correct answers.',
  uses: 'Customer segmentation, grouping documents and news, gene analysis, image color quantization, finding similar products.',
  resultTitle: 'Map training',
  neuronTip: 'Neuron ({r}, {c}) · points: {n}',
  neuronHtml: `<h3>Map neuron ({r}, {c})</h3>
        <p>Weight (position in the data space): <b class="num">({w})</b></p>
        <p>Nearest data points: <b>{n}</b></p>
        <p class="muted small">A neuron is "responsible" for the points it is closest to. Its grid neighbors are pulled along with it.</p>`,
  trainedHtml: 'Training steps: <b>{t}</b> examples. Neurons in use: {used} of {total}.',
  qeTitle: 'Mean quantization error (distance to the nearest neuron)',
  xAxis: 'step (60 examples each)',
  yAxis: 'error',
  colorNote: 'The color of a point is the color of its nearest neuron. Neighboring grid neurons have similar colors — so you can see that the map preserves the "topology": nearby data lands on neighboring neurons.',
  unassigned: 'unassigned',
  neuron: 'neuron {n}',
  pressTrain: 'Click "Train" — the neurons will start moving toward the data',
  train: '▶ Train',
  pause: '⏸ Pause',
  done: 'Training complete: the learning rate and the neighborhood radius have decreased to their minimum',
  progress: 'Training: {n} examples',
  step: 'One step (60 examples)',
  data: 'Data',
  blobs: '4 point clouds',
  spiral: 'Spiral (ribbon)',
  newData: 'New data — the map has been reset',
  pointTip: 'Point ({pos})',
  pointHtml: '<h3>Data point</h3><p>Coordinates: <b class="num">({pos})</b></p>',
  legendHtml: `<ul class="legend">
      <li><span class="dot idle"></span><span><b>Balls are the data</b> (gray ones are not assigned yet).</span></li>
      <li><span class="dot glow-pos"></span><span><b>Diamonds are the map neurons</b>; lines connect neighbors on the 6×6 grid.</span></li>
    </ul>`,
  introHtml: `<p>A Kohonen map is an <b>unsupervised</b> neural network. Each neuron is a point in the data space.
    At every step an example is taken, the nearest neuron (the "winner") is found, and it moves toward the example together with
    <b>its grid neighbors</b>. Gradually the grid unfolds and covers the data, and groups of points end up on different parts of the map.</p>`,
  kmeansTitle: 'How this differs from k-means',
  kmeansHtml: `<p>In k-means the cluster centers are independent. In a Kohonen map the neurons are linked by a grid: neighbors move together,
        so similar data lands on neighboring neurons. The map can be "unfolded" into a flat 6×6 picture to see the structure of multidimensional data.</p>`,
};
