// Общие описания слоёв для трансформеров (Transformer, GPT, BERT) — чтобы не повторять одно и то же.
import { L, fmtNum } from '../../i18n/i18n.js';

export const tokensIn = (n, note) => ({ name: L('tf.tokens'), kind: 'input', shape: [n], note: note ?? L('tf.tokensNote') });

export const embedding = (n, d, vocab) => ({
  name: L('tf.embed'), kind: 'embed', shape: [n, d], params: vocab * d,
  note: L('tf.embedNote', { vocab, d }),
});

export const positions = (n, d) => ({ name: L('tf.pos'), kind: 'posenc', shape: [n, d], note: L('tf.posNote') });

/** Блок трансформера: внимание + норма + feed-forward (+ норма). repeat — сколько таких блоков подряд */
export function block({ n, d, heads, repeat, masked = false, cross = false, label = '' }) {
  const attnParams = 4 * d * d + 4 * d;
  const ffnParams = 2 * d * 4 * d + 5 * d;
  const layers = [
    { name: L(masked ? 'tf.maskedAttn' : 'tf.selfAttn', { label }), kind: 'attention', shape: [n, d], repeat, params: attnParams * repeat,
      note: L(masked ? 'tf.headsMasked' : 'tf.heads', { n: heads }) },
  ];
  if (cross) layers.push({ name: L('tf.cross', { label }), kind: 'attention', shape: [n, d], repeat, params: attnParams * repeat, note: L('tf.crossNote') });
  layers.push(
    { name: L('tf.addNorm', { label }), kind: 'norm', shape: [n, d], repeat, params: 2 * d * repeat, note: L('tf.normNote') },
    { name: L('tf.ffn', { label }), kind: 'ffn', shape: [n, 4 * d], repeat, params: ffnParams * repeat, note: L('tf.ffnNote', { d, d4: 4 * d }) },
  );
  return layers;
}
