// Регрессия: сеть предсказывает цену квартиры по четырём признакам. Обучается прямо в браузере.
import { MLP, seededRandom } from '../src/engine/models/mlp.js';
import { lineChartSvg } from '../src/engine/chart.js';

const FEATURES = [
  { name: 'Площадь', unit: 'м²', min: 25, max: 150 },
  { name: 'Комнаты', unit: '', min: 1, max: 5, int: true },
  { name: 'До центра', unit: 'км', min: 1, max: 25 },
  { name: 'Возраст дома', unit: 'лет', min: 0, max: 60, int: true },
];

/** «Истинная» закономерность, по которой сгенерированы данные (млн ₽) — сеть её не знает */
const truePrice = ([area, rooms, dist, age]) => (0.11 * area + 0.6 * rooms) * (1.45 - 0.022 * dist) - 0.025 * age + 1.5;

// Синтетический набор данных: 400 квартир с шумом ±5%
const rnd = seededRandom(2024);
const DATA = Array.from({ length: 400 }, () => {
  const x = FEATURES.map(f => {
    const v = f.min + rnd() * (f.max - f.min);
    return f.int ? Math.round(v) : v;
  });
  x[1] = Math.max(1, Math.min(5, Math.round(x[0] / 30 + (rnd() - 0.5) * 1.5))); // комнат обычно больше в больших квартирах
  return { x, y: truePrice(x) * (1 + (rnd() - 0.5) * 0.1) };
});

// Нормирование: сеть работает с числами порядка ±1, а не с «150 м²» и «12 млн»
const mean = FEATURES.map((_, k) => DATA.reduce((s, d) => s + d.x[k], 0) / DATA.length);
const std = FEATURES.map((_, k) => Math.sqrt(DATA.reduce((s, d) => s + (d.x[k] - mean[k]) ** 2, 0) / DATA.length));
const yMean = DATA.reduce((s, d) => s + d.y, 0) / DATA.length;
const yStd = Math.sqrt(DATA.reduce((s, d) => s + (d.y - yMean) ** 2, 0) / DATA.length);
const norm = x => x.map((v, k) => (v - mean[k]) / std[k]);
const denorm = z => z.map((v, k) => v * std[k] + mean[k]);

const APARTMENTS = [
  { name: 'Студия 28 м², 1 комн., 18 км, 5 лет', x: [28, 1, 18, 5] },
  { name: 'Двушка 54 м², 2 комн., 9 км, 30 лет', x: [54, 2, 9, 30] },
  { name: 'Трёшка 78 м², 3 комн., 4 км, 50 лет', x: [78, 3, 4, 50] },
  { name: 'Пентхаус 140 м², 5 комн., 2 км, 3 года', x: [140, 5, 2, 3] },
  { name: 'Дом-«хрущёвка» 44 м², 2 комн., 22 км, 60 лет', x: [44, 2, 22, 60] },
];

let history = [];
const fmtFeature = (f, v) => `${f.int ? Math.round(v) : v.toFixed(0)}${f.unit ? ` ${f.unit}` : ''}`;

export default {
  meta: {
    id: 'regression',
    title: 'Регрессия: предсказание цены квартиры',
    category: 'tasks',
    order: 10,
    level: 1,
    fidelity: 'trained',
    summary: 'Сеть 4 → 8 → 1 учится по 400 примерам оценивать цену квартиры по площади, числу комнат, расстоянию до центра и возрасту дома.',
    uses: 'Оценка недвижимости и автомобилей, прогноз спроса и продаж, расчёт времени доставки, кредитный скоринг.',
    tags: ['MLP', 'регрессия', 'табличные данные', 'нормирование'],
    preview: [4, 8, 1],
  },

  type: 'mlp',
  randomizable: false,
  createModel() {
    const net = new MLP([4, 8, 1], { activation: 'tanh', outputActivation: 'linear', seed: 5 });
    const X = DATA.map(d => norm(d.x)), Y = DATA.map(d => [(d.y - yMean) / yStd]);
    history = net.fit(X, Y, { epochs: 120, lr: 0.02 });
    return net;
  },
  names: { input: FEATURES.map(f => f.name), output: ['Цена'] },
  inputs: APARTMENTS.map(a => ({ name: a.name, values: norm(a.x) })),

  explainResult(ctx, acts) {
    const raw = denorm(acts[0]).map((v, k) => Math.min(FEATURES[k].max, Math.max(FEATURES[k].min, v)));
    const pred = acts.at(-1)[0] * yStd + yMean;
    const truth = truePrice(raw);
    const err = Math.abs(pred - truth) / truth;
    return `
      <p class="big-number">≈ ${pred.toFixed(1)} млн ₽</p>
      <table class="arch-table"><tbody>
        ${FEATURES.map((f, k) => `<tr><td>${f.name}</td><td class="num">${fmtFeature(f, raw[k])}</td><td class="num muted">→ ${acts[0][k] >= 0 ? '+' : '−'}${Math.abs(acts[0][k]).toFixed(2)}</td></tr>`).join('')}
      </tbody></table>
      <p>По формуле, из которой сгенерированы данные, цена ≈ <b>${truth.toFixed(1)} млн ₽</b> — ошибка сети ${(err * 100).toFixed(0)}%.
        Выходной нейрон линейный (без функции активации): регрессия выдаёт любое число, а не вероятность.</p>
      <p class="small muted">Числа во входном слое — нормированные признаки: (значение − среднее) / разброс. Цена на выходе тоже нормирована и переводится обратно в рубли.</p>
      <p class="list-title">Ошибка (MSE) во время обучения</p>
      ${lineChartSvg([{ values: history, color: '#ff9f1c' }], { xLabel: 'эпоха', yLabel: 'MSE', logY: true })}`;
  },

  intro: `<p>Регрессия — это предсказание <b>числа</b>, а не класса. Сеть обучилась при открытии страницы на 400 синтетических квартирах
    (120 эпох градиентного спуска). Выберите квартиру во «Входных данных» и запустите forward pass.</p>`,

  sections: [
    {
      title: 'Что попробовать',
      open: false,
      html: `<ul class="steps">
          <li>Сравните «Студию» и «Пентхаус»: наведите на скрытые нейроны — какие из них реагируют на площадь, а какие на расстояние?</li>
          <li>Наведите на связь «Площадь → скрытый нейрон»: у важных признаков веса больше по модулю.</li>
          <li>Выберите «Случайный вход» — это случайная точка в пространстве нормированных признаков.</li>
        </ul>`,
    },
  ],
};
