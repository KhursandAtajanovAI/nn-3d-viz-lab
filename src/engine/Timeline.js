// Простая временная шкала анимации: последовательность этапов, каждый со своей длительностью.
// update(dt) вызывается каждый кадр; этап получает прогресс t ∈ [0, 1].

export class Timeline {
  constructor() {
    this.running = false;
    this.speed = 1;
  }

  /**
   * @param {{ duration: number, update: (t: number) => void, label?: string }[]} stages
   * @param {() => void} [onDone]
   */
  start(stages, onDone) {
    this.stages = stages;
    this.onDone = onDone;
    this.index = 0;
    this.t = 0;
    this.running = stages.length > 0;
    if (!this.running) onDone?.();
  }

  stop() { this.running = false; }

  get current() { return this.stages?.[this.index]; }

  update(dt) {
    if (!this.running) return;
    this.t += (dt * this.speed) / Math.max(this.current.duration, 1e-3);
    while (this.running && this.t >= 1) {
      this.current.update(1);
      this.t -= 1;
      this.index++;
      if (this.index >= this.stages.length) {
        this.running = false;
        this.onDone?.();
        return;
      }
    }
    const t = this.t;
    this.current.update(t * t * (3 - 2 * t));
  }

  /** Мгновенно доиграть до конца (для тестов и кнопки «Пропустить») */
  finish() {
    while (this.running) this.update(10);
  }
}
