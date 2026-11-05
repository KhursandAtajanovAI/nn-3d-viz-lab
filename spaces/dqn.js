// DQN (2015): нейросеть по кадрам игры предсказывает ценность каждого действия.
// Тексты — в словарях src/i18n/<язык>/spaces/dqn.js.
import { scope, str } from '../src/i18n/i18n.js';

const T = scope('sp.dqn');
const S = 84;
const ACTIONS = T.list('actions', 3);

/** Четыре последних кадра упрощённого Pong: сеть видит движение мяча по разнице кадров */
function frames(cls, rnd) {
  const n = S * S, data = new Float32Array(n * 4);
  const paddleY = 20 + rnd() * 44, oppY = 20 + rnd() * 44;
  const up = cls === 0;
  let bx = 20 + rnd() * 30, by = up ? 50 + rnd() * 25 : 10 + rnd() * 25;
  const vx = 4 + rnd() * 2, vy = up ? -(2 + rnd() * 2) : 2 + rnd() * 2;
  for (let f = 0; f < 4; f++) {
    const o = f * n;
    for (let i = 0; i < n; i++) data[o + i] = 0.08;
    const rect = (x0, y0, w, h, v) => {
      for (let y = Math.max(0, Math.round(y0)); y < Math.min(S, Math.round(y0 + h)); y++)
        for (let x = Math.max(0, Math.round(x0)); x < Math.min(S, Math.round(x0 + w)); x++) data[o + y * S + x] = v;
    };
    rect(4, oppY - 7, 3, 14, 0.8);        // ракетка соперника
    rect(77, paddleY - 7, 3, 14, 0.8);    // наша ракетка (агент)
    rect(bx, by, 3, 3, 0.2 + f * 0.26);   // мяч: ярче в последнем кадре
    bx += vx;
    by += vy;
  }
  return { w: S, h: S, c: 4, data, paddleY, ballY: by, vy };
}

export default {
  meta: {
    id: 'dqn',
    title: T('title'),
    category: 'library',
    order: 90,
    level: 3,
    fidelity: 'demo',
    fidelityNote: T('fidelityNote'),
    summary: T('summary'),
    uses: T('uses'),
    tags: ['rl', 'DQN', 'CNN', 'games', 'Q-learning'],
    preview: { blocks: [[1, 0.35], [0.5, 0.4], [0.3, 0.55], [0.25, 0.55], [0.5, 0.12], [0.2, 0.12]] },
  },

  type: 'stack',
  layers: [
    { name: T('l.input'), kind: 'input', shape: [84, 84, 4], maps: true, slices: 4, note: T('n.input') },
    { name: T('l.conv1'), kind: 'conv', kernel: 8, shape: [20, 20, 32], params: 8224 },
    { name: T('l.conv2'), kind: 'conv', kernel: 4, shape: [9, 9, 64], params: 32832 },
    { name: 'Conv 3×3', kind: 'conv', kernel: 3, shape: [7, 7, 64], params: 36928 },
    { name: 'Dense 512', kind: 'dense', shape: [512], params: 1606144 },
    { name: T('l.q'), kind: 'output', format: 'value', valueLabel: T('qValue'), shape: [3], params: 1539, note: T('n.q') },
  ],
  totalParams: 1685667,
  outputNames: ACTIONS,
  resultClasses: ACTIONS,
  resultFormat: 'value',
  input: { kind: 'image', size: S, channels: 4, classes: T.list('classes', 2), generate: frames },

  demo(img, { rnd }) {
    // Куда прилетит мяч к нашей ракетке — туда и выгодно двигаться
    const target = Math.max(0, Math.min(S, img.ballY + img.vy * 3));
    const diff = target - img.paddleY;
    const q = [0.45 + rnd() * 0.1, 0.45 + rnd() * 0.1, 0.45 + rnd() * 0.1];
    if (Math.abs(diff) < 4) q[0] += 0.45; else if (diff < 0) q[1] += 0.5; else q[2] += 0.5;
    const hidden = Array.from({ length: 12 }, () => Math.max(0, rnd() * 1.6 - 0.5));
    return { vectors: { 4: hidden, 5: q }, probs: q, diff };
  },

  explainResult(r) {
    const best = r.probs.indexOf(Math.max(...r.probs));
    return T.h('explainHtml', {
      action: str(ACTIONS[best]),
      where: T.t(Math.abs(r.diff) < 4 ? 'where.hit' : r.diff < 0 ? 'where.above' : 'where.below'),
      move: T.t(best === 0 ? 'move.stay' : best === 1 ? 'move.up' : 'move.down'),
    });
  },

  intro: T('introHtml'),
};
