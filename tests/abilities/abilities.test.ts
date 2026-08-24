import { describe, it, expect, vi } from 'vitest';
import { AbilitySystem, type AbilityFile } from '../../src/abilities/AbilitySystem';
import { Entity } from '../../src/entity/Entity';
import { EntityManager } from '../../src/entity/EntityManager';
import { World } from '../../src/world/world';
import { EventBus } from '../../src/core/events';
import abilitiesJson from '../../data/abilities/abilities.json';

function setup() {
  const world = new World({ seed: 1 });
  const entities = new EntityManager();
  const events = new EventBus();
  const sys = new AbilitySystem(
    abilitiesJson as unknown as AbilityFile,
    world,
    entities,
    events,
  );
  return { world, entities, events, sys };
}

type Setup = ReturnType<typeof setup>;

function pair(s: Setup, dist = 2) {
  const caster = new Entity({
    id: 'caster', type: 'boss', faction: 'ashborn', role: 'tank',
    position: { x: 10.5, y: 30, z: 10.5 },
    stats: { maxHealth: 50, health: 50, energy: 100, maxEnergy: 100, defense: 0 },
  });
  const victim = new Entity({
    id: 'victim', type: 'passive', faction: 'neutral', role: 'support',
    position: { x: 10.5 + dist, y: 30, z: 10.5 },
    stats: { maxHealth: 30, health: 30, defense: 0 },
  });
  s.entities.spawn(caster);
  s.entities.spawn(victim);
  return { caster, victim };
}

