/**
 * PerlinNoise — deterministic gradient noise (classic Perlin, 2D).
 *
 * Requirements from the plan:
 *  - Seedable & fully deterministic (same seed → same world, forever).
 *  - Correct across negative coordinates (worlds extend in every direction).
 *  - fractal2D() for terrain: octaves, persistence, lacunarity.
 */

const G2_UNUSED = 0; // (simplex reserved for Phase 2)
void G2_UNUSED;

/** Deterministic 32-bit PRNG (mulberry32) — tiny, fast, seedable. Shared with noise3d. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

export class PerlinNoise {
  private readonly perm: Uint8Array;

  constructor(seed: number = 1337) {
    // 512-entry permutation table from a shuffled 0..255 via seeded PRNG.
    const rng = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher–Yates with seeded rng
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** Gradient dot-product for corner (hash, x, y). */
  private grad(hash: number, x: number, y: number): number {
    switch (hash & 7) {
      case 0: return x + y;
      case 1: return x - y;
      case 2: return -x + y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  }

  /** Classic 2D Perlin in [-1, 1]. Works for any real x/y (incl. negatives). */
  noise2D(x: number, y: number): number {
    // Floor works correctly for negatives (unlike | 0 truncation).
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    const u = fade(xf);
    const v = fade(yf);

    const aa = this.perm[(this.perm[xi & 255] + (yi & 255)) & 511] ?? 0;
    const ab = this.perm[(this.perm[xi & 255] + ((yi + 1) & 255)) & 511] ?? 0;
    const ba = this.perm[(this.perm[(xi + 1) & 255] + (yi & 255)) & 511] ?? 0;
    const bb = this.perm[(this.perm[(xi + 1) & 255] + ((yi + 1) & 255)) & 511] ?? 0;

    const x1 = lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v); // theoretical range ±~1.0 with 8 gradients
  }

  /** Fractal Brownian Motion over noise2D. Result normalized to [-1, 1]. */
  fractal2D(
    x: number,
    y: number,
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2.0,
  ): number {
    let total = 0;
    let freq = 1;
    let amp = 1;
    let maxAmp = 0;
    for (let o = 0; o < octaves; o++) {
      total += this.noise2D(x * freq, y * freq) * amp;
      maxAmp += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return maxAmp > 0 ? total / maxAmp : 0;
  }
}
