// DQN (2015): нейросеть по кадрам игры предсказывает ценность каждого действия.
const S = 84;
const ACTIONS = ['ничего', 'ракетку вверх', 'ракетку вниз'];

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
    title: 'DQN: нейросеть играет в Atari (2015)',
    category: 'library',
    order: 90,
    level: 3,
    fidelity: 'demo',
    fidelityNote: 'Архитектура DQN точная, кадры игры настоящие (упрощённый Pong); Q-значения демонстрационные — по правилу «двигай ракетку к мячу».',
    summary: 'Свёрточная сеть смотрит на 4 последних кадра игры и выдаёт Q-значение каждого действия. Агент выбирает действие с наибольшим Q.',
    uses: 'Игровые ИИ (49 игр Atari на уровне человека), управление роботами и системами охлаждения дата-центров; предок AlphaGo и AlphaStar.',
    tags: ['обучение с подкреплением', 'DQN', 'CNN', 'игры', 'Q-learning'],
    preview: { blocks: [[1, 0.35], [0.5, 0.4], [0.3, 0.55], [0.25, 0.55], [0.5, 0.12], [0.2, 0.12]] },
  },

  type: 'stack',
  layers: [
    { name: '4 кадра 84×84', kind: 'input', shape: [84, 84, 4], maps: true, slices: 4, note: 'Кадры игры в оттенках серого. Одного кадра мало: по нему не понять, куда летит мяч.' },
    { name: 'Conv 8×8, шаг 4', kind: 'conv', kernel: 8, shape: [20, 20, 32], params: 8224 },
    { name: 'Conv 4×4, шаг 2', kind: 'conv', kernel: 4, shape: [9, 9, 64], params: 32832 },
    { name: 'Conv 3×3', kind: 'conv', kernel: 3, shape: [7, 7, 64], params: 36928 },
    { name: 'Dense 512', kind: 'dense', shape: [512], params: 1606144 },
    { name: 'Q-значения', kind: 'output', format: 'value', shape: [3], params: 1539, note: 'По одному числу на действие: ожидаемая сумма будущих наград, если сделать это действие.' },
  ],
  totalParams: 1685667,
  outputNames: ACTIONS,
  resultClasses: ACTIONS,
  resultFormat: 'value',
  input: { kind: 'image', size: S, channels: 4, classes: ['Мяч летит вверх', 'Мяч летит вниз'], generate: frames },

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
    return `<p>Наибольшее Q у действия <b>«${ACTIONS[best]}»</b> — его агент и выберет.
      Мяч прилетит ${Math.abs(r.diff) < 4 ? 'прямо в ракетку' : r.diff < 0 ? 'выше ракетки' : 'ниже ракетки'}, поэтому выгодно ${best === 0 ? 'стоять на месте' : best === 1 ? 'подняться' : 'опуститься'}.</p>
      <p class="small muted">Q-значения — не вероятности: это ожидаемая награда, их сумма не обязана быть 100%. Как Q-значения выучиваются, показано в пространстве
      <a href="space.html?id=q-learning">Q-learning</a> (там таблица вместо нейросети).</p>`;
  },

  intro: `<p>В 2015 году DeepMind показала сеть, которая научилась играть в 49 игр Atari, видя только пиксели экрана и счёт.
    Это Q-learning, где таблицу Q заменила <b>свёрточная нейросеть</b>: на вход — 4 последних кадра, на выход — Q-значения действий.
    Наведите курсор на входные кадры: мяч в них смещается.</p>`,
};
