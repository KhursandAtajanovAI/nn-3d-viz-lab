// Словарь языка: части по областям интерфейса + тексты пространств (sp.<id>).
// Файл собирается из списка; новое пространство — файл spaces/<id>.js и строка здесь.
import ui from './ui.js';
import lab from './lab.js';
import graph from './graph.js';
import labs from './labs.js';
import models from './models.js';
import stack from './stack.js';
import tokens from './tokens.js';
import train from './train.js';
import sp_alexnet from './spaces/alexnet.js';
import sp_autoencoder from './spaces/autoencoder.js';
import sp_backprop from './spaces/backprop.js';
import sp_bert from './spaces/bert.js';
import sp_cifar10 from './spaces/cifar10.js';
import sp_clustering from './spaces/clustering.js';
import sp_dqn from './spaces/dqn.js';
import sp_fashion_mnist from './spaces/fashion-mnist.js';
import sp_gan from './spaces/gan.js';
import sp_gpt from './spaces/gpt.js';
import sp_gradient_descent from './spaces/gradient-descent.js';
import sp_imagenet from './spaces/imagenet.js';
import sp_lenet5 from './spaces/lenet5.js';
import sp_lstm from './spaces/lstm.js';
import sp_mnist from './spaces/mnist.js';
import sp_mobilenet from './spaces/mobilenet.js';
import sp_next_word from './spaces/next-word.js';
import sp_perceptron from './spaces/perceptron.js';
import sp_playground from './spaces/playground.js';
import sp_q_learning from './spaces/q-learning.js';
import sp_recommender from './spaces/recommender.js';
import sp_regression from './spaces/regression.js';
import sp_resnet from './spaces/resnet.js';
import sp_sentiment from './spaces/sentiment.js';
import sp_simple_mlp from './spaces/simple-mlp.js';
import sp_training_loop from './spaces/training-loop.js';
import sp_transformer from './spaces/transformer.js';
import sp_unet from './spaces/unet.js';
import sp_vae from './spaces/vae.js';
import sp_vgg16 from './spaces/vgg16.js';
import sp_word2vec from './spaces/word2vec.js';
import sp_xor from './spaces/xor.js';

export default {
  ...ui,
  ...lab,
  ...graph,
  ...labs,
  ...models,
  ...stack,
  ...tokens,
  ...train,
  sp: {
    'alexnet': sp_alexnet,
    'autoencoder': sp_autoencoder,
    'backprop': sp_backprop,
    'bert': sp_bert,
    'cifar10': sp_cifar10,
    'clustering': sp_clustering,
    'dqn': sp_dqn,
    'fashion-mnist': sp_fashion_mnist,
    'gan': sp_gan,
    'gpt': sp_gpt,
    'gradient-descent': sp_gradient_descent,
    'imagenet': sp_imagenet,
    'lenet5': sp_lenet5,
    'lstm': sp_lstm,
    'mnist': sp_mnist,
    'mobilenet': sp_mobilenet,
    'next-word': sp_next_word,
    'perceptron': sp_perceptron,
    'playground': sp_playground,
    'q-learning': sp_q_learning,
    'recommender': sp_recommender,
    'regression': sp_regression,
    'resnet': sp_resnet,
    'sentiment': sp_sentiment,
    'simple-mlp': sp_simple_mlp,
    'training-loop': sp_training_loop,
    'transformer': sp_transformer,
    'unet': sp_unet,
    'vae': sp_vae,
    'vgg16': sp_vgg16,
    'word2vec': sp_word2vec,
    'xor': sp_xor,
  },
};
