import { describe, it, expect, vi } from 'vitest';
import { GameClock } from '../../src/core/time';
import { GameLoop } from '../../src/core/loop';

describe('GameClock', () => {
  it('accumulates elapsed time from ticks', () => {
    const clock = new GameClock();
    clock.tick(16);
    clock.tick(16);
    expect(clock.elapsed).toBe(32);
  });

  it('clamps huge frame gaps (tab was backgrounded)', () => {
    const clock = new GameClock({ maxDelta: 100 });
    clock.tick(5000);
    expect(clock.elapsed).toBe(100); // clamped, not 5000
  });

  it('tracks frame count and computes fps', () => {
    const clock = new GameClock();
    for (let i = 0; i < 50; i++) clock.tick(16);
    expect(clock.frameCount).toBe(50);
    expect(clock.fps).toBeGreaterThan(50); // 16ms frames ≈ 62.5 fps
  });
});

describe('GameLoop (fixed timestep)', () => {
  it('runs update at fixed rate regardless of frame delta', () => {
    const update = vi.fn();
    const render = vi.fn();
    const loop = new GameLoop({ update, render, fixedDt: 20, maxCatchUp: 5 });
    // simulate 3 frames of ~50ms each → 150ms → 7 fixed updates of 20ms (capped by maxCatchUp*fixedDt=100ms per frame → 5+5+5? no: 50ms→2 updates each)
    loop.tickFrame(50);
    loop.tickFrame(50);
    loop.tickFrame(50);
    // accumulator carry-over: 50ms→2up (rem 10) · 60ms→3up (rem 0) · 50ms→2up (rem 10) = 7
    expect(update).toHaveBeenCalledTimes(7);
    expect(render).toHaveBeenCalledTimes(3);
  });

  it('interpolation alpha is in [0,1)', () => {
    const loop = new GameLoop({ update: () => {}, render: () => {}, fixedDt: 20 });
    loop.tickFrame(50); // 2 updates, remainder 10ms → alpha 0.5
    expect(loop.alpha).toBeGreaterThanOrEqual(0);
    expect(loop.alpha).toBeLessThan(1);
  });

  it('stops delivering updates after stop()', () => {
    const update = vi.fn();
    const loop = new GameLoop({ update, render: () => {}, fixedDt: 16 });
    loop.stop();
    loop.tickFrame(100);
    expect(update).not.toHaveBeenCalled();
  });

  it('catch-up cap prevents spiral of death', () => {
    const update = vi.fn();
    const loop = new GameLoop({ update, render: () => {}, fixedDt: 16, maxCatchUp: 3 });
    loop.tickFrame(1000); // would be 62 updates; capped at 3
    expect(update).toHaveBeenCalledTimes(3);
  });
});
