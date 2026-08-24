/**
 * Sensors — perception layer feeding entity memory.
 *
 * Vision: FOV cone (default 120°) + range + simple occlusion via world solid
 * check along the ray. Hearing: radius, ignores walls but attenuates with
 * distance. All results write into EntityMemory so the tactical layer can
 * act on stale information too.
 */

import type { Entity } from '../entity/Entity';
import type { Vec3 } from '../physics/physics';

export interface SensorWorld {
  isSolid: (x: number, y: number, z: number) => boolean;
}

export interface SensorConfig {
  visionRange?: number; // default 16
  visionFovDeg?: number; // default 120
  hearingRadius?: number; // default 8
  eyeHeight?: number; // default 1.6
}

const DEFAULTS: Required<SensorConfig> = {
  visionRange: 16,
  visionFovDeg: 120,
  hearingRadius: 8,
  eyeHeight: 1.6,
};

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/** Bresenham-lite occlusion: sample the ray every 0.5 blocks for solids. */
function hasLineOfSight(world: SensorWorld, from: Vec3, to: Vec3): boolean {
  const d = dist(from, to);
  if (d < 0.001) return true;
  const steps = Math.ceil(d / 0.5);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(from.x + (to.x - from.x) * t);
    const y = Math.floor(from.y + (to.y - from.y) * t);
    const z = Math.floor(from.z + (to.z - from.z) * t);
    if (world.isSolid(x, y, z)) return false;
  }
  return true;
}

export class SensorSystem {
  private readonly cfg: Required<SensorConfig>;
  private readonly world: SensorWorld;

  constructor(world: SensorWorld, config: SensorConfig = {}) {
    this.world = world;
    this.cfg = { ...DEFAULTS, ...config };
  }

  /**
   * Run vision for one observer against one candidate target.
   * Returns true AND writes lastSeenPlayer when spotted.
   */
  canSee(observer: Entity, targetPos: Vec3, now: number): boolean {
    const eye: Vec3 = {
      x: observer.position.x,
      y: observer.position.y + this.cfg.eyeHeight,
      z: observer.position.z,
    };
    const d = dist(eye, targetPos);
    if (d > this.cfg.visionRange) return false;

    // FOV check around observer's facing yaw (forward = -Z at yaw 0)
    const dx = targetPos.x - observer.position.x;
    const dz = targetPos.z - observer.position.z;
    const flatDist = Math.hypot(dx, dz);
    if (flatDist > 0.5) {
      const angleToTarget = Math.atan2(-dx, -dz); // matches player forward convention
      let diff = Math.abs(angleToTarget - observer.yaw);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
      const halfFov = ((this.cfg.visionFovDeg / 2) * Math.PI) / 180;
      if (diff > halfFov) return false;
    }

    if (!hasLineOfSight(this.world, eye, targetPos)) return false;

    observer.memory.lastSeenPlayer = {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      time: now,
    };
    return true;
  }

  /** Hearing ignores occlusion — sound bends around walls. */
  canHear(observer: Entity, sourcePos: Vec3): boolean {
    return dist(observer.position, sourcePos) <= this.cfg.hearingRadius;
  }
}
