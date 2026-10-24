// Встроенный пример данных: синтетические точки, регрессия или картинки цифр.
import { EXAMPLES, makeExample } from '../graph/data.js';

export default {
  id: 'data-example',
  title: 'Встроенный пример',
  group: 'data',
  info: 'Готовые синтетические данные: точки двух-трёх классов, синусоида или картинки цифр.',
  inputs: [],
  outputs: [{ id: 'data', title: 'Данные', type: 'data' }],
  params: [
    { id: 'example', title: 'Пример', kind: 'select', options: EXAMPLES, default: 'moons' },
    { id: 'count', title: 'Число строк', kind: 'number', min: 20, max: 2000, step: 10, int: true, default: 400 },
    { id: 'noise', title: 'Шум', kind: 'number', min: 0, max: 1, step: 0.01, default: 0.12 },
    { id: 'seed', title: 'Зерно случайности', kind: 'number', min: 1, max: 99999, step: 1, int: true, default: 1 },
  ],
  summary: p => `${EXAMPLES.find(e => e[0] === p.example)?.[1] ?? p.example} · ${p.count}`,
  run({ params: p }) {
    return { outputs: { data: makeExample(p.example, p.count, p.seed, p.noise) } };
  },
};
