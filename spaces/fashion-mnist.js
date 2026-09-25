// Fashion-MNIST: та же сеть, что и для цифр, но на силуэтах одежды и обуви.
import { syntheticVision, HOW_SYNTHETIC_WORKS } from '../src/engine/models/syntheticVision.js';
import { generateFashion, FASHION_CLASSES } from '../src/engine/models/generators.js';

export default {
  meta: {
    id: 'fashion-mnist',
    title: 'Fashion-MNIST: одежда и обувь',
    category: 'vision',
    order: 20,
    level: 1,
    fidelity: 'trained',
    summary: 'Десять видов одежды 28×28: футболки, брюки, платья, кроссовки… Видно, какие классы сеть путает между собой.',
    uses: 'Каталоги интернет-магазинов: автоматическая сортировка товаров по фотографиям, поиск похожей одежды.',
    tags: ['CNN', 'свёртки', 'классификация', 'Fashion-MNIST'],
    preview: { blocks: [[1, 0.1], [0.85, 0.5], [0.45, 0.5], [0.35, 0.7], [0.18, 0.7], [0.6, 0.12], [0.35, 0.12], [0.25, 0.12]] },
  },

  ...syntheticVision({ size: 28, channels: 1, classes: FASHION_CLASSES, generate: generateFashion }),

  intro: `
    <p>Fashion-MNIST (Zalando, 2017) — «замена» MNIST такого же размера: 70 000 чёрно-белых картинок 28×28, 10 классов одежды.
    Задача сложнее цифр: футболка, рубашка, свитер и пальто похожи по силуэту.
    Здесь та же архитектура, что в пространстве MNIST, — меняются только данные.</p>`,

  sections: [
    { title: 'Как это работает', html: HOW_SYNTHETIC_WORKS },
    {
      title: 'Почему классы путаются',
      open: false,
      html: `<p>У футболки, рубашки, свитера и пальто общий силуэт «корпус + рукава». Различия — в длине рукавов,
        воротнике, застёжке и длине изделия. Если на картах признаков эти детали выражены слабо, вероятность
        делится между несколькими «верхними» классами. На настоящем Fashion-MNIST хорошие сети ошибаются
        чаще всего именно на классе «Рубашка».</p>`,
    },
  ],

  explainResult(result, { classes }) {
    const order = result.probs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const [[p1, c1], [p2, c2]] = order;
    const close = p1 - p2 < 0.25;
    return `<p>Ответ: <b>«${classes[c1]}»</b> (${Math.round(p1 * 100)}%).
      ${close ? `Сеть колеблется: почти столько же за «${classes[c2]}» (${Math.round(p2 * 100)}%) — эти вещи похожи по форме.` : `Второй вариант «${classes[c2]}» заметно слабее (${Math.round(p2 * 100)}%).`}</p>`;
  },
};
