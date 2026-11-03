// English catalog and header copy. Interactive explanations remain owned by each
// space config and can be migrated to the same shape incrementally.
const EN = {
  alexnet: ['AlexNet (2012)', 'Five convolutional, three dense layers, and 62 million weights. Its ImageNet-2012 victory launched the deep-learning revolution.', 'Image recognition; its ReLU, dropout, and GPU-training ideas power modern models.'],
  autoencoder: ['Autoencoder: the bottleneck', 'A 9 → 6 → 3 → 6 → 9 network learns to compress a 3×3 image into three numbers and reconstruct it.', 'Image denoising and compression, anomaly detection, and data generation.'],
  backprop: ['Backpropagation: the error goes backward', 'One training step shows the forward pass, error, backward pass, and weight update with every number visible.', 'The core training algorithm behind modern neural networks.'],
  bert: ['BERT: understanding text (2018)', 'A transformer encoder sees words on both sides, learns to fill masked words, and can be fine-tuned for language tasks.', 'Search, document extraction, message classification, and question answering.'],
  cifar10: ['CIFAR-10: cats, dogs, cars…', 'Color images in ten categories pass through a small image classifier.', 'Image moderation, photo organization, and benchmarking new architectures.'],
  clustering: ['Clustering: a Kohonen map', 'A self-organizing map stretches across a point cloud and discovers groups without labels.', 'Customer segmentation, document grouping, gene analysis, and similar-item search.'],
  dqn: ['DQN: a neural network plays Atari (2015)', 'A convolutional network watches recent game frames and assigns a Q-value to every action.', 'Game AI, robot control, and data-center cooling systems.'],
  'fashion-mnist': ['Fashion-MNIST: clothes and shoes', 'A classifier recognizes ten kinds of 28×28 clothing images.', 'Sorting products in online stores and finding similar clothing.'],
  gan: ['GAN: generator versus discriminator', 'Two networks compete: one creates digit images from noise while the other detects fakes.', 'Image generation, super-resolution, photo animation, and training data creation.'],
  gpt: ['GPT: a language model', 'A stack of masked self-attention blocks predicts the next token from previous tokens.', 'Chatbots, writing assistance, coding, translation, and question answering.'],
  'gradient-descent': ['Gradient descent on the loss surface', 'A ball represents model weights while the landscape represents error. Compare SGD, momentum, and Adam.', 'Training almost any neural network, from face recognition to GPT.'],
  imagenet: ['ImageNet: 1,000 classes and ResNet-50', 'A 224×224 image passes through 50 ResNet layers and becomes probabilities for 1,000 classes.', 'Photo search, product recognition, and pretrained vision backbones.'],
  lenet5: ['LeNet-5 (1998)', 'Two convolutional layers with pooling and three dense layers: the ancestor of modern CNNs.', 'A classic teaching example of convolutional networks.'],
  lstm: ['RNN and LSTM: a network with memory', 'The network reads a review word by word and maintains memory with forget and input gates.', 'Speech recognition, translation, time-series forecasting, and streaming sensor data.'],
  mnist: ['MNIST: handwritten digit recognition', 'Draw a digit and inspect feature maps and probabilities for all ten classes.', 'Reading digits on forms, envelopes, and bank checks.'],
  mobilenet: ['MobileNet: a network for phones', 'Depthwise separable convolutions make image recognition small and fast.', 'On-device vision in phones, cameras, and embedded systems.'],
  'next-word': ['Autocomplete and attention', 'The model predicts the next word and shows which context words receive attention.', 'Keyboard suggestions, search autocomplete, email, and chatbots.'],
  perceptron: ['Perceptron: one neuron (1958)', 'The simplest neural network has two inputs, weights, and a threshold; it computes logical AND.', 'The historical building block of every dense neural network.'],
  playground: ['Fully connected network builder', 'Choose any number of layers and neurons, then watch how the signal changes.', 'A sandbox for experimenting with small tabular-data networks.'],
  'q-learning': ['Q-learning: reinforcement learning', 'An agent explores a maze and learns which direction to take from rewards and penalties.', 'Game AI, robots, autonomous systems, recommendations, and trading.'],
  recommender: ['Recommendations: a taste space', 'From viewer ratings and movie vectors, the model finds nearby tastes and suggests what to watch.', 'Streaming services, music, marketplaces, and social feeds.'],
  regression: ['Regression: predicting apartment prices', 'A 4 → 8 → 1 network learns to estimate a price from apartment features.', 'Real-estate and car valuation, demand forecasts, delivery time, and credit scoring.'],
  resnet: ['ResNet: residual connections (2015)', 'Skip paths add a block input to its output so signals and gradients can cross many layers.', 'Computer vision for medicine, vehicles, and face recognition.'],
  sentiment: ['Text sentiment analysis', 'Words become embeddings, an average vector, and a positive or negative prediction.', 'Review monitoring, social-media analysis, and support triage.'],
  'simple-mlp': ['Simple network 3 → 4 → 2', 'Three inputs, one hidden layer of four neurons, and two outputs show the essentials of a neural network.', 'A minimal teaching example of a fully connected layer.'],
  'training-loop': ['Training by epochs: live loss chart', 'A network learns to separate two classes while loss, accuracy, weights, and the decision boundary update.', 'Monitoring whether a model is learning and when training should stop.'],
  transformer: ['Transformer: attention is all you need (2017)', 'An encoder reads a phrase while a decoder writes a translation using cross-attention.', 'Translation and the architecture behind GPT, BERT, vision, speech, and protein models.'],
  unet: ['U-Net: image segmentation (2015)', 'An encoder compresses an image and a decoder expands it into a pixel-level object mask.', 'Medical imaging, satellite maps, autonomous driving, and background removal.'],
  vae: ['VAE: variational autoencoder', 'An encoder maps a digit to a latent distribution; the decoder draws a plausible digit from any point.', 'Image generation, interpolation, compression, and anomaly detection.'],
  vgg16: ['VGG-16 (2014)', 'Thirteen 3×3 convolutional layers in five blocks and three dense layers demonstrate the value of depth.', 'Transfer learning, style transfer, and image feature extraction.'],
  word2vec: ['Word2Vec: words as points in space', 'Similar words are close together and vector differences encode relationships.', 'Semantic search, recommendations, synonym suggestions, and language models.'],
  xor: ['XOR: a problem one neuron cannot solve', 'A 2 → 2 → 1 network with hand-picked weights computes exclusive OR.', 'A classic demonstration of why hidden layers are necessary.'],
};

export function localizedSpace(space) {
  const translation = EN[space.meta?.id];
  if (!translation) return space;
  const [title, summary, uses] = translation;
  return {
    ...space,
    meta: {
      ...space.meta,
      ru: { ...space.meta },
      en: { ...space.meta, title, summary, uses },
    },
  };
}
