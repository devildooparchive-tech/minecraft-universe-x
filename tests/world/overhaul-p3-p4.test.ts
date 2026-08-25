import { describe, it, expect } from 'vitest';
import { World } from '../../src/world/world';
import { tickFluids } from '../../src/world/fluids';
import { propagateLight, getLight, clearLight } from '../../src/world/lighting';

describe('P3: flowing water', () => {
  it('water spreads sideways onto solid ground within one tick', () => {
    const w = new World({ seed: 1 });
    // build a basin: floor at y=20, one water source at (10,21,10)
    for (let x = 8; x <= 12; x++) {
      for (let z = 8; z <= 12; z++) {
        w.setBlock(x, 20, z, 3); // stone floor
        for (let y = 21; y <= 25; y++) w.setBlock(x, y, z, 0);
      }
    }
    w.setBlock(10, 21, 10, 5); // source water

    const changed = tickFluids(w, 0, 0, 1);
    expect(changed).toBeGreaterThan(2); // spread to neighbors
    expect(w.getBlock(9, 21, 10)).toBe(5); // cardinal neighbor filled
    expect(w.getBlock(10, 21, 9)).toBe(5);
  });

  it('water falls down into air below', () => {
    const w = new World({ seed: 2 });
    w.setBlock(5, 22, 5, 5); // floating water
    w.setBlock(5, 21, 5, 0);
    w.setBlock(5, 20, 5, 3);
    tickFluids(w, 0, 0, 1);
    expect(w.getBlock(5, 21, 5)).toBe(5); // fell one level
  });

  it('water does NOT spread into solid blocks', () => {
    const w = new World({ seed: 3 });
    w.setBlock(7, 21, 7, 5);
    w.setBlock(8, 21, 7, 3); // solid wall neighbor
    w.setBlock(8, 20, 7, 3);
    tickFluids(w, 0, 0, 1);
    expect(w.getBlock(8, 21, 7)).toBe(3); // unchanged
  });

  it('spread is bounded per tick (no infinite flood in one call)', () => {
    const w = new World({ seed: 4 });
    // long dry corridor
    for (let x = 10; x <= 30; x++) {
      w.setBlock(x, 20, 15, 3);
      w.setBlock(x, 21, 15, 0);
      w.setBlock(x, 22, 15, 0);
    }
    w.setBlock(10, 21, 15, 5);
    tickFluids(w, 0, 0, 1); // ONE tick
    expect(w.getBlock(30, 21, 15)).toBe(0); // far end still dry
  });
});

describe('P4: block light propagation', () => {
  it('glowstone placement lights neighbors with falloff', () => {
    const w = new World({ seed: 5 });
    w.ensureChunk(0, 0);
    w.ensureChunk(1, 0);
    // clear a small room
    for (let x = 8; x <= 18; x++)
      for (let y = 28; y <= 34; y++)
        for (let z = 8; z <= 12; z++) w.setBlock(x, y, z, 0);

    propagateLight(w, 13, 31, 10, 15); // light source center
    expect(getLight(w, 13, 31, 10)).toBe(15); // source
    expect(getLight(w, 14, 31, 10)).toBeGreaterThan(10); // adjacent bright
    expect(getLight(w, 17, 31, 10)).toBeGreaterThan(5); // 4 away dimmer
    expect(getLight(w, 17, 31, 10)).toBeLessThan(getLight(w, 14, 31, 10)); // falloff
  });

  it('light does not pass through opaque walls', () => {
    const w = new World({ seed: 6 });
    w.ensureChunk(0, 0);
    for (let x = 8; x <= 16; x++)
      for (let y = 28; y <= 34; y++)
        for (let z = 6; z <= 14; z++) w.setBlock(x, y, z, 0);
    // full-height wall at x=12 spanning beyond the room's z-range
    for (let y = 28; y <= 34; y++)
      for (let z = 5; z <= 15; z++) w.setBlock(12, y, z, 3);

    propagateLight(w, 10, 31, 10, 15);
    // behind the wall: at most faint face-shading, far below direct light
    expect(getLight(w, 13, 31, 10)).toBeLessThan(8);
    expect(getLight(w, 11, 31, 10)).toBeGreaterThan(8); // same side stays bright
  });

  it('clearLight wipes the field for removal scenarios', () => {
    const w = new World({ seed: 7 });
    w.ensureChunk(0, 0);
    // controlled air pocket so propagation has clean geometry
    for (let x = 8; x <= 14; x++)
      for (let y = 29; y <= 33; y++)
        for (let z = 8; z <= 12; z++) w.setBlock(x, y, z, 0);
    propagateLight(w, 10, 31, 10, 12);
    expect(getLight(w, 12, 31, 10)).toBeGreaterThan(0);
    clearLight(w, 10, 31, 10, 6);
    expect(getLight(w, 12, 31, 10)).toBe(0);
  });

  it('light crosses chunk borders seamlessly', () => {
    const w = new World({ seed: 8 });
    // source at chunk border x=15/16
    propagateLight(w, 15, 31, 10, 10);
    expect(getLight(w, 16, 31, 10)).toBeGreaterThan(0); // next chunk lit
  });
});
