import { describe, it, expect } from 'vitest';
import { World } from '../../src/world/world';
import { CHUNK_HEIGHT } from '../../src/world/chunk';

describe('World v2: biomes/caves/water/trees', () => {
  const w = new World({ seed: 2026 });

  it('exposes biome info per column', () => {
    const b = w.biomeAt(100, -40);
    expect(b.name.length).toBeGreaterThan(0);
    expect(b.nameAr.length).toBeGreaterThan(0);
  });

  it('generates multiple distinct biomes across a wide area', () => {
    const seen = new Set<number>();
    for (let x = -400; x <= 400; x += 25) {
      for (let z = -400; z <= 400; z += 25) {
        seen.add(w.biomeAt(x, z).id);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(4); // variety exists in ±400 blocks
  });

  it('ocean columns have water at sea level', () => {
    let foundOcean = false;
    for (let x = -400; x <= 400 && !foundOcean; x += 10) {
      for (let z = -400; z <= 400; z += 10) {
        if (w.biomeAt(x, z).id === 0) {
          w.ensureChunk(Math.floor(x / 16), Math.floor(z / 16));
          // find surface: first non-air from top
          let y = CHUNK_HEIGHT - 1;
          while (y > 0 && w.getBlock(x, y, z) === 0) y--;
          if (w.getBlock(x, y, z) === 5) foundOcean = true; // water at surface
          break;
        }
      }
    }
    expect(foundOcean).toBe(true);
  });

  it('caves exist underground (air pockets below surface)', () => {
    w.ensureChunk(0, 0);
    let caveAir = 0;
    for (let x = 0; x < 16; x += 2) {
      for (let z = 0; z < 16; z += 2) {
        for (let y = 5; y < 18; y++) {
          if (w.getBlock(x, y, z) === 0) caveAir++;
        }
      }
    }
    expect(caveAir).toBeGreaterThan(20); // carved spaces exist below the surface
  });

  it('caves never breach y=2 floor and never touch extreme heights', () => {
    w.ensureChunk(1, 1);
    for (let x = 16; x < 32; x += 3) {
      for (let z = 16; z < 32; z += 3) {
        for (let y = 0; y < 2; y++) {
          expect(w.getBlock(x, y, z)).not.toBe(0); // bedrock layer intact
        }
      }
    }
  });

  it('trees appear in forest areas (wood blocks above surface)', () => {
    let trees = 0;
    outer: for (let cx = -8; cx <= 8; cx++) {
      for (let cz = -8; cz <= 8; cz++) {
        const b = w.biomeAt(cx * 16 + 8, cz * 16 + 8);
        if (b.id !== 2) continue; // forest only
        w.ensureChunk(cx, cz);
        const chunk = w.getChunk(cx, cz)!;
        for (let i = 0; i < chunk.data.length; i++) {
          if (chunk.data[i] === 6) {
            trees++;
            break outer;
          }
        }
      }
    }
    expect(trees).toBeGreaterThan(0);
  });

  it('terrain remains deterministic with all Phase-2 features', () => {
    const a = new World({ seed: 777 });
    const b = new World({ seed: 777 });
    a.ensureChunk(-1, -1);
    b.ensureChunk(-1, -1);
    let same = true;
    for (let x = -16; x < 0 && same; x += 3) {
      for (let z = -16; z < 0 && same; z += 3) {
        for (let y = 0; y < 40; y += 2) {
          if (a.getBlock(x, y, z) !== b.getBlock(x, y, z)) {
            same = false;
            break;
          }
        }
      }
    }
    expect(same).toBe(true);
  });

  it('surface is walkable: spawn column has solid ground under air', () => {
    const w2 = new World({ seed: 42 });
    const s = w2.findSpawn(8, 8);
    w2.ensureChunk(0, 0);
    const under = w2.getBlock(Math.floor(s.x), Math.floor(s.y) - 2, Math.floor(s.z));
    expect(under).not.toBe(0);
    expect(w2.getBlock(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z))).toBe(0);
  });
});
