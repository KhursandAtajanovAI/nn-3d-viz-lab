// Вариационный автоэнкодер (VAE): сжимает картинку не в точку, а в распределение, из которого можно генерировать новое.
import { generateDigit, DIGIT_CLASSES } from '../src/engine/models/generators.js';
import { blurImage, demoActivations } from '../src/engine/models/libraryHelpers.js';

// Условные «центры» цифр в двумерном латентном пространстве
const CENTERS = [[-1.6, 0.4], [1.8, 1.2], [-0.3, -1.5], [0.6, -0.8], [1.4, -1.6], [-0.9, -0.4], [-1.5, 1.4], [2, 0.1], [0.1, 0.4], [0.9, 1.6]];

export default {
  meta: {
    id: 'vae',
    title: 'VAE: вариационный автоэнкодер',
    category: 'library',
    order: 80,
    level: 3,
    fidelity: 'demo',
    fidelityNote: 'Архитектура VAE точная. Восстановленная картинка здесь — размытие входа, а латентные числа — демонстрационные.',
    summary: 'Энкодер сжимает цифру до двух чисел — но не точных, а «облака» (среднее μ и разброс σ). Из любой точки этого пространства декодер рисует правдоподобную цифру.',
    uses: 'Генерация и интерполяция картинок, сжатие данных, поиск аномалий; латентное пространство VAE используется в Stable Diffusion.',
    tags: ['VAE', 'автоэнкодер', 'генерация', 'латентное пространство'],
    preview: { blocks: [[1, 0.1], [0.55, 0.3], [0.3, 0.5], [0.4, 0.12], [0.2, 0.12], [0.15, 0.12], [0.3, 0.5], [0.55, 0.3], [1, 0.1]] },
  },

  type: 'stack',
  layers: [
    { name: 'Вход 28×28', kind: 'input', shape: [28, 28, 1], maps: true, slices: 1 },
    { name: 'Свёртка', kind: 'conv', kernel: 3, shape: [14, 14, 32], params: 320 },
    { name: 'Свёртка', kind: 'conv', kernel: 3, shape: [7, 7, 64], params: 18496 },
    { name: 'Dense', kind: 'dense', shape: [16], params: 50192 },
    { name: 'μ и σ', kind: 'latent', shape: [4], params: 68, note: 'Два средних μ и два разброса σ: энкодер описывает не точку, а «облако» вероятных кодов.' },
    { name: 'z = μ + σ·ε', kind: 'sample', shape: [2], note: 'Берём случайную точку из облака. Благодаря этому латентное пространство получается «гладким».' },
    { name: 'Dense + reshape', kind: 'dense', shape: [7, 7, 64], params: 9408 },
    { name: 'Развёртка', kind: 'deconv', kernel: 3, shape: [14, 14, 32], params: 18464 },
    { name: 'Восстановление', kind: 'deconv', kernel: 3, shape: [28, 28, 1], maps: true, slices: 1, params: 289 },
  ],
  totalParams: 97237,
  groups: [
    { from: 0, to: 4, label: 'Энкодер', color: 0xff9f1c },
    { from: 5, to: 8, label: 'Декодер', color: 0x2f9bff },
  ],
  input: { kind: 'image', size: 28, channels: 1, classes: DIGIT_CLASSES, generate: generateDigit },

  demo(img, { sample, rnd }) {
    const c = CENTERS[sample?.label ?? 0];
    const mu = c.map(v => v + (rnd() - 0.5) * 0.3);
    const sigma = [0.15 + rnd() * 0.15, 0.15 + rnd() * 0.15];
    const z = mu.map((m, i) => m + sigma[i] * (rnd() * 2 - 1));
    return { maps: { 8: blurImage(img, 1) }, vectors: { 3: demoActivations(rnd, 12), 4: [...mu, ...sigma], 5: z }, probs: [], mu, sigma, z };
  },

  explainResult(r) {
    return `<p>Энкодер описал картинку «облаком» с центром μ = (${r.mu.map(v => v.toFixed(2)).join('; ')}) и разбросом σ = (${r.sigma.map(v => v.toFixed(2)).join('; ')}).
      Из него взята точка z = (${r.z.map(v => v.toFixed(2)).join('; ')}), по которой декодер нарисовал цифру — чуть более размытую, чем исходная.</p>
      <p class="small muted">Отличие от обычного автоэнкодера (<a href="space.html?id=autoencoder">пространство «Автоэнкодер»</a>): коды разных цифр образуют
      сплошную область, и точка между «3» и «8» даст правдоподобную смесь, а не мусор.</p>`;
  },

  intro: `<p>Обычный автоэнкодер кодирует картинку одной точкой, и между точками в его латентном пространстве — «пустота».
    VAE (Кингма и Веллинг, 2013) кодирует <b>распределение</b> и штрафует его за слишком большую уверенность.
    Благодаря этому из <b>любой</b> точки пространства получается осмысленная картинка — VAE умеет генерировать.</p>`,
};
