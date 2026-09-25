// Шаблон пространства. Скопируйте файл как spaces/<ваш-id>.js (без «_» в начале) и заполните поля.
// Файлы, начинающиеся с «_», в каталог не попадают. Подробности — в spaces/README.md.
export default {
  meta: {
    id: 'my-space',                 // = имя файла без .js: латиница в нижнем регистре, цифры, дефисы
    title: 'Название пространства',
    category: 'basics',             // basics | vision | nlp | tasks | training | library (src/engine/catalog.js)
    fidelity: 'real',               // real | trained | demo — насколько «настоящие» числа
    order: 100,                     // порядок внутри категории
    level: 1,                       // 1 — начальный, 2 — средний, 3 — продвинутый
    summary: 'Одно-два предложения: что показывает пространство.',
    uses: 'Где такая сеть применяется в реальной жизни.',
    tags: ['MLP'],
    preview: [4, 8, 3],             // мини-схема для карточки каталога: нейронов в слоях
  },

  type: 'mlp',                      // визуализатор (src/engine/boot.js)
  model: { layers: [4, 8, 3], activation: 'tanh', outputActivation: 'sigmoid', seed: 1 },

  // Необязательно:
  // names: { input: ['Вход 1', …], output: ['Класс A', …] },
  // inputs: [{ name: 'Пример 1', values: [0.1, 0.5, …] }],
  // randomizable: false,          // спрятать кнопку «Новые веса»
  // createModel() { … },          // своя модель вместо model (например, с готовыми весами)
  // explainResult(ctx, acts, helpers) { return '<p>…</p>'; },

  intro: `<p>Короткое описание сцены для карточки «Сцена».</p>`,
  sections: [
    { title: 'Как это работает', html: `<p>Пояснение простыми словами.</p>` },
  ],
};
