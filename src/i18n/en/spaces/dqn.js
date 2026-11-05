export default {
  title: 'DQN: a neural network plays Atari (2015)',
  fidelityNote: 'The DQN architecture is exact and the game frames are real (a simplified Pong); the Q-values are a demonstration following the rule "move the paddle toward the ball".',
  summary: 'A convolutional network looks at the last 4 game frames and outputs a Q-value for each action. The agent picks the action with the highest Q.',
  uses: 'Game AI (49 Atari games at human level), control of robots and data-center cooling systems; the ancestor of AlphaGo and AlphaStar.',
  actions: ['do nothing', 'paddle up', 'paddle down'],
  classes: ['Ball moving up', 'Ball moving down'],
  l: {
    input: '4 frames 84×84',
    conv1: 'Conv 8×8, stride 4',
    conv2: 'Conv 4×4, stride 2',
    q: 'Q-values',
  },
  n: {
    input: 'Grayscale game frames. One frame is not enough: it does not show where the ball is going.',
    q: 'One number per action: the expected sum of future rewards if this action is taken.',
  },
  qValue: 'Q-value',
  where: { hit: 'right into the paddle', above: 'above the paddle', below: 'below the paddle' },
  move: { stay: 'stay put', up: 'move up', down: 'move down' },
  explainHtml: `<p>The action <b>"{action}"</b> has the highest Q — that is what the agent will choose.
      The ball will arrive {where}, so it pays to {move}.</p>
      <p class="small muted">Q-values are not probabilities: they are expected rewards and need not add up to 100%. How Q-values are learned is shown in the
      <a href="space.html?id=q-learning">Q-learning</a> space (with a table instead of a neural network).</p>`,
  introHtml: `<p>In 2015 DeepMind showed a network that learned to play 49 Atari games seeing only the screen pixels and the score.
    This is Q-learning in which the Q table is replaced by a <b>convolutional neural network</b>: 4 last frames go in, the action Q-values come out.
    Hover over the input frames: the ball moves across them.</p>`,
};
