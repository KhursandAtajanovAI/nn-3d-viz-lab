// Q-learning: агент в клетчатом мире учится по наградам находить путь к цели и обходить ямы.
// Тексты — в словарях src/i18n/<язык>/spaces/q-learning.js.
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.q-learning');

export default {
  meta: {
    id: 'q-learning',
    title: S('title'),
    category: 'training',
    order: 40,
    level: 2,
    fidelity: 'real',
    summary: S('summary'),
    uses: S('uses'),
    tags: ['rl', 'Q-learning', 'agent', 'reward'],
    preview: { grid: 5 },
  },

  type: 'gridworld',
  map: [
    '. . . . G',
    '. # . X .',
    '. # . . .',
    '. . X # .',
    'S . . . .',
  ],
  rewards: { goal: 1, pit: -1, step: -0.04 },
  params: { epsilon: 0.2, alpha: 0.5, gamma: 0.9 },

  intro: S('introHtml'),

  sections: [
    { title: S('tryTitle'), html: S('tryHtml') },
    { title: S('dqnTitle'), open: false, html: S('dqnHtml') },
  ],
};
