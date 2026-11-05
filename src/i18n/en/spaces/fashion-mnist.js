export default {
  title: 'Fashion-MNIST: clothing and footwear',
  summary: 'Ten kinds of 28×28 clothing: T-shirts, trousers, dresses, sneakers… On synthetic silhouettes the network almost never errs; the notes explain which classes get confused on real photos.',
  uses: 'Online store catalogs: automatic sorting of products by photo, search for similar clothing.',
  accuracy: 'Accuracy on new synthetic silhouettes',
  introHtml: `
    <p>Fashion-MNIST (Zalando, 2017) is a drop-in "replacement" for MNIST of the same size: 70,000 grayscale 28×28 images, 10 clothing classes.
    The task is harder than digits: a T-shirt, a shirt, a pullover and a coat have similar silhouettes.
    The architecture is the same as in the MNIST space — only the data changes.</p>`,
  confuseTitle: 'Why classes get confused on real photos',
  confuseHtml: `<p>A T-shirt, a shirt, a pullover and a coat share the "body + sleeves" silhouette. They differ in sleeve length,
        collar, fastening and garment length. On the real Fashion-MNIST, good networks make the most mistakes
        on the "Shirt" class: the probability is split among several "upper-body" classes.</p>
        <p class="muted small">Here the silhouettes are drawn by a program following strict rules (a shirt has a collar, buttons and a check pattern,
        a coat has a dark fastening), so the network almost never errs on them — the accuracy is shown in the status line.</p>`,
  answerHtml: 'Answer: <b>"{c1}"</b> ({p1}%).',
  closeHtml: 'The network hesitates: almost as much goes to "{c2}" ({p2}%) — these items look alike.',
  farHtml: 'The second option, "{c2}", is much weaker ({p2}%).',
};
