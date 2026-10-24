// Отдельная функция активации (если слою она не задана).
export default {
  id: 'activation',
  title: 'Активация',
  group: 'model',
  info: 'Применяет функцию к каждому выходу предыдущего слоя: ReLU, tanh, sigmoid или softmax (вероятности классов).',
  inputs: [{ id: 'model', title: 'Модель', types: ['model'] }],
  outputs: [{ id: 'model', title: 'Модель', type: 'model' }],
  params: [
    { id: 'fn', title: 'Функция', kind: 'select', options: [['relu', 'ReLU'], ['tanh', 'tanh'], ['sigmoid', 'sigmoid'], ['softmax', 'softmax']], default: 'relu' },
  ],
  summary: p => p.fn,
  run({ inputs, params: p }) {
    return { outputs: { model: { spec: [...inputs.model.spec, { type: 'activation', fn: p.fn }] } } };
  },
};
