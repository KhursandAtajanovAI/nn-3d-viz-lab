export default {
  title: 'GAN: generator versus discriminator',
  fidelityNote: 'The DCGAN architecture is exact. The "fakes" per epoch are an illustration: a mix of noise and a digit, not the output of a really trained GAN.',
  summary: 'Two networks play against each other: the generator draws digits from noise, the discriminator guesses whether an image is real or fake. Pick an epoch and watch the quality grow.',
  uses: 'Generating faces and photos, super-resolution, "animating" photos, creating training data; GAN ideas evolved into modern image generators.',
  stage: [
    'Epoch 0 — the generator outputs noise',
    'Epoch 5 — blobs appear',
    'Epoch 20 — a digit can be made out',
    'Epoch 100 — almost like a real one',
  ],
  l: {
    noise: 'Noise z',
    deconv: 'G: transposed convolution',
    fake: 'Fake 28×28',
    conv: 'D: convolution',
    real: 'D: real?',
  },
  n: {
    noise: '100 random numbers — the "seed" of the image. Different noise → a different digit.',
    fake: 'The image drawn by the generator. Next, the discriminator judges it.',
    real: 'The probability that the image is real (from the dataset) rather than fake.',
  },
  groupG: 'Generator: draws',
  groupD: 'Discriminator: checks',
  outName: 'real?',
  classes: ['Real', 'Fake'],
  explainHtml: 'The discriminator believes the fake is real with probability <b>{p}%</b>.',
  easy: 'The fake is still easy to spot — the generator has a lot to learn.',
  unsure: 'The generator already "lies" quite well; the discriminator is unsure.',
  fooled: 'Almost 50% — the discriminator can no longer tell the fake apart: this is exactly the goal of GAN training.',
  introHtml: `<p>A GAN (Ian Goodfellow, 2014) is a pair of rival networks. The <b>generator</b> turns random noise into an image.
    The <b>discriminator</b> receives real images and fakes in turn and learns to tell them apart. The generator learns to fool the discriminator.
    Pick an epoch under "Controls" and click "Run through the network".</p>`,
  howTitle: 'How they learn',
  howHtml: `<ol class="steps">
        <li>Discriminator step: show it real and fake images and penalize its mistakes.</li>
        <li>Generator step: generate fakes and change the generator's weights so that the discriminator makes more mistakes.</li>
        <li>Repeat until the discriminator answers ~50% — the fakes are indistinguishable.</li>
      </ol>
      <p class="muted small">GAN training is fickle: if one network gets far ahead of the other, training breaks down. That is why image generation
      today more often uses diffusion models.</p>`,
};
