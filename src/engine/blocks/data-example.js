// Встроенный пример данных: синтетические точки, регрессия или картинки цифр.
import { EXAMPLES, makeExample } from '../graph/data.js';
import { L } from '../../i18n/i18n.js';

export default {
  id: 'data-example',
  title: L('blk.data-example.title'),
  group: 'data',
  info: L('blk.data-example.info'),
  inputs: [],
  outputs: [{ id: 'data', title: L('blk.port.data'), type: 'data' }],
  params: [
    { id: 'example', title: L('blk.data-example.p.example'), kind: 'select', options: EXAMPLES, default: 'moons' },
    { id: 'count', title: L('blk.data-example.p.count'), kind: 'number', min: 20, max: 2000, step: 10, int: true, default: 400 },
    { id: 'noise', title: L('blk.data-example.p.noise'), kind: 'number', min: 0, max: 1, step: 0.01, default: 0.12 },
    { id: 'seed', title: L('blk.p.seed'), kind: 'number', min: 1, max: 99999, step: 1, int: true, default: 1 },
  ],
  summary: p => L('blk.data-example.summary', { name: EXAMPLES.find(e => e[0] === p.example)?.[1] ?? p.example, n: String(p.count) }),
  run({ params: p }) {
    return { outputs: { data: makeExample(p.example, p.count, p.seed, p.noise) } };
  },
};
