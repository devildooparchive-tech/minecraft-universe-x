/**
 * GameClock — wall-time tracking for the game loop.
 * Clamps absurd deltas so a backgrounded tab doesn't teleport the simulation.
 */

export interface GameClockOptions {
  /** Max single-frame delta in ms (default 100). */
  maxDelta?: number;
}

export class GameClock {
  private _elapsed = 0;
  private _frameCount = 0;
  private _fpsWindow: number[] = [];
  private readonly maxDelta: number;

  constructor(options: GameClockOptions = {}) {
    this.maxDelta = options.maxDelta ?? 100;
  }

  /** Feed one frame duration (ms). Returns the clamped delta. */
  tick(deltaMs: number): number {
    const d = Math.max(0, Math.min(deltaMs, this.maxDelta));
    this._elapsed += d;
    this._frameCount++;
    this._fpsWindow.push(d);
    if (this._fpsWindow.length > 60) this._fpsWindow.shift();
    return d;
  }

  get elapsed(): number {
    return this._elapsed;
  }

  get frameCount(): number {
    return this._frameCount;
  }

  /** Rolling fps over the last ~60 frames. */
  get fps(): number {
    if (this._fpsWindow.length === 0) return 0;
    const avg = this._fpsWindow.reduce((a, b) => a + b, 0) / this._fpsWindow.length;
    return avg > 0 ? 1000 / avg : 0;
  }

  reset(): void {
    this._elapsed = 0;
    this._frameCount = 0;
    this._fpsWindow = [];
  }
}
