export default {
  title: 'VAE: variational autoencoder',
  fidelityNote: 'The diagram shows a typical convolutional VAE (there is no single "original" VAE architecture). The reconstructed image here is a blur of the input, and the latent numbers are a demonstration.',
  summary: 'The encoder compresses a digit into two numbers — not exact ones but a "cloud" (mean μ and spread σ). From any point of this space the decoder draws a plausible digit.',
  uses: 'Image generation and interpolation, data compression, anomaly detection; the VAE latent space is used in Stable Diffusion.',
  l: {
    input: 'Input 28×28',
    conv: 'Convolution',
    musigma: 'μ and σ',
    deconv: 'Transposed convolution',
    recon: 'Reconstruction',
  },
  n: {
    musigma: 'Two means μ and two spreads σ: the encoder describes not a point but a "cloud" of likely codes.',
    z: 'We take a random point from the cloud. Thanks to this the latent space comes out "smooth".',
  },
  groupEnc: 'Encoder',
  groupDec: 'Decoder',
  explainHtml: `<p>The encoder described the image as a "cloud" centered at μ = ({mu}) with spread σ = ({sigma}).
      The point z = ({z}) was taken from it, and the decoder drew a digit from that point — slightly blurrier than the original.</p>
      <p class="small muted">The difference from an ordinary autoencoder (<a href="space.html?id=autoencoder">the "Autoencoder" space</a>): the codes of different digits form
      a continuous region, and a point between "3" and "8" gives a plausible blend rather than garbage.</p>`,
  introHtml: `<p>An ordinary autoencoder encodes an image as a single point, and between the points in its latent space there is "emptiness".
    A VAE (Kingma and Welling, 2013) encodes a <b>distribution</b> and penalizes it for being too confident.
    Thanks to this, <b>any</b> point of the space yields a meaningful image — a VAE can generate.</p>`,
};
