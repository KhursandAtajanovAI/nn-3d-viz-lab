// Перцептрон Розенблатта (1958): один нейрон, который умеет «И» и «ИЛИ», но не XOR.
import { MLP } from '../src/engine/models/mlp.js';

export default {
  meta: {
    id: 'perceptron',
    title: 'Перцептрон: один нейрон (1958)',
    category: 'basics',
    order: 5,
    level: 1,
    fidelity: 'real',
    summary: 'Самая простая нейросеть: два входа, веса и порог. С подобранными весами нейрон вычисляет логическое «И».',
    uses: 'Исторически — первая обучаемая нейросеть (распознавала буквы). Сегодня каждый нейрон любой большой сети устроен так же.',
    tags: ['MLP', 'история', 'логика', 'готовые веса'],
    preview: [2, 1],
  },

  type: 'mlp',
  randomizable: false,
  randomInput: false,
  createModel() {
    const net = new MLP([2, 1], { outputActivation: 'sigmoid' });
    // «И»: сумма 6·A + 6·B − 9 положительна, только когда оба входа равны 1
    net.weights = [[[6, 6]]];
    net.biases = [[-9]];
    return net;
  },
  names: { input: ['A', 'B'], output: ['A И B'] },
  inputs: [
    { name: 'A = 0, B = 0', values: [0, 0] },
    { name: 'A = 0, B = 1', values: [0, 1] },
    { name: 'A = 1, B = 0', values: [1, 0] },
    { name: 'A = 1, B = 1', values: [1, 1] },
  ],

  explainResult(ctx, acts, { outputBarsHtml }) {
    const [a, b] = acts[0];
    const z = ctx.model.lastZ[1][0];
    const y = acts[1][0];
    return `${outputBarsHtml(ctx, acts[1])}
      <p>z = 6·${a} + 6·${b} − 9 = <b>${z.toFixed(0)}</b>, σ(z) = <b>${y.toFixed(3)}</b> → ${y > 0.5 ? '<b class="pos">1</b>' : '<b class="neg">0</b>'}.
        ${Math.round(y) === (a && b ? 1 : 0) ? `Верно: ${a} И ${b} = ${a && b ? 1 : 0}.` : ''}</p>
      <p class="small muted">Чтобы получить «ИЛИ», достаточно порога −3 вместо −9. А вот XOR одним нейроном не получить никакими весами —
        см. пространство <a href="space.html?id=xor">XOR</a>.</p>`;
  },

  intro: `<p>Нейрон складывает входы с весами, добавляет смещение и пропускает сумму через функцию активации:
    <b>y = σ(w₁·A + w₂·B + b)</b>. Геометрически он проводит <b>прямую</b>, отделяющую «да» от «нет».
    Выберите вход в «Управлении» и запустите forward pass.</p>`,

  sections: [{
    title: 'История',
    open: false,
    html: `<p>Фрэнк Розенблатт построил перцептрон «Mark I» в 1958 году — это была машина с фотоэлементами и моторчиками вместо весов.
      В 1969 году Минский и Пейперт показали, что один перцептрон не решает XOR, и интерес к нейросетям угас на годы.
      Решение — скрытые слои и обучение методом обратного распространения ошибки (пространство <a href="space.html?id=backprop">Backpropagation</a>).</p>`,
  }],
};
