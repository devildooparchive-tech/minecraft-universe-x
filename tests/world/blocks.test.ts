import { describe, it, expect } from 'vitest';
import { BlockRegistry } from '../../src/world/blocks';

import vanilla from '../../data/blocks/vanilla.json';

describe('BlockRegistry (JSON-driven)', () => {
  const reg = new BlockRegistry(vanilla as never);

  it('loads all blocks from the JSON file', () => {
    expect(reg.count).toBe(16); // 12 base + 4 ores added in Phase 2.5
  });

  it('resolves by id and by name consistently', () => {
    const byId = reg.byId(1);
    const byName = reg.byName('grass');
    expect(byId).toBe(byName);
    expect(byId?.name).toBe('grass');
  });

  it('air is not solid, stone is solid', () => {
    expect(reg.byId(0)?.solid).toBe(false);
    expect(reg.byId(3)?.solid).toBe(true);
  });

  it('unknown lookups return undefined without throwing', () => {
    expect(reg.byId(999)).toBeUndefined();
    expect(reg.byName('unobtanium')).toBeUndefined();
  });

  it('water is a liquid, glowstone emits light', () => {
    expect(reg.byId(5)?.liquid).toBe(true);
    expect(reg.byId(11)?.lightEmission).toBe(15);
  });

  it('bedrock is unbreakable (negative hardness)', () => {
    expect(reg.byId(8)?.hardness).toBe(-1);
  });

  it('solid(0) outside registered range falls back to air', () => {
    expect(reg.solidOrAir(999)).toBe(false);
    expect(reg.solidOrAir(3)).toBe(true);
  });
});
