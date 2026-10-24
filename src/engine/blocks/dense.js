// Полносвязный слой: добавляется в конец модели.
export default {
  id: 'dense',
  title: 'Полносвязный слой',
  group: 'model',
  info: 'Каждый нейрон связан со всеми входами. Первый слой модели можно оставить без входа — модель начнётся с него.',
  inputs: [{ id: 'model', title: 'Модель', types: ['model'], optional: true }],
  outputs: [{ id: 'model', title: 'Модель', type: 'model' }],
  params: [
    { id: 'units', title: 'Нейронов', kind: 'number', min: 1, max: 256, step: 1, int: true, default: 16 },
    { id: 'activation', title: 'Активация', kind: 'select', options: [['relu', 'ReLU'], ['tanh', 'tanh'], ['sigmoid', 'sigmoid'], ['softmax', 'softmax'], ['linear', 'без активации']], default: 'relu' },
  ],
  summary: p => `${p.units} · ${p.activation}`,
  run({ inputs, params: p }) {
    return { outputs: { model: { spec: [...(inputs.model?.spec ?? []), { type: 'dense', units: p.units, activation: p.activation }] } } };
  },
};
