// Конструктор: полносвязная сеть с настраиваемой архитектурой (бывшая главная страница лаборатории).
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.playground');

export default {
  meta: {
    id: 'playground',
    title: S('title'),
    category: 'basics',
    order: 30,
    level: 1,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['MLP', 'sandbox', 'tanh / ReLU / sigmoid'],
    preview: [4, 6, 6, 3],
  },

  type: 'mlp',
  // Единственное пространство, где архитектуру можно менять из интерфейса
  editable: true,
  model: { layers: [4, 6, 6, 3], activation: 'tanh', outputActivation: 'sigmoid' },

  intro: S('introHtml'),

  sections: [{ title: S('tryTitle'), open: false, html: S('tryHtml') }],
};
