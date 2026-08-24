import { describe, it, expect } from 'vitest';
import { PerlinNoise } from '../../src/world/noise';

describe('PerlinNoise (seeded, deterministic)', () => {
  it('same seed → identical values across instances', () => {
    const a = new PerlinNoise(1337);
    const b = new PerlinNoise(1337);
    for (let i = 0; i < 50; i++) {
      const x = i * 0.37, y = i * 1.13;
      expect(a.noise2D(x, y)).toBeCloseTo(b.noise2D(x, y), 12);
    }
  });

  it('different seeds → different fields', () => {
    const a = new PerlinNoise(1);
    const b = new PerlinNoise(2);
    let differs = false;
    for (let i = 0; i < 20; i++) {
      if (a.noise2D(i * 0.7, i * 0.3) !== b.noise2D(i * 0.7, i * 0.3)) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('output stays within [-1, 1]', () => {
    const n = new PerlinNoise(42);
    for (let i = 0; i < 500; i++) {
      const v = n.noise2D(i * 0.123, i * 0.456);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous: neighboring points have close values', () => {
    const n = new PerlinNoise(7);
    let maxJump = 0;
    for (let i = 0; i < 100; i++) {
      const x = i * 0.1;
      const d = Math.abs(n.noise2D(x, 0) - n.noise2D(x + 0.01, 0));
      maxJump = Math.max(maxJump, d);
    }
    expect(maxJump).toBeLessThan(0.05); // smooth gradient
  });

  it('fractal octaves stay in range and add detail', () => {
    const n = new PerlinNoise(99);
    const v = n.fractal2D(3.7, 2.2, 4, 0.5, 2.0);
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('negative coordinates work (world extends in all directions)', () => {
    const n = new PerlinNoise(5);
    const a = n.noise2D(-123.4, -56.7);
    expect(Number.isFinite(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(-1);
    expect(a).toBeLessThanOrEqual(1);
    // deterministic there too
    const b = new PerlinNoise(5);
    expect(b.noise2D(-123.4, -56.7)).toBe(a);
  });
});
