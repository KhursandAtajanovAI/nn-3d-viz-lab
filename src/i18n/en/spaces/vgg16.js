export default {
  fidelityNote: 'The VGG-16 architecture and parameter count are exact; the answer is a demonstration.',
  summary: '13 convolutional 3×3 layers in five blocks plus three fully connected ones — 138 million weights. It showed that depth matters more than filter size.',
  uses: 'A popular "backbone" for transfer learning, artistic style transfer and image feature extraction.',
  l: {
    input: 'Input 224×224',
    block: 'Block {n}: conv 3×3',
  },
  n: {
    block2: 'Before each block there is 2×2 max pooling: the map is halved, and the number of channels doubles.',
    fc: '74% of all VGG-16 weights are in this single layer.',
  },
  introHtml: `<p>The Visual Geometry Group team from Oxford replaced large filters with stacks of small <b>3×3</b> ones:
    two 3×3 convolutions "see" as much as one 5×5, but have fewer weights and an extra nonlinearity.
    The architecture is very regular: blocks of convolutions, each followed by pooling.</p>`,
  whyTitle: 'Why VGG is still used',
  whyHtml: `<p>VGG is slow and heavy, but its features describe the "style" and "content" of an image well.
      That is why it is often taken as a ready-made backbone: the last layers are cut off and the rest is fine-tuned on your own data (transfer learning),
      and neural style transfer compares VGG feature maps.</p>`,
};
