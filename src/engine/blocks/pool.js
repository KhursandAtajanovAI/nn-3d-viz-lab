// Max-пулинг: уменьшает карты признаков, оставляя максимум в каждом окне.
export default {
  id: 'pool',
  title: 'Пулинг (max)',
  group: 'model',
  info: 'Берёт максимум в каждом окне p×p — карты признаков становятся меньше, сеть быстрее и устойчивее к сдвигам.',
  inputs: [{ id: 'model', title: 'Модель', types: ['model'] }],
  outputs: [{ id: 'model', title: 'Модель', type: 'model' }],
  params: [{ id: 'size', title: 'Окно', kind: 'select', options: [[2, '2 × 2'], [3, '3 × 3']], default: 2 }],
  summary: p => `${p.size}×${p.size}`,
  run({ inputs, params: p }) {
    return { outputs: { model: { spec: [...inputs.model.spec, { type: 'pool', size: Number(p.size) }] } } };
  },
};
