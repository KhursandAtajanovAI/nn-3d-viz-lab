export default {
  title: 'ImageNet: 1000 classes and ResNet-50',
  fidelityNote: 'The ResNet-50 architecture is shown exactly, but the answer is a demonstration: 25M weights are too heavy for a web page.',
  summary: 'How "big" classification works: a 224×224 image passes through 50 ResNet layers and turns into probabilities for 1000 classes.',
  uses: 'Photo search, product and plant recognition, "pretrained" backbone networks for medicine, self-driving cars and robotics.',
  fine: [
    ['airliner', 'warplane', 'airship'],
    ['sports car', 'taxi', 'convertible'],
    ['goldfinch', 'sparrow', 'chickadee'],
    ['tabby cat', 'Egyptian cat', 'Siamese cat'],
    ['impala', 'gazelle', 'moose'],
    ['golden retriever', 'beagle', 'Labrador'],
    ['tree frog', 'toad', 'bullfrog'],
    ['sorrel horse', 'pony', 'zebra'],
    ['container ship', 'cruise liner', 'lifeboat'],
    ['van', 'fire engine', 'dump truck'],
  ],
  l: {
    input: 'Input 224×224',
    conv: 'Convolution 7×7, stride 2',
    stage: 'Stage {n}',
    out: 'Softmax, 1000 classes',
  },
  n: {
    input: 'A photo downscaled to 224×224. Here — a simplified synthetic image.',
    stage1: '3 "bottleneck" blocks: convolutions 1×1 → 3×3 → 1×1 with a residual connection around each.',
    stage2: '4 blocks; at the start of the stage the map size is halved and the number of channels doubles.',
    stage3: '6 blocks — the "deepest" part of the network.',
    gap: 'Each of the 2048 maps of size 7×7 is averaged into a single number.',
  },
  introHtml: `
    <p>ImageNet has 1.28M photos in 1000 classes (from "golden retriever" to "container ship").
    The annual ILSVRC competition on this dataset became the "Olympics" of computer vision:
    AlexNet (2012) had a top-5 error of 15.3%, ResNet (2015) only 3.6% — better than an average human.</p>`,
  realTitle: 'What is real here',
  realHtml: `<p><b>Real:</b> the ResNet-50 architecture — the sizes of all stages, the number of blocks and parameters (25.6M), the residual connections.</p>
        <p><b>Simplified:</b> 25 million weights and computations at 224×224 are too heavy for a web page, so the answer
        is a demonstration — a plausible probability distribution consistent with the image category.
        30 of the 1000 classes are shown. To see how convolutions really work, open the MNIST and CIFAR-10 spaces.</p>`,
  topTitle: 'Top-1 and top-5',
  topHtml: `<p>ImageNet often uses <b>top-5 accuracy</b>: an answer counts if the correct class is among the five most likely ones.
        This is fair for similar classes — telling an "Egyptian cat" from a "tabby cat" is hard even for a human.</p>`,
  item: '"{name}" {p}%',
  explainHtml: `<p>Top-5: {list}.
      Notice that semantically close classes get noticeable probabilities — the network is sure about the category
      but unsure about the breed or model. <span class="muted">(Demonstration numbers.)</span></p>`,
};
