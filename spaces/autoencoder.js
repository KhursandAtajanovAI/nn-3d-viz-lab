// Автоэнкодер: сеть сжимает картинку 3×3 до трёх чисел и восстанавливает обратно.
import { MLP, seededRandom } from '../src/engine/models/mlp.js';

const PATTERNS = {
  'Горизонталь': [0, 0, 0, 1, 1, 1, 0, 0, 0],
  'Вертикаль': [0, 1, 0, 0, 1, 0, 0, 1, 0],
  'Диагональ ↘': [1, 0, 0, 0, 1, 0, 0, 0, 1],
  'Диагональ ↗': [0, 0, 1, 0, 1, 0, 1, 0, 0],
  'Крест': [0, 1, 0, 1, 1, 1, 0, 1, 0],
  'Рамка': [1, 1, 1, 1, 0, 1, 1, 1, 1],
  'Уголок': [1, 1, 1, 1, 0, 0, 1, 0, 0],
  'Точка': [0, 0, 0, 0, 1, 0, 0, 0, 0],
};
const NAMES = Object.keys(PATTERNS);
const PIX = ['↖', '↑', '↗', '←', '•', '→', '↙', '↓', '↘'];

let codes = {};
let finalLoss = 0;

const grid = v => `<div class="pix-grid">${v.map(x => `<span style="--v:${Math.min(1, Math.max(0, x)).toFixed(2)}"></span>`).join('')}</div>`;

export default {
  meta: {
    id: 'autoencoder',
    title: 'Автоэнкодер: «бутылочное горлышко»',
    category: 'tasks',
    order: 20,
    level: 2,
    fidelity: 'trained',
    summary: 'Сеть 9 → 6 → 3 → 6 → 9 учится сжимать картинку 3×3 в три числа и восстанавливать её. Всё знание о картинке проходит через три нейрона.',
    uses: 'Сжатие и очистка изображений от шума, поиск аномалий (брак на производстве, мошеннические транзакции), генерация данных (VAE).',
    tags: ['MLP', 'автоэнкодер', 'сжатие', 'без учителя', 'латентное пространство'],
    preview: [9, 6, 3, 6, 9],
  },

  type: 'mlp',
  randomizable: false,
  createModel() {
    // 160 зашумлённых копий восьми узоров; ответ при обучении — сам вход
    const rnd = seededRandom(9);
    const X = [];
    for (let k = 0; k < 20; k++) {
      for (const p of Object.values(PATTERNS)) X.push(p.map(v => Math.min(1, Math.max(0, v + (rnd() - 0.5) * 0.2))));
    }
    const net = new MLP([9, 6, 3, 6, 9], { activation: 'tanh', outputActivation: 'sigmoid', seed: 7 });
    const hist = net.fit(X, X, { epochs: 1500, lr: 0.05 });
    finalLoss = hist.at(-1);
    codes = Object.fromEntries(NAMES.map(n => [n, net.forward(PATTERNS[n])[2]]));
    return net;
  },
  names: { input: PIX, output: PIX },
  inputs: NAMES.map(n => ({ name: n, values: PATTERNS[n] })),

  explainResult(ctx, acts) {
    const input = acts[0], out = acts.at(-1), code = acts[2];
    const mse = input.reduce((s, v, i) => s + (v - out[i]) ** 2, 0) / input.length;
    // Карта кодов всех узоров: проекция на первые два числа кода
    const all = Object.entries(codes);
    const xs = all.map(([, c]) => c[0]).concat(code[0]), ys = all.map(([, c]) => c[1]).concat(code[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const X = v => 20 + ((v - x0) / (x1 - x0 || 1)) * 230, Y = v => 150 - ((v - y0) / (y1 - y0 || 1)) * 130;
    const map = `<svg class="chart" viewBox="0 0 320 170">
      ${all.map(([n, c]) => `<circle cx="${X(c[0])}" cy="${Y(c[1])}" r="4" fill="#2f9bff" /><text x="${X(c[0]) + 6}" y="${Y(c[1]) + 4}" class="tick">${n}</text>`).join('')}
      <circle cx="${X(code[0])}" cy="${Y(code[1])}" r="7" fill="none" stroke="#ff9f1c" stroke-width="2.5" />
    </svg>`;
    return `
      <div class="ae-compare">
        <div><p class="list-title">Вход</p>${grid(input)}</div>
        <div class="arrow">→ <b class="num">(${code.map(v => v.toFixed(2)).join('; ')})</b> →</div>
        <div><p class="list-title">Восстановлено</p>${grid(out)}</div>
      </div>
      <p>9 пикселей сжаты до <b>трёх чисел</b> и восстановлены с ошибкой MSE = ${mse.toFixed(3)}
        (${mse < 0.02 ? 'почти идеально' : mse < 0.06 ? 'хорошо, детали слегка размыты' : 'заметно хуже — такой узор сеть не видела'}).</p>
      <p class="list-title">Латентное пространство (первые два числа кода из трёх)</p>
      ${map}
      <p class="small muted">Оранжевый круг — код текущего входа. Каждый узор получил свою точку — по ней декодер и восстанавливает картинку.
        Средняя ошибка на обучающих данных: ${finalLoss.toFixed(3)}.</p>`;
  },

  intro: `<p>Автоэнкодер учится <b>без учителя</b>: ответом служит сам вход. Левая половина сети (<b>энкодер</b>) сжимает 9 пикселей до 3 чисел —
    самого узкого слоя, «бутылочного горлышка». Правая половина (<b>декодер</b>) по этим трём числам восстанавливает картинку.
    Сеть обучилась при открытии страницы на 160 зашумлённых узорах (1500 эпох).</p>`,

  sections: [
    {
      title: 'Зачем сжимать',
      open: false,
      html: `<ul class="steps">
          <li><b>Сжатие:</b> три числа вместо девяти — сеть сама нашла, какие признаки важны.</li>
          <li><b>Поиск аномалий:</b> «обычные» данные восстанавливаются хорошо, а необычные — с большой ошибкой. Так ищут брак и мошенничество.
            Попробуйте «Случайный вход» — ошибка будет заметно выше.</li>
          <li><b>Генерация:</b> если взять точку в латентном пространстве и пропустить через декодер, получится новая картинка (так работают VAE).</li>
        </ul>
        <p class="muted small">Почему три нейрона, а не два: с двумя эти восемь узоров обучаются ненадёжно — результат сильно зависит от случайного начала обучения.</p>`,
    },
  ],
};
