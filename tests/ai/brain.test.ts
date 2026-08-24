import { describe, it, expect } from 'vitest';
import { SensorSystem } from '../../src/ai/Sensors';
import { AIBrain } from '../../src/ai/Brain';
import { Entity } from '../../src/entity/Entity';
import type { Vec3 } from '../../src/physics/physics';

/** Empty-air world (no occlusion) unless overridden per test. */
function makeWorld(solidAt?: (x: number, y: number, z: number) => boolean) {
  return { isSolid: solidAt ?? (() => false) };
}

function makeEntity(id: string, type: Entity['type'], pos: Vec3, yaw = 0): Entity {
  const e = new Entity({ id, type, faction: 'test', role: 'warrior', position: pos });
  e.yaw = yaw;
  return e;
}

const ORIGIN: Vec3 = { x: 10, y: 30, z: 10 };

describe('Sensors — vision', () => {
  it('sees a target straight ahead within range and writes lastSeenPlayer', () => {
    const s = new SensorSystem(makeWorld());
    const z = makeEntity('z', 'hostile', ORIGIN, 0); // facing -Z
    const target: Vec3 = { x: 10, y: 30, z: 4 }; // 6 blocks ahead (-Z)
    expect(s.canSee(z, target, 100)).toBe(true);
    expect(z.memory.lastSeenPlayer?.z).toBe(4);
    expect(z.memory.lastSeenPlayer?.time).toBe(100);
  });

  it('does NOT see behind its back (FOV respected)', () => {
    const s = new SensorSystem(makeWorld());
    const z = makeEntity('z', 'hostile', ORIGIN, 0); // facing -Z
    const behind: Vec3 = { x: 10, y: 30, z: 16 }; // +Z behind
    expect(s.canSee(z, behind, 100)).toBe(false);
    expect(z.memory.lastSeenPlayer).toBeUndefined();
  });

  it('does NOT see through walls (occlusion)', () => {
    // wall at z=7 spanning the ray
    const s = new SensorSystem(makeWorld((x, _y, z) => z === 7 && x === 10));
    const z = makeEntity('z', 'hostile', ORIGIN, 0);
    const hidden: Vec3 = { x: 10, y: 30, z: 4 };
    expect(s.canSee(z, hidden, 100)).toBe(false);
  });

  it('respects vision range', () => {
    const s = new SensorSystem(makeWorld(), { visionRange: 5 });
    const z = makeEntity('z', 'hostile', ORIGIN, 0);
    const far: Vec3 = { x: 10, y: 30, z: 2 }; // 8 blocks away
    expect(s.canSee(z, far, 100)).toBe(false);
  });
});

describe('Sensors — hearing', () => {
  it('hears through walls within radius', () => {
    const s = new SensorSystem(makeWorld(() => true)); // all solid!
    const z = makeEntity('z', 'hostile', ORIGIN);
    const noise: Vec3 = { x: 14, y: 30, z: 12 }; // ~5.6 blocks
    expect(s.canHear(z, noise)).toBe(true);
    void z;
  });

  it('ignores sounds beyond hearing radius', () => {
    const s = new SensorSystem(makeWorld(), { hearingRadius: 4 });
    const z = makeEntity('z', 'hostile', ORIGIN);
    const distant: Vec3 = { x: 20, y: 30, z: 20 }; // ~14 blocks
    expect(s.canHear(z, distant)).toBe(false);
  });
});

describe('AI Brain — three layers', () => {
  function brainFor(_z: Entity, targets: Array<{ id: string; position: Vec3 }>, now = 0): AIBrain {
    return new AIBrain({
      sensors: new SensorSystem(makeWorld()),
      getTargets: () => targets,
      now,
    });
  }

  it('healthy hostile with visible player → attack goal & pursues', () => {
    const z = makeEntity('z', 'hostile', ORIGIN, 0);
    const player = { id: 'p1', position: { x: 10, y: 30, z: 4 } as Vec3 };
    const brain = brainFor(z, [player]);
    const intent = brain.think(z, 0.016);
    expect(z.currentGoal).toBe('attack');
    // moves toward -Z (player direction)
    expect(intent.vz).toBeLessThan(0);
  });

  it('wounded hostile (<35% hp) flees instead of attacking', () => {
    const z = makeEntity('z', 'hostile', ORIGIN, 0);
    z.stats.health = 3; // 3/20 = 15% — badly wounded
    const player = { id: 'p1', position: { x: 10, y: 30, z: 6 } as Vec3 };
    const brain = brainFor(z, [player]);
    const intent = brain.think(z, 0.016);
    expect(z.currentGoal).toBe('flee');
    // flees AWAY from player (+Z direction)
    expect(intent.vz).toBeGreaterThan(0);
  });

  it('passive entity never attacks regardless of proximity', () => {
    const z = makeEntity('cow', 'passive', ORIGIN, 0);
    const player = { id: 'p1', position: { x: 10, y: 30, z: 5 } as Vec3 };
    const brain = brainFor(z, [player]);
    brain.think(z, 0.016);
    expect(['patrol', 'flee']).toContain(z.currentGoal);
    expect(z.currentGoal).not.toBe('attack');
  });

  it('remembers last seen position after player vanishes (memory chase)', () => {
    const z = makeEntity('z', 'hostile', ORIGIN, 0);
    // seed memory directly: saw player 3 seconds ago at z=2
    z.memory.lastSeenPlayer = { x: 10, y: 30, z: 2, time: -3000 };
    let now = 0; // "now" — 3s after sighting
    const brain = new AIBrain({
      sensors: new SensorSystem(makeWorld()),
      getTargets: () => [],
      now,
    });
    const intent = brain.think(z, 0.016);
    // goal escalates to chase toward remembered spot (moves -Z)
    expect(intent.vz).toBeLessThan(0);
    void now;
  });

  it('stale memory (>10s) stops the chase', () => {
    const z = makeEntity('z', 'hostile', ORIGIN, 0);
    z.memory.lastSeenPlayer = { x: 10, y: 30, z: 2, time: -20000 }; // 20s ago
    const brain = new AIBrain({
      sensors: new SensorSystem(makeWorld()),
      getTargets: () => [],
      now: 0,
    });
    brain.think(z, 0.016);
    // no live target + stale memory → falls back to patrol/idle, not chase
    expect(['patrol', 'idle']).toContain(z.currentGoal);
  });
});
