import { describe, it, expect } from 'vitest';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from '../../src/world/chunk';
import { World } from '../../src/world/world';

describe('Chunk', () => {
  it('has expected dimensions', () => {
    expect(CHUNK_SIZE).toBe(16);
    expect(CHUNK_HEIGHT).toBe(64);
  });

  it('starts completely filled with air (id 0)', () => {
    const c = new Chunk(0, 0);
    for (let y = 0; y < CHUNK_HEIGHT; y += 7) {
      for (let z = 0; z < CHUNK_SIZE; z += 5) {
        for (let x = 0; x < CHUNK_SIZE; x += 5) {
          expect(c.get(x, y, z)).toBe(0);
        }
      }
    }
  });

  it('stores and retrieves blocks at any position', () => {
    const c = new Chunk(0, 0);
    c.set(3, 10, 7, 5);
    expect(c.get(3, 10, 7)).toBe(5);
    c.set(15, 63, 15, 3); // max corner
    expect(c.get(15, 63, 15)).toBe(3);
    c.set(0, 0, 0, 1); // min corner
    expect(c.get(0, 0, 0)).toBe(1);
  });

  it('out-of-bounds access is safe (returns air / ignores set)', () => {
    const c = new Chunk(0, 0);
    expect(c.get(-1, 0, 0)).toBe(0);
    expect(c.get(16, 0, 0)).toBe(0);
    expect(c.get(0, 64, 0)).toBe(0);
    expect(() => c.set(-1, 0, 0, 1)).not.toThrow();
    expect(() => c.set(0, -1, 0, 1)).not.toThrow();
  });

  it('counts non-air blocks correctly', () => {
    const c = new Chunk(0, 0);
    expect(c.solidCount()).toBe(0);
    c.set(1, 1, 1, 3);
    c.set(2, 1, 1, 3);
    c.set(3, 1, 1, 0); // air doesn't count
    expect(c.solidCount()).toBe(2);
  });

  it('tracks chunk coordinates', () => {
    const c = new Chunk(-3, 7);
    expect(c.cx).toBe(-3);
    expect(c.cz).toBe(7);
  });
});

describe('World (chunk management + negative coordinates)', () => {
  it('returns air for ungenerated chunks without throwing', () => {
    const w = new World();
    expect(w.getBlock(100, 30, -100)).toBe(0);
  });

  it('set/get block routes to the right chunk', () => {
    const w = new World();
    w.setBlock(5, 10, 5, 3); // inside chunk 0,0
    expect(w.getBlock(5, 10, 5)).toBe(3);
  });

  it('handles NEGATIVE world coordinates across chunk borders', () => {
    const w = new World();
    // (-1, y, -1) lives in chunk (-1,-1)
    w.setBlock(-1, 10, -1, 7);
    expect(w.getBlock(-1, 10, -1)).toBe(7);
    // border: x=-16 is chunk -1, x=-17 is chunk -2
    w.setBlock(-16, 10, -16, 3);
    w.setBlock(-17, 10, -17, 4);
    expect(w.getBlock(-16, 10, -16)).toBe(3);
    expect(w.getBlock(-17, 10, -17)).toBe(4);
  });

  it('y above world height is air, y below 0 is treated as solid bedrock-ish', () => {
    const w = new World();
    expect(w.getBlock(0, 500, 0)).toBe(0);
    expect(() => w.setBlock(0, -5, 0, 3)).not.toThrow();
  });

  it('generates deterministic terrain from seed', () => {
    const a = new World({ seed: 1234 });
    const b = new World({ seed: 1234 });
    a.ensureChunk(0, 0);
    b.ensureChunk(0, 0);
    for (let x = 0; x < 16; x += 3) {
      for (let z = 0; z < 16; z += 3) {
        expect(a.getBlock(x, 20, z)).toBe(b.getBlock(x, 20, z));
      }
    }
  });

  it('different seeds produce different terrain', () => {
    const a = new World({ seed: 1 });
    const b = new World({ seed: 999 });
    a.ensureChunk(0, 0);
    b.ensureChunk(0, 0);
    let differs = false;
    for (let x = 0; x < 16 && !differs; x++) {
      for (let y = 15; y < 25; y++) {
        if (a.getBlock(x, y, 0) !== b.getBlock(x, y, 0)) {
          differs = true;
          break;
        }
      }
    }
    expect(differs).toBe(true);
  });

  it('heightAt returns a sensible surface height', () => {
    const w = new World({ seed: 42 });
    const h = w.heightAt(8, 8);
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThan(CHUNK_HEIGHT);
    // surface block should be solid, one above should be air
    expect(w.getBlock(8, h, 8)).not.toBe(0);
    expect(w.getBlock(8, h + 1, 8)).toBe(0);
  });

  it('tracks loaded chunk count', () => {
    const w = new World({ seed: 1 });
    expect(w.loadedChunkCount).toBe(0);
    w.ensureChunk(0, 0);
    w.ensureChunk(1, 0);
    expect(w.loadedChunkCount).toBe(2);
    w.ensureChunk(0, 0); // idempotent
    expect(w.loadedChunkCount).toBe(2);
  });

  it('modified blocks survive chunk unload/reload (edit journal)', () => {
    const w = new World({ seed: 1 });
    w.ensureChunk(0, 0);
    w.setBlock(3, 20, 3, 10); // player edit
    w.unloadChunk(0, 0);
    w.ensureChunk(0, 0); // regenerates
    expect(w.getBlock(3, 20, 3)).toBe(10); // edit preserved
  });
});
