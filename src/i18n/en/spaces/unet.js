export default {
  title: 'U-Net: image segmentation (2015)',
  fidelityNote: 'The U-Net structure (encoder, decoder, bridges) is exact, but the sizes are reduced: 3 levels and 32 channels at the first level instead of 4 levels and 64 channels in the original. The output mask comes from a simple brightness threshold — this is what a segmentation result looks like, but it is not computed by the network itself.',
  summary: 'A U-shaped network: the encoder compresses the image, the decoder expands it back into a "pixel — object or background" mask, and the bridges carry the fine details across.',
  uses: 'Medicine (tumors on MRI, cells in microscope images), satellite maps, self-driving cars (where the road is, where a pedestrian is), photo background removal.',
  l: {
    input: 'Scan',
    enc: 'Encoder {n}',
    bottom: 'Bottom of the "U"',
    dec: 'Decoder {n}',
    mask: 'Mask',
  },
  n: {
    input: 'A synthetic "microscope image": bright cells on a noisy background.',
    enc2: 'Before the block there is max pooling: the map is halved, the channels double.',
    bottom: 'The most compressed representation: the network "understands" what is in the image but no longer knows exactly where.',
    dec3: 'Upsampling + concatenation with the Encoder 3 map (a bridge) + two convolutions.',
    mask: 'For every pixel — the probability of "cell". Bright is a cell, dark is background.',
  },
  skipDetails: 'bridge: fine details',
  skip: 'bridge',
  groupEnc: 'Encoder: what is in the image',
  groupDec: 'Decoder: exactly where',
  classes: ['Few cells', 'Many cells'],
  explainHtml: `<p>The mask marks in bright the pixels assigned to cells: <b>{p}%</b> of the image area.
      From such a mask a doctor or a program counts the cells and measures their size and shape.</p>
      <p class="small muted">The mask here comes from smoothing and a threshold — the "ground-truth labeling" U-Net would learn to reproduce.</p>`,
  introHtml: `<p>A classifier answers "what is in the image", while <b>segmentation</b> answers "which pixels belong to what".
    U-Net first compresses the image (the left branch of the "U"), then expands it back (the right branch), and the blue <b>bridges</b>
    pass the fine-detail maps straight from the encoder to the decoder — otherwise object boundaries would come out blurry.</p>`,
  whyTitle: 'Why a U',
  whyHtml: `<p>Compression gives the network a wide context ("this is a cell, not noise") but loses exact coordinates. The bridges bring them back.
      U-Net was invented for biomedical images, where labeled data is scarce, and it is still the standard in medicine —
      as well as the basis of the diffusion models that generate images (Stable Diffusion).</p>`,
};
