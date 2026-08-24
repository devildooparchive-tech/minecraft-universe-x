import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/entity/Entity';
import { EntityManager, type EntitySaveData } from '../../src/entity/EntityManager';

const pos = () => ({ x: 10.5, y: 30, z: 20.5 });

function makeZombie(id = 'z1'): Entity {
  return new Entity({
    id,
    type: 'hostile',
    faction: 'nightbrood',
    role: 'warrior',
    position: pos(),
    nameAr: 'زومبي اختبار',
    stats: { maxHealth: 30, health: 30, attackDamage: 5 },
  });
}

describe('Entity memory', () => {
  it('records an attack and remembers the attacker', () => {
    const z = makeZombie();
    z.memory.recordInteraction('attack', 'player_1', 1000);
    expect(z.memory.lastAttacker).toBe('player_1');
    expect(z.memory.interactionHistory[0].type).toBe('attack');
  });

  it('threat levels accumulate and decay toward zero', () => {
    const z = makeZombie();
    z.memory.addThreat('player_1', 60);
    expect(z.memory.topThreat()).toEqual({ id: 'player_1', level: 60 });
    z.memory.addThreat('player_1', 50); // clamped at 100
    expect(z.memory.topThreat()?.level).toBe(100);
    for (let i = 0; i < 200; i++) z.memory.decayThreats(1);
    expect(z.memory.topThreat()).toBeNull(); // fully decayed & removed
  });

  it('interaction history is capped (no unbounded growth)', () => {
    const z = makeZombie();
    for (let i = 0; i < 100; i++) {
      z.memory.recordInteraction(i % 2 ? 'attack' : 'flee', `p${i}`, i);
    }
    expect(z.memory.interactionHistory.length).toBeLessThanOrEqual(20);
  });

  it('allies are tracked and queried', () => {
    const z = makeZombie();
    z.memory.allies.add('z2');
    expect(z.memory.isAlly('z2')).toBe(true);
    expect(z.memory.isAlly('player_1')).toBe(false);
  });
});

describe('Entity serialization (memory survives save/load)', () => {
  it('full round-trip: attack → save → fresh manager → load → memory intact', async () => {
    // session 1: zombie gets attacked by player
    const mgr1 = new EntityManager();
    const z = makeZombie('zombie_7');
    mgr1.spawn(z);
    z.memory.recordInteraction('attack', 'hero', 42);
    z.memory.addThreat('hero', 80);
    z.memory.allies.add('zombie_8');
    z.stats.health = 17; // damaged state
    const saved: EntitySaveData = mgr1.export();

    // session 2: everything reloads from scratch
    const mgr2 = new EntityManager();
    mgr2.import(saved);
    const reloaded = mgr2.get('zombie_7')!;
    expect(reloaded).toBeDefined();
    expect(reloaded.memory.lastAttacker).toBe('hero');
    expect(reloaded.memory.threats.get('hero')).toBe(80);
    expect(reloaded.memory.isAlly('zombie_8')).toBe(true);
    expect(reloaded.stats.health).toBe(17);
    expect(reloaded.nameAr).toBe('زومبي اختبار');
  });

  it('duplicate spawn throws; import replaces instead of crashing', () => {
    const mgr = new EntityManager();
    mgr.spawn(makeZombie());
    expect(() => mgr.spawn(makeZombie())).toThrow();

    const data = mgr.export();
    const mgr2 = new EntityManager();
    mgr2.import(data); // empty → fine
    mgr2.import(data); // duplicate ids → replaced gracefully
    expect(mgr2.count).toBe(1);
  });
});

describe('EntityManager spatial index', () => {
  it('inChunk returns only entities anchored to that chunk', () => {
    const mgr = new EntityManager();
    const a = makeZombie('a');
    a.position = { x: 5, y: 30, z: 5 }; // chunk 0,0
    const b = makeZombie('b');
    b.position = { x: 25, y: 30, z: 5 }; // chunk 1,0
    mgr.spawn(a);
    mgr.spawn(b);

    expect(mgr.inChunk(0, 0).map((e) => e.id)).toEqual(['a']);
    expect(mgr.inChunk(1, 0).map((e) => e.id)).toEqual(['b']);
    expect(mgr.inChunk(9, 9)).toHaveLength(0);
  });

  it('reindex moves entities between chunks as they walk', () => {
    const mgr = new EntityManager();
    const e = makeZombie('walker');
    e.position = { x: 5, y: 30, z: 5 };
    mgr.spawn(e);
    expect(mgr.inChunk(0, 0)).toHaveLength(1);

    e.position = { x: 20.5, y: 30, z: 5 }; // walked into chunk 1
    mgr.reindex(e);
    expect(mgr.inChunk(0, 0)).toHaveLength(0);
    expect(mgr.inChunk(1, 0)).toHaveLength(1);
    // idempotent when unchanged
    mgr.reindex(e);
    expect(mgr.inChunk(1, 0)).toHaveLength(1);
  });

  it('despawn removes from both indexes', () => {
    const mgr = new EntityManager();
    mgr.spawn(makeZombie());
    mgr.despawn('z1');
    expect(mgr.count).toBe(0);
    expect(mgr.inChunk(0, 0)).toHaveLength(0);
  });
});
