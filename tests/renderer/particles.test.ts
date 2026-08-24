import { describe, it, expect } from 'vitest';
import { ParticleSystem } from '../../src/renderer/particles';
import { EventBus } from '../../src/core/events';

/** Deterministic RNG so tests are reproducible. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('ParticleSystem', () => {
  it('burst spawns 10-20 particles at the block center', () => {
    const ps = new ParticleSystem();
    ps.burst(5, 10, 7, 3, mulberry32(1));
    expect(ps.count).toBeGreaterThanOrEqual(10);
    expect(ps.count).toBeLessThanOrEqual(20);
    // all near the block center
    for (const p of ps.particles) {
      expect(Math.abs(p.x - 5.5)).toBeLessThan(0.5);
      expect(p.y).toBeGreaterThan(10);
    }
  });

  it('particles die within ~1 second of their lifetime', () => {
    const ps = new ParticleSystem();
    ps.burst(0, 0, 0, 1, mulberry32(2));
    ps.update(1.2); // more than maxLife
    expect(ps.count).toBe(0);
  });

  it('gravity pulls vy downward over updates', () => {
    const ps = new ParticleSystem();
    ps.burst(0, 0, 0, 1, mulberry32(3));
    const before = ps.particles[0].vy;
    ps.update(0.3);
    expect(ps.particles[0].vy).toBeLessThan(before);
  });

  it('cap prevents unbounded growth', () => {
    const ps = new ParticleSystem(50);
    for (let i = 0; i < 10; i++) ps.burst(0, 0, 0, 1, mulberry32(i));
    expect(ps.count).toBeLessThanOrEqual(50);
  });
});

describe('block:break emits particles (integration)', () => {
  it('wiring the event to a burst produces particles', () => {
    const events = new EventBus();
    const ps = new ParticleSystem();
    events.on<{ id: number }>('block:break', ({ id }) => {
      ps.burst(3, 30, 3, id % 8, mulberry32(id + 7));
    });
    events.emit('block:break', { id: 3 });
    expect(ps.count).toBeGreaterThan(0);
  });
});
