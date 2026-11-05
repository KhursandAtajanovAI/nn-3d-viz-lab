export default {
  title: 'Q-learning: reinforcement learning',
  summary: 'The agent — a blue ball — walks a maze and learns by itself where to go: +1 for the goal, −1 for a pit. The arrows in the cells show what it has learned.',
  uses: 'Game AI (AlphaGo, Atari), control of robots, drones and traffic lights, recommendations and trading strategies; RLHF when training chatbots.',
  introHtml: `<p>There is no teacher with correct answers here — only <b>rewards</b>. The agent tries actions and stores in the table
    <b>Q(cell, action)</b> how much reward each one eventually brings. After every step the value is refined by the formula
    <b>Q ← Q + α · (r + γ · max Q(next cell) − Q)</b>.</p>`,
  tryTitle: 'What to try',
  tryHtml: `<ul class="steps">
          <li>Click "+100 episodes fast" 2–3 times, then "Show the best path" — the agent goes around the pits and the wall.</li>
          <li>Set ε = 0: the agent stops exploring and may get stuck on the first path it found.</li>
          <li>Set γ = 0.1: future rewards barely matter, and distant cells hardly "sense" the goal.</li>
          <li>Turn on "Detailed · numbers" to see the best Q in every cell.</li>
        </ul>`,
  dqnTitle: 'From a table to a neural network (DQN)',
  dqnHtml: `<p>A Q table works while there are few cells. In Atari games there are billions of possible screen images, so in 2013 DeepMind replaced the table
        with a <b>neural network</b> that predicts Q for each action from the image (Deep Q-Network). Its architecture is in the
        <a href="space.html?id=dqn">DQN</a> space of the model library.</p>`,
};
