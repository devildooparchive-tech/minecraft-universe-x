/**
 * AI Brain — three-layer decision stack (superiority over vanilla priority lists):
 *
 *   Strategic layer : utility scoring → picks a goal (attack/flee/patrol...)
 *   Tactical layer  : validates goal feasibility (target alive? memory fresh?)
 *                     and steers movement toward/away from the focus point.
 *   Execution layer : writes velocity intents consumed by physics.step().
 *
 * The brain is pure logic (no THREE, no DOM) — fully unit-testable.
 */

import type { Entity } from '../entity/Entity';
import type { Vec3 } from '../physics/physics';
import { SensorSystem } from './Sensors';
import type { GoalState } from '../entity/Entity';

export interface BrainTarget {
  id: string;
  position: Vec3;
}

export interface BrainDeps {
  sensors: SensorSystem;
  /** all candidate targets (usually [player, ...entities]) */
  getTargets: () => BrainTarget[];
  now: number;
}

export interface StrategicScores {
  attack: number;
  flee: number;
  patrol: number;
}

const MEMORY_STALE_MS = 10_000; // 10 seconds, in milliseconds (timestamps are ms)

export class AIBrain {
  private readonly deps: BrainDeps;
  /** ticks until next strategic re-evaluation (runs every ~0.25s) */
  private strategyCooldown = 0;

  constructor(deps: BrainDeps) {
    this.deps = deps;
  }

  // ---------- STRATEGIC LAYER ----------
  scoreStrategic(entity: Entity, target?: BrainTarget): StrategicScores {
    const hpRatio = entity.stats.health / entity.stats.maxHealth;
    let threatNearby = 0;
    if (target) {
      const d = Math.hypot(
        target.position.x - entity.position.x,
        target.position.z - entity.position.z,
      );
      threatNearby = Math.max(0, 1 - d / 20); // closer → higher
    }

    const aggression =
      (entity.type === 'hostile' || entity.type === 'boss' ? 1 : 0.2) *
      hpRatio; // wounded hosts hesitate

    const attack = target ? aggression * (0.5 + threatNearby) * 100 : 0;
    const flee =
      target && hpRatio < 0.35 ? (0.35 - hpRatio) / 0.35 * threatNearby * 100 : 0;
    const patrol = target ? 15 + threatNearby * 5 : 40; // baseline wandering

    return { attack, flee, patrol };
  }

  pickGoal(scores: StrategicScores): GoalState {
    if (scores.flee >= scores.attack && scores.flee > 45) return 'flee';
    if (scores.attack > 30) return 'attack';
    return 'patrol';
  }

  // ---------- TACTICAL LAYER ----------
  /** Choose the current focus position for the chosen goal. */
  resolveFocus(entity: Entity, goal: GoalState, targets: BrainTarget[]): BrainTarget | null {
    if (goal === 'attack' || goal === 'chase') {
      // prefer a visible target; else fall back to FRESH memory (< stale window)
      for (const t of targets) {
        if (this.deps.sensors.canSee(entity, t.position, this.deps.now)) return t;
      }
      const mem = entity.memory.lastSeenPlayer;
      if (
        mem &&
        this.deps.now - mem.time < MEMORY_STALE_MS &&
        goal === 'chase'
      ) {
        return { id: 'memory', position: { x: mem.x, y: mem.y, z: mem.z } };
      }
      return null;
    }
    if (goal === 'flee') {
      // run away from nearest threat
      let best: BrainTarget | null = null;
      let bestDist = Infinity;
      for (const t of targets) {
        const d = Math.hypot(t.position.x - entity.position.x, t.position.z - entity.position.z);
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }
      return best;
    }
    return null;
  }

  // ---------- EXECUTION ----------
  /**
   * Full brain tick. Returns a velocity intent (horizontal) to feed physics.
   * Does NOT mutate the world — caller applies via their own physics.
   */
  think(entity: Entity, dt: number): { vx: number; vz: number } {
    this.strategyCooldown -= dt;
    const targets = this.deps.getTargets();

    if (this.strategyCooldown <= 0) {
      this.strategyCooldown = 0.25;
      const scores = this.scoreStrategic(entity, targets[0]);
      entity.currentGoal = this.pickGoal(scores);
    }

    // Tactical upgrade: no live target but FRESH memory of one → escalate
    // patrol into chase toward the remembered spot (superiority #6: spatial
    // memory — vanilla mobs forget instantly).
    if (targets.length === 0 && entity.currentGoal === 'patrol') {
      const mem = entity.memory.lastSeenPlayer;
      if (mem && this.deps.now - mem.time < MEMORY_STALE_MS) {
        entity.currentGoal = 'chase';
      }
    }

    const goal = entity.currentGoal as GoalState;
    const focus = this.resolveFocus(entity, goal, targets);

    if (!focus) {
      // memory-only chase focus
      if (goal === 'chase') {
        const mem = entity.memory.lastSeenPlayer;
        if (mem) {
          const dx = mem.x - entity.position.x;
          const dz = mem.z - entity.position.z;
          const d = Math.hypot(dx, dz) || 1;
          entity.yaw = Math.atan2(-dx, -dz);
          return { vx: (dx / d) * entity.stats.speed, vz: (dz / d) * entity.stats.speed };
        }
      }
      // no actionable focus → gentle wander drift on patrol
      if (goal === 'patrol') {
        const wobble = Math.sin(this.deps.now * 0.001 + entity.id.length);
        return { vx: Math.cos(wobble) * entity.stats.speed * 0.4, vz: Math.sin(wobble) * entity.stats.speed * 0.4 };
      }
      return { vx: 0, vz: 0 };
    }

    const dx = focus.position.x - entity.position.x;
    const dz = focus.position.z - entity.position.z;
    const d = Math.hypot(dx, dz) || 1;

    if (goal === 'attack' || goal === 'chase') {
      // face & pursue; stop at melee range 1.2
      entity.yaw = Math.atan2(-dx, -dz);
      if (d > 1.2) {
        return { vx: (dx / d) * entity.stats.speed, vz: (dz / d) * entity.stats.speed };
      }
      return { vx: 0, vz: 0 };
    }

    if (goal === 'flee') {
      entity.yaw = Math.atan2(dx, dz); // face AWAY handled by motion direction
      return { vx: (-dx / d) * entity.stats.speed * 1.2, vz: (-dz / d) * entity.stats.speed * 1.2 };
    }

    return { vx: 0, vz: 0 };
  }
}
