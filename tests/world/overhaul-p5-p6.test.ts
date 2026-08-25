import { describe, it, expect } from 'vitest';
import { JigsawBuilder, type StructuresV2File } from '../../src/world/jigsaw';
import { spawnEntitiesForChunk } from '../../src/world/spawner';
import { EntityManager } from '../../src/entity/EntityManager';
import { World } from '../../src/world/world';
import { FactionRegistry, type FactionFile } from '../../src/world/factions';
import structuresV2 from '../../data/world/structures-v2.json';
import factionsJson from '../../data/world/factions.json';

describe('P5: Jigsaw structures', () => {
  const builder = new JigsawBuilder(structuresV2 as unknown as StructuresV2File);
  const flat = () => 20;

  it('loads pieces and blueprints from JSON v2', () => {
    expect(builder.blueprints.length).toBeGreaterThanOrEqual(3);
  });

  it('places a house with multiple distinct pieces (walls+roof+floor)', () => {
    const blockIds = new Set<number>();
    let placed: string | null = null;
    for (let cx = -80; cx < 80 && !placed; cx++) {
      const s = setup();
      placed = builder.tryPlace(42, cx, 3, 'plains', flat, (x, y, z, id) =>
        s.set(x, y, z, id),
      );
      if (placed) {
        for (const id of s.ids()) blockIds.add(id);
      }
    }
    expect(placed).not.toBeNull();
    expect(blockIds.size).toBeGreaterThanOrEqual(3); // floor+walls+roof differ
  });

  it('same seed → identical placement (deterministic replay)', () => {
    const runA = captureRun(42);
    const runB = captureRun(42);
    expect(runA).toEqual(runB);
  });

  it('different blueprints exist → variety across many chunks', () => {
    const placed = new Set<string>();
    for (let cx = -200; cx < 200; cx++) {
      const id = builder.tryPlace(9, cx, 0, 'plains', flat, () => {});
      if (id) placed.add(id);
    }
    expect(placed.size).toBeGreaterThanOrEqual(2); // at least two house styles
  });
});

// --- helpers ---
function setup() {
  const cells = new Map<string, number>();
  return {
    set: (x: number, y: number, z: number, id: number) => {
      cells.set(`${x},${y},${z}`, id);
    },
    ids: () => cells.values(),
  };
}
function captureRun(seed: number): Array<[string, string]> {
  const builder = new JigsawBuilder(structuresV2 as unknown as StructuresV2File);
  const out: Array<[string, string]> = [];
  for (let cx = -80; cx < 80; cx++) {
    const placed: Array<[number, number, number, number]> = [];
    const id = builder.tryPlace(seed, cx, 5, 'plains', () => 20, (x, y, z, bid) =>
      placed.push([x, y, z, bid]),
    );
    if (id) out.push([`${cx}`, `${placed.length}:${placed[0]?.[0]}`]);
  }
  return out;
}

describe('P6: entity spawning per biome/faction', () => {
  const factions = new FactionRegistry(factionsJson as unknown as FactionFile);

  it('plains chunks spawn verdant/neutral entities (never nightbrood)', () => {
    const w = new World({ seed: 42 });
    const mgr = new EntityManager();
    let spawned = 0;
    for (let cx = -15; cx <= 15; cx++) {
      for (let cz = -15; cz <= 15; cz++) {
        if (w.biomeAt(cx * 16 + 8, cz * 16 + 8).name !== 'plains') continue;
        w.ensureChunk(cx, cz);
        const results = spawnEntitiesForChunk(w, mgr, factions, cx, cz, 777);
        spawned += results.length;
        for (const r of results) {
          expect(r.faction).not.toBe('nightbrood');
          expect(['hostile', 'passive', 'npc']).toContain(r.type);
        }
      }
    }
    expect(spawned).toBeGreaterThan(0);
  });

  it('spawned entities have EMPTY memory (born innocent)', () => {
    const w = new World({ seed: 99 });
    const mgr = new EntityManager();
    outer: for (let cx = -10; cx <= 10; cx++) {
      for (let cz = -10; cz <= 10; cz++) {
        w.ensureChunk(cx, cz);
        const results = spawnEntitiesForChunk(w, mgr, factions, cx, cz, 5);
        if (results.length > 0) {
          const e = mgr.get(results[0].entityId)!;
          expect(e.memory.lastAttacker).toBeUndefined();
          expect(e.memory.allies.size).toBe(0);
          expect(e.memory.threats.size).toBe(0);
          break outer;
        }
      }
    }
  });

  it('spawning is idempotent per chunk (no duplicates on re-run)', () => {
    const w = new World({ seed: 11 });
    const mgr = new EntityManager();
    for (let cx = -12; cx <= 12; cx++) {
      w.ensureChunk(cx, 0);
      spawnEntitiesForChunk(w, mgr, factions, cx, 0, 21);
    }
    const countAfterFirst = mgr.count;
    for (let cx = -12; cx <= 12; cx++) {
      spawnEntitiesForChunk(w, mgr, factions, cx, 0, 21);
    }
    expect(mgr.count).toBe(countAfterFirst); // no growth
  });
});
