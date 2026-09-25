// Пошаговая анимация forward-pass: слой → связи → следующий слой → ...
// Этапы: 0 — входной слой, 1 — связи 0→1, 2 — слой 1, 3 — связи 1→2, ...

export class ForwardPassAnimation {
  constructor(view) {
    this.view = view;
    this.running = false;
    this.stageDuration = 0.6; // секунд на этап
  }

  start(activations, onDone) {
    this.activations = activations;
    this.onDone = onDone;
    this.stage = 0;
    this.t = 0;
    this.running = true;
    this.view.reset();
  }

  stop() {
    this.running = false;
    this.view.reset();
  }

  get totalStages() {
    return this.activations.length * 2 - 1;
  }

  update(dt) {
    if (!this.running) return;
    this.t += dt / this.stageDuration;
    const ease = t => t * t * (3 - 2 * t);

    while (this.t >= 1 && this.running) {
      this.applyStage(this.stage, 1);
      this.t -= 1;
      this.stage++;
      if (this.stage >= this.totalStages) {
        this.running = false;
        this.onDone?.(this.activations);
        return;
      }
    }
    this.applyStage(this.stage, ease(this.t));
  }

  applyStage(stage, t) {
    const l = stage >> 1;
    if (stage % 2 === 0) {
      this.activations[l].forEach((a, i) => this.view.setNeuron(l, i, a, t));
      // Связи предыдущего промежутка плавно гаснут, пока загорается слой
      if (l > 0) this.view.setConnections(l - 1, 1, 1 - t);
    } else {
      this.view.setConnections(l, t, 1);
    }
  }

  /** Текущий активный слой (для подписи в UI) */
  get currentLayer() {
    return this.stage >> 1;
  }
}
