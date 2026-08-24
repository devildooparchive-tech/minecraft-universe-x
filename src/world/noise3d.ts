/**
 * PerlinNoise3D — classic 3D gradient noise for caves & volumetric terrain.
 * Same determinism contract as PerlinNoise (2D): seeded, negative-coord safe.
 */

import { mulberry32 } from './noise';

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + t * (b - a);

/** 16 gradient directions via hash bits (Perlin's improved-noise style). */
function grad3(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export class PerlinNoise3D {
  private readonly perm: Uint8Array;

  constructor(seed: number = 1337) {
    const rng = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** Classic 3D Perlin in roughly [-1, 1]. Works for any real x/y/z. */
  noise3D(x: number, y: number, z: number): number {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = fade(xf), v = fade(yf), w = fade(zf);

    const A = xi & 255, B = yi & 255, C = zi & 255;
    const p = this.perm;
    // Corner hashes (Perlin's reference construction)
    const h000 = p[(p[A] + B) & 511] + C;
    const h001 = p[(p[A] + B + 1) & 511] + C;
    const h010 = p[(p[(A + 1) & 255] + B) & 511] + C;
    const h011 = p[(p[(A + 1) & 255] + B + 1) & 511] + C;
    const h100 = p[(p[A] + B) & 511] + C + 1;
    const h101 = p[(p[A] + B + 1) & 511] + C + 1;
    const h110 = p[(p[(A + 1) & 255] + B) & 511] + C + 1;
    const h111 = p[(p[(A + 1) & 255] + B + 1) & 511] + C + 1;

    const x1 = lerp(grad3(h000, xf, yf, zf), grad3(h010, xf - 1, yf, zf), u);
    const x2 = lerp(grad3(h001, xf, yf - 1, zf), grad3(h011, xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);
    const x3 = lerp(grad3(h100, xf, yf, zf - 1), grad3(h110, xf - 1, yf, zf - 1), u);
    const x4 = lerp(grad3(h101, xf, yf - 1, zf - 1), grad3(h111, xf - 1, yf - 1, zf - 1), u);
    const y2 = lerp(x3, x4, v);
    return lerp(y1, y2, w);
  }
}

/** Stable 2D integer hash → uint32 (per-column decisions like tree placement). */
export function hash2(seed: number, x: number, z: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Stable 3D integer hash → uint32. */
export function hash3(seed: number, x: number, y: number, z: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 2246822519) ^ Math.imul(z, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
