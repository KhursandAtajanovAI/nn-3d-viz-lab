// Выполнение графа блоков в основном потоке: топологический порядок, блоки по очереди,
// выходы передаются по связям. Долгие блоки уступают поток через ctx.tick() — так работают
// индикатор прогресса и кнопка «Остановить». Пользовательский код не исполняется: только функции блоков из реестра.
import { blockParams } from '../blocks/index.js';

export class Cancelled extends Error {
  constructor() { super('Остановлено'); this.name = 'Cancelled'; }
}

/** Порядок выполнения (Кан); при цикле — ошибка */
export function topoOrder(nodes, edges) {
  const indeg = new Map(nodes.map(n => [n.id, 0]));
  const next = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) {
    if (!indeg.has(e.from[0]) || !indeg.has(e.to[0])) continue;
    indeg.set(e.to[0], indeg.get(e.to[0]) + 1);
    next.get(e.from[0]).push(e.to[0]);
  }
  // Устойчивый порядок: слева направо, сверху вниз
  const byPos = (a, b) => a.x - b.x || a.y - b.y;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const queue = nodes.filter(n => indeg.get(n.id) === 0).sort(byPos);
  const order = [];
  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    for (const m of next.get(n.id)) {
      indeg.set(m, indeg.get(m) - 1);
      if (indeg.get(m) === 0) { queue.push(byId.get(m)); queue.sort(byPos); }
    }
  }
  if (order.length !== nodes.length) throw new Error('В графе есть цикл — уберите связь, которая замыкает круг');
  return order;
}

/**
 * @param {{ nodes, edges }} graph
 * @param {Map<string, object>} blocks — реестр
 * @param {object} hooks — onNode(node, state, info), onProgress(fraction, text), getDataset(id), isCancelled()
 * @returns {Promise<Map<string, { state, error?, view?, outputs? }>>}
 */
export async function runGraph(graph, blocks, hooks) {
  const order = topoOrder(graph.nodes, graph.edges);
  const results = new Map();
  let lastYield = performance.now();

  for (let k = 0; k < order.length; k++) {
    const node = order[k];
    const block = blocks.get(node.block);
    const base = k / order.length, span = 1 / order.length;
    const report = (state, info = {}) => { results.set(node.id, { state, ...info }); hooks.onNode(node, state, info); };
    if (!block) { report('error', { error: `Неизвестный блок «${node.block}»` }); continue; }

    // Входы: по связям от уже выполненных блоков
    const inputs = {};
    let missing = null, upstreamFailed = false;
    for (const port of block.inputs) {
      const e = graph.edges.find(x => x.to[0] === node.id && x.to[1] === port.id);
      if (!e) { if (!port.optional) missing = missing ?? port.title; continue; }
      const src = results.get(e.from[0]);
      if (!src || src.state !== 'ok') { upstreamFailed = true; continue; }
      const v = src.outputs?.[e.from[1]];
      if (v === undefined) { upstreamFailed = true; continue; }
      inputs[port.id] = v;
    }
    if (upstreamFailed) { report('skipped', { error: 'Пропущен: предыдущий блок не выполнился' }); continue; }
    if (missing) { report('skipped', { error: `Не подключён вход «${missing}»` }); continue; }

    report('running');
    hooks.onProgress(base, block.title);
    const ctx = {
      node,
      getDataset: hooks.getDataset,
      /** Уступить поток (не чаще ~30 мс), обновить прогресс и проверить отмену */
      async tick(fraction = 0, text = '') {
        if (hooks.isCancelled()) throw new Cancelled();
        const now = performance.now();
        if (now - lastYield < 30) return;
        hooks.onProgress(base + span * Math.min(1, fraction), `${block.title}: ${text}`);
        await new Promise(r => setTimeout(r));
        lastYield = performance.now();
        if (hooks.isCancelled()) throw new Cancelled();
      },
    };
    try {
      const out = (await block.run({ inputs, params: blockParams(block, node.params), ctx })) ?? {};
      report('ok', { outputs: out.outputs ?? {}, view: out.view });
    } catch (e) {
      if (e instanceof Cancelled) { report('skipped', { error: 'Остановлено' }); throw e; }
      console.error(e);
      report('error', { error: e.message || String(e) });
    }
    if (hooks.isCancelled()) throw new Cancelled();
    // Между блоками тоже отдаём поток, чтобы интерфейс успевал обновиться
    await new Promise(r => setTimeout(r));
    lastYield = performance.now();
  }
  hooks.onProgress(1, 'Готово');
  return results;
}
