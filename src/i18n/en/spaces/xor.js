export default {
  title: 'XOR: a task one neuron cannot solve',
  summary: 'A 2 → 2 → 1 network with hand-picked weights correctly computes "exclusive OR".',
  uses: 'A classic example from AI history: XOR is exactly what showed why hidden layers are needed.',
  introHtml: `
    <p>XOR ("exclusive OR") outputs 1 when exactly one of the inputs is 1.
    A single neuron cannot do this: it can only draw one straight boundary, and the XOR points
    cannot be separated that way. Two hidden neurons solve the task together.</p>`,
  howTitle: 'How it works',
  howHtml: `
        <ul class="steps">
          <li><b>Hidden N1</b> acts as <b>OR</b>: it lights up if at least one input is 1.</li>
          <li><b>Hidden N2</b> acts as <b>NAND</b>: it goes dark only if both inputs are 1.</li>
          <li><b>The output</b> acts as <b>AND</b>: it lights up when both hidden neurons are on.</li>
        </ul>
        <p class="muted">OR and NAND are both true only when the inputs differ — and that is XOR.
        Pick an input under "Controls" and hover over the hidden neurons.</p>`,
  resultHtml: 'Input A = {a}, B = {b}. Hidden N1 (OR) = {or} {orOn}, hidden N2 (NAND) = {nand} {nandOn}. Output (AND of them) = <b>{y}</b> {yOn}.',
  correct: 'Correct: {a} XOR {b} = {y}.',
  wrong: 'Expected {y} — something went wrong.',
  bigWeights: 'Large weights (±20) turn the sigmoid into almost a "step", so the answers are close to exact 0 and 1.',
};
