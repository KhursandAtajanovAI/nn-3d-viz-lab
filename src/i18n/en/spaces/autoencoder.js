export default {
  title: 'Autoencoder: the "bottleneck"',
  summary: 'A 9 → 6 → 3 → 6 → 9 network learns to compress a 3×3 picture into three numbers and restore it. Everything it knows about the picture passes through three neurons.',
  uses: 'Image compression and denoising, anomaly detection (manufacturing defects, fraudulent transactions), data generation (VAE).',
  p: {
    horizontal: 'Horizontal', vertical: 'Vertical', diagDown: 'Diagonal ↘', diagUp: 'Diagonal ↗',
    cross: 'Cross', frame: 'Frame', corner: 'Corner', dot: 'Dot',
  },
  randomNote: 'Random input: pixel values are drawn at random from [−1, 1] (including negative ones, which real pictures never have). This is "unusual" data the network has never seen — it shows a large reconstruction error.',
  input: 'Input',
  restored: 'Restored',
  mseHtml: '9 pixels were compressed to <b>three numbers</b> and restored with MSE = {mse} ({verdict}).',
  v: { great: 'almost perfect', good: 'good, details slightly blurred', bad: 'noticeably worse — the network has not seen this pattern' },
  latentTitle: 'Latent space (the first two of the three code numbers)',
  latentNote: 'The orange circle is the code of the current input. Each pattern got its own point — the decoder restores the picture from it. Average error on the training data: {loss}.',
  introHtml: `<p>An autoencoder learns <b>without a teacher</b>: the answer is the input itself. The left half of the network (the <b>encoder</b>) compresses 9 pixels to 3 numbers —
    the narrowest layer, the "bottleneck". The right half (the <b>decoder</b>) restores the picture from those three numbers.
    The network trained when the page opened on 160 noisy patterns (1500 epochs).</p>`,
  whyTitle: 'Why compress',
  whyHtml: `<ul class="steps">
          <li><b>Compression:</b> three numbers instead of nine — the network found on its own which features matter.</li>
          <li><b>Anomaly detection:</b> "normal" data is restored well, unusual data with a large error. This is how defects and fraud are found.
            Try "Random input" — the error will be much higher.</li>
          <li><b>Generation:</b> take a point in the latent space, pass it through the decoder, and you get a new picture (this is how VAEs work).</li>
        </ul>
        <p class="muted small">Why three neurons and not two: with two, these eight patterns train unreliably — the result depends heavily on the random start of training.</p>`,
};
