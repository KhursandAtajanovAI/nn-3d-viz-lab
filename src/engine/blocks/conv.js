// Свёрточный слой 2D (без дополнения краёв, шаг 1) — для датасетов картинок.
export default {
  id: 'conv',
  title: 'Свёртка 2D',
  group: 'model',
  info: 'Фильтры k×k скользят по картинке и находят местные узоры (края, штрихи). Нужен датасет картинок.',
  inputs: [{ id: 'model', title: 'Модель', types: ['model'], optional: true }],
  outputs: [{ id: 'model', title: 'Модель', type: 'model' }],
  params: [
    { id: 'filters', title: 'Фильтров', kind: 'number', min: 1, max: 16, step: 1, int: true, default: 4 },
    { id: 'kernel', title: 'Размер ядра', kind: 'select', options: [[3, '3 × 3'], [5, '5 × 5']], default: 3 },
    { id: 'activation', title: 'Активация', kind: 'select', options: [['relu', 'ReLU'], ['tanh', 'tanh'], ['linear', 'без активации']], default: 'relu' },
  ],
  summary: p => `${p.filters} × ${p.kernel}×${p.kernel} · ${p.activation}`,
  run({ inputs, params: p }) {
    return { outputs: { model: { spec: [...(inputs.model?.spec ?? []), { type: 'conv', filters: p.filters, kernel: Number(p.kernel), activation: p.activation }] } } };
  },
};
