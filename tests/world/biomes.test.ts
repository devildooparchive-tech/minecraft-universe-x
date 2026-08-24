import { describe, it, expect } from 'vitest';
import { PerlinNoise3D, hash2, hash3 } from '../../src/world/noise3d';
import { BiomeRegistry, type BiomeFile } from '../../src/world/biomes';
import biomesJson from '../../data/world/biomes.json';

describe('PerlinNoise3D', () => {
  it('same seed → identical values', () => {
    const a = new PerlinNoise3D(555);
    const b = new PerlinNoise3D(555);
    for (let i = 0; i < 30; i++) {
      expect(a.noise3D(i * 0.31, i * 0.17, i * 0.53)).toBeCloseTo(b.noise3D(i * 0.31, i * 0.17, i * 0.53), 12);
    }
  });

  it('bounded output & negative coords', () => {
    const n = new PerlinNoise3D(9);
    for (let i = 0; i < 200; i++) {
      const v = n.noise3D(i * 0.21 - 50, -i * 0.13, i * 0.4);
      expect(v).toBeGreaterThanOrEqual(-1.01);
      expect(v).toBeLessThanOrEqual(1.01);
    }
    const neg = n.noise3D(-12.5, -33.7, -8.2);
    expect(new PerlinNoise3D(9).noise3D(-12.5, -33.7, -8.2)).toBe(neg);
  });

  it('hash2/hash3 are stable and spread', () => {
    expect(hash2(1, 10, 20)).toBe(hash2(1, 10, 20));
    expect(hash2(1, 10, 20)).not.toBe(hash2(1, 11, 20));
    expect(hash3(1, 1, 2, 3)).toBe(hash3(1, 1, 2, 3));
    expect(hash3(1, 1, 2, 3)).not.toBe(hash3(1, 1, 2, 4));
  });
});

describe('BiomeRegistry', () => {
  const reg = new BiomeRegistry(biomesJson as unknown as BiomeFile);

  it('defines at least 8 biomes from JSON', () => {
    expect(reg.count).toBeGreaterThanOrEqual(8);
  });

  it('climate space is fully covered (any point selects a biome)', () => {
    // sample a grid over the whole climate space
    for (let t = 0; t <= 1.001; t += 0.05) {
      for (let h = 0; h <= 1.001; h += 0.05) {
        const b = reg.select(t, h);
        expect(b).toBeDefined();
      }
    }
  });

  it('hot+dry → desert, cold+wet-ish → snow', () => {
    expect(reg.select(0.95, 0.05).name).toBe('desert');
    expect(reg.select(0.05, 0.6).name).toBe('snow');
  });

  it('transitions are smooth: neighboring climate points often share biomes', () => {
    let changes = 0;
    let prev = reg.select(0.5, 0.5).id;
    for (let i = 0; i < 40; i++) {
      const b = reg.select(0.5 + i * 0.004, 0.5);
      if (b.id !== prev) changes++;
      prev = b.id;
    }
    expect(changes).toBeLessThan(8); // not chaotic flickering
  });

  it('blendHeight interpolates between ocean and mountains', () => {
    const low = reg.blendHeight(0.1, 0.9); // near ocean
    const high = reg.blendHeight(0.2, 0.05); // near mountains
    expect(low.bias).toBeLessThan(high.bias);
  });

  it('every biome has valid block ids and params', () => {
    for (const b of reg.biomes) {
      expect(b.surfaceBlock).toBeGreaterThan(0);
      expect(b.fillerBlock).toBeGreaterThan(0);
      expect(b.heightScale).toBeGreaterThan(0);
      expect(b.treeDensity).toBeGreaterThanOrEqual(0);
      expect(b.temperature[0]).toBeLessThanOrEqual(b.temperature[1]);
      expect(b.humidity[0]).toBeLessThanOrEqual(b.humidity[1]);
    }
  });
});
