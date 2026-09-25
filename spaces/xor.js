// XOR: сеть с вручную подобранными весами, которая действительно решает задачу.
// Пример пространства со своей моделью (createModel), готовыми входами и своим объяснением результата.
import { MLP } from '../src/engine/models/mlp.js';

// Скрытый нейрон 1 ≈ ИЛИ, скрытый нейрон 2 ≈ И-НЕ, выход ≈ И от них → вместе это XOR
const WEIGHTS = [
  [[20, 20], [-20, -20]],
  [[20, 20]],
];
const BIASES = [[-10, 30], [-30]];

export default {
  meta: {
    id: 'xor',
    title: 'XOR: задача, которую не решить одним нейроном',
    category: 'basics',
    order: 20,
    level: 1,
    summary: 'Сеть 2 → 2 → 1 с подобранными вручную весами правильно вычисляет «исключающее ИЛИ».',
    uses: 'Классический пример из истории ИИ: именно XOR показал, зачем нужны скрытые слои.',
    tags: ['MLP', 'логика', 'готовые веса'],
    preview: [2, 2, 1],
  },

  type: 'mlp',
  randomizable: false, // веса подобраны вручную — перегенерировать их нельзя
  randomInput: false,
  createModel() {
    const net = new MLP([2, 2, 1], { activation: 'sigmoid', outputActivation: 'sigmoid' });
    net.weights = WEIGHTS.map(layer => layer.map(row => [...row]));
    net.biases = BIASES.map(b => [...b]);
    return net;
  },

  names: { input: ['A', 'B'], output: ['A XOR B'] },
  inputs: [
    { name: 'A = 0, B = 0', values: [0, 0] },
    { name: 'A = 0, B = 1', values: [0, 1] },
    { name: 'A = 1, B = 0', values: [1, 0] },
    { name: 'A = 1, B = 1', values: [1, 1] },
  ],

  intro: `
    <p>XOR («исключающее ИЛИ») выдаёт 1, когда ровно один из входов равен 1.
    Один нейрон так не умеет: он может провести только одну прямую границу, а точки XOR
    так не разделить. Два скрытых нейрона решают задачу вместе.</p>`,

  sections: [
    {
      title: 'Как это работает',
      html: `
        <ul class="steps">
          <li><b>Скрытый Н1</b> работает как <b>ИЛИ</b>: загорается, если хотя бы один вход равен 1.</li>
          <li><b>Скрытый Н2</b> работает как <b>И-НЕ</b>: гаснет, только если оба входа равны 1.</li>
          <li><b>Выход</b> работает как <b>И</b>: горит, когда горят оба скрытых нейрона.</li>
        </ul>
        <p class="muted">ИЛИ и И-НЕ одновременно истинны только при разных входах — это и есть XOR.
        Выберите вход в «Управлении» и наведите курсор на скрытые нейроны.</p>`,
    },
  ],

  explainResult(ctx, acts, { outputBarsHtml }) {
    const [a, b] = acts[0];
    const [or, nand] = acts[1];
    const y = acts[2][0];
    const expected = a !== b ? 1 : 0;
    const on = v => (v > 0.5 ? '<b class="pos">≈ 1</b>' : '<b class="neg">≈ 0</b>');
    return `
      ${outputBarsHtml(ctx, acts[2])}
      <p>Вход A = ${a}, B = ${b}. Скрытый Н1 (ИЛИ) = ${or.toFixed(3)} ${on(or)},
        скрытый Н2 (И-НЕ) = ${nand.toFixed(3)} ${on(nand)}.
        Выход (И от них) = <b>${y.toFixed(3)}</b> ${on(y)}.</p>
      <p>${Math.round(y) === expected
        ? `Верно: ${a} XOR ${b} = ${expected}.`
        : `Ожидалось ${expected} — что-то пошло не так.`}
        Большие веса (±20) делают сигмоиду почти «ступенькой», поэтому ответы близки к точным 0 и 1.</p>`;
  },
};
