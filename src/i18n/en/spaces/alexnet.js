export default {
  fidelityNote: 'The AlexNet architecture and parameter count are exact; the answer is a demonstration (62M weights are too heavy for a web page).',
  summary: 'Five convolutional layers, three fully connected ones and 62 million weights. Its landslide win at ImageNet 2012 launched the deep learning revolution.',
  uses: 'The first "big" network for photo recognition; its ideas (ReLU, dropout, GPU training) are used in every modern model.',
  l: {
    input: 'Input 227×227',
    conv1: 'Conv1 11×11, stride 4',
  },
  n: {
    conv1: 'Huge 11×11 filters with stride 4 shrink the image a lot right away.',
    fc6: 'More than half of all the network\'s weights are in this layer.',
  },
  introHtml: `<p>AlexNet (Krizhevsky, Sutskever, Hinton) won ImageNet 2012 with a top-5 error of <b>15.3%</b> — 11 points better than the runner-up.
    Three innovations made it possible: the <b>ReLU</b> activation function (several times faster training), <b>dropout</b> against overfitting
    and training on two <b>GPUs</b>.</p>`,
  depthTitle: 'Where the "depth" is',
  depthHtml: `<p>Hover over the layers: the convolutional layers hold only ~6% of the weights but do almost all of the computation.
      The fully connected FC6–FC8 hold ~94% of the weights. Later architectures (VGG, ResNet, MobileNet) worked toward removing these heavy layers.</p>`,
};
