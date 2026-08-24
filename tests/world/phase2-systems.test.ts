import { describe, it, expect } from 'vitest';
import { StructureBuilder, type StructureFile } from '../../src/world/structures';
import { DimensionManager } from '../../src/world/dimensions';
import { FactionRegistry, type FactionFile } from '../../src/world/factions';
import structuresJson from '../../data/world/structures.json';
import factionsJson from '../../data/world/factions.json';

describe('Structures', () => {
  const builder = new StructureBuilder(structuresJson as unknown as StructureFile);
  const flatSurface = () => 20;

  it('loads templates from JSON', () => {
    expect(builder.structures.length).toBeGreaterThanOrEqual(3);
  });

  it('places structures deterministically (same seed → same result)', () => {
    // find the first chunk where a plains structure actually places
    let found: { cx: number; cz: number; id: string; blocks: number } | null = null;
    for (let cx = -60; cx < 60 && !found; cx++) {
      const writes: Array<[number, number, number, number]> = [];
      const def = builder.tryPlace(42, cx, 5, 'plains', flatSurface, (x, y, z, id) => writes.push([x, y, z, id]));
      if (def) found = { cx, cz: 5, id: def.id, blocks: writes.length };
    }
    expect(found).not.toBeNull();
    // replay the exact same chunk → identical outcome
    const replay: Array<[number, number, number, number]> = [];
    const def2 = builder.tryPlace(42, found!.cx, found!.cz, 'plains', flatSurface, (x, y, z, id) => replay.push([x, y, z, id]));
    expect(def2?.id).toBe(found!.id);
    expect(replay.length).toBe(found!.blocks);
  });

  it('house walls enclose an interior (door carved open)', () => {
    let placed = false;
    for (let cx = -60; cx < 60 && !placed; cx++) {
      let walls = 0;
      let doorAir = 0;
      const def = builder.tryPlace(
        42,
        cx,
        3,
        'forest',
        () => 20,
        (_x, y, _z, id) => {
          if (id === 6) walls++;
          if (id === 0 && y > 19) doorAir++; // air carved above ground level
        },
      );
      if (def?.id === 'small_house') {
        placed = true;
        expect(walls).toBeGreaterThan(0);
        expect(doorAir).toBeGreaterThanOrEqual(2); // 2-block door opening
      }
    }
    expect(placed).toBe(true); // a house was found and validated within the scan
  });

  it('respects biome gating: desert never gets a village house', () => {
    // small_house is gated to plains/forest — desert eligible list excludes it
    for (let cx = -50; cx < 50; cx++) {
      const def = builder.tryPlace(7, cx, 0, 'desert', () => 20, () => {});
      if (def) expect(def.id).not.toBe('small_house');
    }
  });

  it('rarity gate blocks most chunks', () => {
    let placedCount = 0;
    for (let cx = -100; cx < 100; cx++) {
      if (builder.tryPlace(9, cx, 0, 'mountains', flatSurface, () => {})) placedCount++;
    }
    // watchtower rarity 0.002 → ~0.4 expected in 200 chunks
    expect(placedCount).toBeLessThan(10);
  });
});

describe('Dimensions', () => {
  it('creates three distinct dimensions', () => {
    const dm = new DimensionManager(12345);
    expect(dm.ids.sort()).toEqual(['aether', 'nether', 'overworld']);
  });

  it('dimensions have isolated chunks (same coords, different worlds)', () => {
    const dm = new DimensionManager(12345);
    const over = dm.byId('overworld')!;
    const nether = dm.byId('nether')!;
    over.world.ensureChunk(0, 0);
    nether.world.ensureChunk(0, 0);
    const a = over.world.getChunk(0, 0)!;
    const b = nether.world.getChunk(0, 0)!;
    expect(a).not.toBe(b);
    // both generate terrain but with different seeds → different data (very likely)
    let diff = false;
    for (let i = 0; i < a.data.length; i += 997) {
      if (a.data[i] !== b.data[i]) {
        diff = true;
        break;
      }
    }
    expect(diff).toBe(true);
  });

  it('travel switches the active dimension and its rules', () => {
    const dm = new DimensionManager(777);
    expect(dm.currentId).toBe('overworld');
    expect(dm.active.def.rules.gravity).toBe(28);
    dm.travel('nether');
    expect(dm.active.def.rules.gravity).toBeLessThan(28); // lower gravity
    expect(dm.active.def.nameAr.length).toBeGreaterThan(0);
  });

  it('each dimension remains internally deterministic', () => {
    const d1 = new DimensionManager(31337);
    const d2 = new DimensionManager(31337);
    d1.byId('aether')!.world.ensureChunk(-2, 2);
    d2.byId('aether')!.world.ensureChunk(-2, 2);
    const c1 = d1.byId('aether')!.world.getChunk(-2, 2)!;
    const c2 = d2.byId('aether')!.world.getChunk(-2, 2)!;
    expect([...c1.data]).toEqual([...c2.data]);
  });

  it('unknown dimension travel throws', () => {
    const dm = new DimensionManager(1);
    expect(() => dm.travel('moon')).toThrow();
  });
});

describe('Factions', () => {
  const reg = new FactionRegistry(factionsJson as unknown as FactionFile);

  it('defines at least 5 factions from JSON', () => {
    expect(reg.count).toBeGreaterThanOrEqual(5);
  });

  it('enemy relations are symmetric', () => {
    expect(reg.areEnemies('verdant', 'nightbrood')).toBe(true);
    expect(reg.areEnemies('nightbrood', 'verdant')).toBe(true);
    expect(reg.areEnemies('verdant', 'mythic')).toBe(false);
  });

  it('ally relations are symmetric', () => {
    expect(reg.areAllies('verdant', 'neutral')).toBe(true);
    expect(reg.areAllies('neutral', 'verdant')).toBe(true);
  });

  it('biome gating: badlands spawns ashborn, plains spawn verdant', () => {
    const badlands = reg.spawnersFor('badlands').map((f) => f.name);
    expect(badlands).toContain('ashborn');
    const plains = reg.spawnersFor('plains').map((f) => f.name);
    expect(plains).toContain('verdant');
    expect(plains).not.toContain('nightbrood');
  });

  it('mythic loot multiplier is highest', () => {
    const all = reg.all().sort((a, b) => b.lootMultiplier - a.lootMultiplier);
    expect(all[0].name).toBe('mythic');
  });
});
