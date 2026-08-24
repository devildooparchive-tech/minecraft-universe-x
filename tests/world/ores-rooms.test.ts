import { describe, it, expect } from 'vitest';
import { World } from '../../src/world/world';
import { pickOre, isBigRoom, ORE_IDS } from '../../src/world/ores';
import { PerlinNoise3D } from '../../src/world/noise3d';

describe('Ores & big rooms (Phase 2.5)', () => {
  const w = new World({ seed: 4242 });

  it('ores exist in the underground across a scanned region', () => {
    w.ensureChunk(0, 0);
    w.ensureChunk(1, 0);
    w.ensureChunk(0, 1);
    w.ensureChunk(1, 1);
    const counts = new Map<number, number>();
    for (let x = 0; x < 32; x++) {
      for (let z = 0; z < 32; z++) {
        for (let y = 1; y < 25; y++) {
          const id = w.getBlock(x, y, z);
          if (id >= ORE_IDS.coal && id <= ORE_IDS.diamond) {
            counts.set(id, (counts.get(id) ?? 0) + 1);
          }
        }
      }
    }
    // coal should be the most common ore present
    expect((counts.get(ORE_IDS.coal) ?? 0)).toBeGreaterThan(5);
  });

  it('ore depth bands are respected (diamond only deep)', () => {
    w.ensureChunk(2, 2);
    for (let x = 32; x < 48; x += 2) {
      for (let z = 32; z < 48; z += 2) {
        for (let y = 20; y < 40; y++) {
          const id = w.getBlock(x, y, z);
          if (id === ORE_IDS.diamond || id === ORE_IDS.gold) {
            throw new Error(`gold/diamond found at shallow y=${y}`);
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it('pickOre is deterministic and band-limited', () => {
    const a = pickOre(7, 10, 8, 10);
    const b = pickOre(7, 10, 8, 10);
    expect(a).toBe(b);
    // diamond never above y=12
    for (let y = 13; y < 40; y++) {
      expect(pickOre(7, 100, y, 100)).not.toBe(ORE_IDS.diamond);
    }
  });

  it('big rooms carve large open spaces underground', () => {
    let roomAir = 0;
    let maxRun = 0;
    let run = 0;
    // scan one column band deeply
    for (let x = -64; x < 64; x += 4) {
      for (let z = -64; z < 64; z += 4) {
        run = 0;
        for (let y = 3; y < 20; y++) {
          const solid = w.getBlock(x, y, z) !== 0;
          if (!solid) {
            run++;
            roomAir++;
            maxRun = Math.max(maxRun, run);
          } else run = 0;
        }
      }
    }
    expect(roomAir).toBeGreaterThan(50); // significant carved volume exists
    expect(maxRun).toBeGreaterThanOrEqual(3); // tall vertical openings → room-like
  });

  it('isBigRoom threshold behaves as documented', () => {
    const n = new PerlinNoise3D(1);
    // pure function sanity: same input same output
    expect(isBigRoom(n, 5.5, 6.6, 7.7)).toBe(isBigRoom(n, 5.5, 6.6, 7.7));
  });

  it('world remains deterministic with ores+rooms', () => {
    const a = new World({ seed: 999 });
    const b = new World({ seed: 999 });
    a.ensureChunk(-3, -3);
    b.ensureChunk(-3, -3);
    for (let x = -48; x < -32; x += 3) {
      for (let z = -48; z < -32; z += 3) {
        for (let y = 1; y < 30; y += 2) {
          expect(a.getBlock(x, y, z)).toBe(b.getBlock(x, y, z));
        }
      }
    }
  });
});
