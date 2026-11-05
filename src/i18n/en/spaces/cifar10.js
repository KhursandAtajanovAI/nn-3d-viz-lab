export default {
  title: 'CIFAR-10: cats, dogs, cars…',
  summary: '32×32 color images in ten categories: airplane, automobile, bird, cat, deer, dog, frog, horse, ship, truck.',
  uses: 'Sorting photos by content, image moderation, "smart" albums on your phone; CIFAR-10 is the standard benchmark for new architectures.',
  accuracy: 'Accuracy on new synthetic scenes',
  introHtml: `
    <p>CIFAR-10 (2009) has 60,000 color 32×32 images. Unlike MNIST, shape, color and background all matter here:
    a ship is usually on a blue sea, a frog is green, an airplane is against the sky.
    The convolutions look at brightness, and a coarse "color map" of the image is added to the features.</p>`,
  bgTitle: 'The network looks at the background',
  bgHtml: `<p>Classifiers often "cheat": they recognize a ship by the sea and an airplane by the sky.
        Because of this, on real photos a bird against the sky is often mistaken for an airplane.
        Here the synthetic images are drawn by strict rules, so the network almost never errs (the accuracy is in the status line),
        but look at the "color part" of the features: the background really is part of the decision.
        Real systems fight this with data diversity and augmentation (shifts, flips, background changes).</p>`,
  explainHtml: `<p>The network thinks the image shows <b>"{c1}"</b> ({p1}%); the second option is "{c2}" ({p2}%).
      For color images the decision combines shape (the convolution maps) and color (average colors per patch).</p>`,
};
