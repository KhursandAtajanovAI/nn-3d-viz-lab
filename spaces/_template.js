// Шаблон пространства. Скопируйте файл как spaces/<ваш-id>.js (без «_» в начале) и заполните поля.
// Файлы, начинающиеся с «_», в каталог не попадают. Подробности — в spaces/README.md.
//
// Тексты пространства — в словарях: src/i18n/ru/spaces/<ваш-id>.js и src/i18n/en/spaces/<ваш-id>.js
// (по одному объекту { title, summary, uses, introHtml, … }) и строка импорта в src/i18n/<язык>/index.js.
// Здесь на них ссылаются через S('ключ'); ключи на …Html могут содержать разметку.
import { scope } from '../src/i18n/i18n.js';

const S = scope('sp.my-space');

export default {
  meta: {
    id: 'my-space',                 // = имя файла без .js: латиница в нижнем регистре, цифры, дефисы
    title: S('title'),
    category: 'basics',             // basics | vision | nlp | tasks | training | library (src/engine/catalog.js)
    fidelity: 'real',               // real | trained | demo — насколько «настоящие» числа
    order: 100,                     // порядок внутри категории
    level: 1,                       // 1 — начальный, 2 — средний, 3 — продвинутый
    summary: S('summary'),          // одно-два предложения: что показывает пространство
    uses: S('uses'),                // где такая сеть применяется в реальной жизни
    tags: ['MLP'],                  // id тегов: подписи — в словаре (tag.<id>), неизвестные показываются как есть
    preview: [4, 8, 3],             // мини-схема для карточки каталога: нейронов в слоях
  },

  type: 'mlp',                      // визуализатор (src/engine/boot.js)
  model: { layers: [4, 8, 3], activation: 'tanh', outputActivation: 'sigmoid', seed: 1 },

  // Необязательно:
  // names: { input: [S('in.0'), …], output: [S('out.0'), …] },
  // inputs: [{ name: S('example1'), values: [0.1, 0.5, …] }],
  // randomizable: false,          // спрятать кнопку «Новые веса»
  // createModel() { … },          // своя модель вместо model (например, с готовыми весами)
  // explainResult(ctx, acts, helpers) { return `<p>${S.h('result', { … })}</p>`; },

  intro: S('introHtml'),
  sections: [
    { title: S('howTitle'), html: S('howHtml') },
  ],
};
