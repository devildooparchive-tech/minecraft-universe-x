/**
 * GameLoop — fixed-timestep update + variable render with interpolation alpha.
 *
 * Why fixed timestep: simulation determinism (physics, AI, generation must be
 * reproducible) and stability under lag spikes. The catch-up cap prevents the
 * "spiral of death" where updates take longer than the budget they simulate.
 */

export interface GameLoopOptions {
  update: (dt: number) => void;
  render: (alpha: number) => void;
  /** Fixed simulation step in ms (default 16.666… = 60Hz). */
  fixedDt?: number;
  /** Max fixed steps per frame before capping (default 5). */
  maxCatchUp?: number;
}

export class GameLoop {
  private readonly updateFn: (dt: number) => void;
  private readonly renderFn: (alpha: number) => void;
  private readonly fixedDt: number;
  private readonly maxCatchUp: number;
  private accumulator = 0;
  private _alpha = 0;
  private running = true;

  constructor(options: GameLoopOptions) {
    this.updateFn = options.update;
    this.renderFn = options.render;
    this.fixedDt = options.fixedDt ?? 1000 / 60;
    this.maxCatchUp = options.maxCatchUp ?? 5;
  }

  /** Advance the simulation by one real frame of frameDeltaMs. */
  tickFrame(frameDeltaMs: number): void {
    if (!this.running) return;
    this.accumulator += frameDeltaMs;
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxCatchUp) {
      this.updateFn(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    // If we hit the cap, drop the leftover backlog (spiral-of-death guard).
    if (steps >= this.maxCatchUp && this.accumulator > this.fixedDt) {
      this.accumulator = 0;
    }
    this._alpha = this.accumulator / this.fixedDt;
    this.renderFn(this._alpha);
  }

  /** Interpolation factor for rendering between the last two simulation states. */
  get alpha(): number {
    return this._alpha;
  }

  stop(): void {
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