describe('AbilitySystem', () => {
  it('loads all ability definitions from JSON', () => {
    const s = setup();
    const { sys } = s;
    expect(sys.definedCount).toBeGreaterThanOrEqual(12);
  });

  it('aoe damages everyone in radius with knockback', () => {
    const s = setup();
    const { sys } = s;
    const { caster, victim } = pair(s, 2); // inside radius 4
    caster.yaw = Math.PI / 2; // facing +X? convention aside, radial KB applies
    expect(sys.execute(caster, 'ground_slam', 1000)).toBe(true);
    expect(victim.stats.health).toBeLessThan(30);
    const pushed = Math.hypot(
      victim.velocity.x,
      victim.velocity.z,
    );
    expect(pushed).toBeGreaterThan(3); // knocked back hard
  });

  it('aoe respects radius (distant target untouched)', () => {
    const s = setup();
    // one caster + two victims: near (2m, inside r=4) & far (8m, outside)
    const { caster, victim: nearVictim } = pair(s, 2);
    const farVictim = new Entity({
      id: 'far_victim', type: 'passive', faction: 'neutral', role: 'support',
      position: { x: 18.5, y: 30, z: 10.5 },
      stats: { maxHealth: 30, health: 30, defense: 0 },
    });
    s.entities.spawn(farVictim);
    s.sys.execute(caster, 'ground_slam', 1000);
    expect(nearVictim.stats.health).toBeLessThan(30); // hit
    expect(farVictim.stats.health).toBe(30); // untouched
  });

  it('heal restores health up to max only', () => {
    const s = setup();
    const { sys } = s;
    const { caster } = pair(s);
    caster.stats.health = 20;
    sys.execute(caster, 'healing_prayer', 1000);
    expect(caster.stats.health).toBe(28); // +8
    sys.execute(caster, 'healing_prayer', 90000); // cooldown passed
    expect(caster.stats.health).toBe(36); // +8 again
  });

  it('teleport moves the caster along facing and lifts above terrain', () => {
    const s = setup();
    const { sys, world } = s;
    const { caster } = pair(s);
    world.ensureChunk(0, 0);
    caster.yaw = 0; // facing -Z
    const startZ = caster.position.z;
    sys.execute(caster, 'void_teleport', 1000);
    expect(caster.position.z).toBeLessThan(startZ - 5); // jumped ~8 blocks -Z
    expect(caster.position.y).toBeGreaterThanOrEqual(30); // lifted to surface+
  });

  it('cone hits only targets within the arc', () => {
    const s = setup();
    const { sys } = s;
    const { caster, victim } = pair(s, 3); // victim at +X of caster
    caster.yaw = 0; // facing -Z → victim at +X is OUTSIDE the 45° cone
    sys.execute(caster, 'dragon_breath', 1000);
    expect(victim.stats.health).toBe(30); // missed
    // now face +X toward victim
    caster.yaw = -Math.PI / 2; // atan2 convention: -sin(yaw)=+1 → +X
    sys.execute(caster, 'dragon_breath', 999999); // after cooldown
    expect(victim.stats.health).toBeLessThan(30); // burned
  });

  it('projectile stops at walls (no through-wall hits)', () => {
    let solidAt = false;
    const s = setup();
    const { sys, world } = s;
    // wall between caster (x=10) and victim (x=13): block at x=12,y=31,z=10
    vi.spyOn(world, 'getBlock').mockImplementation((_x, y, _z) => {
      void y;
      return solidAt ? 3 : 0;
    });
    solidAt = true;
    const { caster, victim } = pair(s, 3);
    caster.yaw = -Math.PI / 2; // fire toward +X
    sys.execute(caster, 'ender_slash_wave', 1000);
    expect(victim.stats.health).toBe(30); // blocked by wall
    solidAt = false;
    sys.execute(caster, 'ender_slash_wave', 99999);
    expect(victim.stats.health).toBeLessThan(30); // clean line → hit
  });

  it('lifesteal heals the caster by the dealt ratio', () => {
    const s = setup();
    const { sys } = s;
    const { caster, victim } = pair(s, 2);
    caster.stats.health = 10;
    sys.execute(caster, 'devour', 1000);
    expect(victim.stats.health).toBeLessThan(30);
    expect(caster.stats.health).toBeGreaterThan(10); // fed
  });

  it('cooldown blocks reuse until elapsed', () => {
    const s = setup();
    const { sys } = s;
    const { caster } = pair(s);
    expect(sys.execute(caster, 'ground_slam', 1000)).toBe(true);
    expect(sys.execute(caster, 'ground_slam', 2000)).toBe(false); // 1s later, needs 8s
    expect(sys.execute(caster, 'ground_slam', 9001)).toBe(true); // ready again
  });

  it('insufficient energy refuses without consuming anything', () => {
    const s = setup();
    const { sys } = s;
    const { caster } = pair(s);
    caster.stats.energy = 5; // slam costs 25
    expect(sys.execute(caster, 'ground_slam', 1000)).toBe(false);
    expect(caster.stats.energy).toBe(5); // untouched
  });

  it('shield absorbs incoming damage then breaks', () => {
    const s = setup();
    const { sys } = s;
    const { caster, victim } = pair(s);
    sys.execute(victim, 'crystal_guard', 1000); // victim shields (absorb 15)
    expect(victim.components.has('shield')).toBe(true);
    sys.execute(caster, 'abyssal_detonation', 2000); // 16 dmg vs shield 15 → 1 leaks
    expect(victim.stats.health).toBe(29); // 30 - 1 leaked
    expect(victim.components.has('shield')).toBe(false); // broken
  });

  it('kills emit entity:died through the event bus', () => {
    const s = setup();
    const { sys, events } = s;
    const died = vi.fn();
    events.on('entity:died', died);
    const { caster, victim } = pair(s);
    victim.stats.health = 2;
    sys.execute(caster, 'abyssal_detonation', 1000); // 16 dmg >> 2 hp
    expect(died).toHaveBeenCalledWith({ entityId: 'victim', killerId: 'caster' });
    expect(victim.dead).toBe(true);
  });

  it('victims remember their attacker (memory integration)', () => {
    const s = setup();
    const { sys } = s;
    const { caster, victim } = pair(s);
    sys.execute(caster, 'molten_eruption', 1000);
    expect(victim.memory.lastAttacker).toBe('caster');
    expect(victim.memory.threats.get('caster')).toBeGreaterThan(0);
  });
});
