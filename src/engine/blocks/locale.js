import { language } from '../i18n.js';

const TITLES = {
  activation: 'Activation',
  confusion: 'Confusion matrix',
  conv: '2D convolution',
  'data-example': 'Built-in example',
  'data-file': 'My dataset',
  dense: 'Dense layer',
  'feature-maps': 'Feature maps',
  images: 'Images',
  'loss-chart': 'Loss chart',
  metrics: 'Metrics',
  normalize: 'Normalization',
  onehot: 'One-hot encoding',
  pool: 'Max pooling',
  predictions: 'Predictions',
  scatter: 'Scatter plot',
  split: 'Train / test split',
  table: 'Table',
  'text-output': 'Text output',
  train: 'Training',
};

const GROUPS = { data: 'Data', prep: 'Preparation', model: 'Model', train: 'Training', result: 'Results' };
const PORTS = { data: 'data table', split: 'train / test', model: 'model (layers)', trained: 'trained model' };

export function localizedBlock(block) {
  if (language() !== 'en') return block;
  return {
    ...block,
    title: TITLES[block.id] ?? block.title,
    group: block.group,
    inputs: block.inputs?.map(p => ({ ...p, title: p.title === 'Данные' ? 'Data' : p.title === 'Модель' ? 'Model' : p.title })),
    outputs: block.outputs?.map(p => ({ ...p, title: p.title === 'Данные' ? 'Data' : p.title === 'Модель' ? 'Model' : p.title })),
    params: block.params?.map(p => ({ ...p, title: p.title })),
  };
}

export const localizedGroups = groups => language() === 'en'
  ? groups.map(([id]) => [id, GROUPS[id] ?? id])
  : groups;

export const localizedPorts = () => language() === 'en' ? PORTS : null;
