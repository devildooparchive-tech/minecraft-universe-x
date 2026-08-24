import { Time } from './time';

export class GameLoop {
  private rafId = 0;
  private running = false;
  private updateCallback: (dt: number) => void;
  private renderCallback: () => void;
  private time = new Time();

  constructor(update: (dt: number) => void, render: () => void) {
    this.updateCallback = update;
    this.renderCallback = render;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.time.start(performance.now());
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number) => {
    if (!this.running) return;
    this.time.update(now);
    this.updateCallback(this.time.deltaTime);
    this.renderCallback();
    this.rafId = requestAnimationFrame(this.tick);
  };
}