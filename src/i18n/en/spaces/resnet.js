export default {
  title: 'ResNet: residual connections (2015)',
  fidelityNote: 'The ResNet-18 architecture and parameter count are exact; the answer is a demonstration.',
  summary: 'The blue arcs are "shortcuts": a block\'s input is added to its output. This lets the signal and the gradient pass through dozens of layers without fading.',
  uses: 'The backbone of most computer vision systems: medical scans, self-driving cars, face recognition; the skip-connection idea lives on in transformers too.',
  l: {
    input: 'Input 224×224',
    conv: 'Conv 7×7, stride 2',
    stage: 'Stage {n}',
  },
  n: {
    stage1: '2 residual blocks: conv 3×3 → conv 3×3, and the block input is added to the output.',
  },
  skip: '+ block input',
  introHtml: `<p>Before ResNet, networks deeper than ~20 layers trained worse than shallow ones: the signal and the gradient "faded".
    The solution of Kaiming He and colleagues: each block learns not the whole result but only a <b>correction</b> to its input —
    output = input + F(input). The blue arcs in the scene are these residual connections.</p>`,
  familyTitle: 'The ResNet family',
  familyHtml: `<p>ResNet-18 and -34 use simple blocks of two 3×3 convolutions. ResNet-50/101/152 use "bottleneck" blocks 1×1 → 3×3 → 1×1
      (the ResNet-50 diagram is in the <a href="space.html?id=imagenet">ImageNet</a> space). In 2015 ResNet-152 won ImageNet with a top-5 error of 3.57% —
      better than an average human.</p>`,
};
