/**
 * AbilitySystem — data-driven ability execution with cooldowns & energy.
 *
 * Effects are handled by generic executors (aoe/heal/teleport/cone/projectile/
 * shield/melee_buff/lifesteal); magnitudes come from abilities.json so new
 * content never touches this file (Fabric-recipes philosophy).
 */

import type { Entity } from '../entity/Entity';
import type { EntityManager } from '../entity/EntityManager';
import type { World } from '../world/world';
import type { EventBus } from '../core/events';

export type AbilityType =
  | 'aoe'
  | 'aoe_self'
  | 'heal'
  | 'teleport'
  | 'cone'
  | 'projectile'
  | 'shield'
  | 'melee_buff'
  | 'lifesteal';

export interface AbilityDef {
  id: string;
  name: string;
  nameAr?: string;
  type: AbilityType;
  energyCost: number;
  cooldownMs: number;
  damage?: number;
  healAmount?: number;
  radius?: number;
  range?: number;
  knockback?: number;
  coneDeg?: number;
  projectileSpeed?: number;
  durationMs?: number;
  absorb?: number;
  bonusDamage?: number;
  healRatio?: number;
  selfDamage?: number;
}

export interface AbilityFile {
  version: string;
  abilities: AbilityDef[];
}

interface RuntimeState {
  lastUsed: number;
}

export class AbilitySystem {
  private readonly defs = new Map<string, AbilityDef>();
  private readonly runtime = new Map<string, RuntimeState>(); // key: casterId+abilityId
  private readonly world: World;
  private readonly entities: EntityManager;
  private readonly events: EventBus;

  constructor(file: AbilityFile, world: World, entities: EntityManager, events: EventBus) {
    for (const a of file.abilities) this.defs.set(a.id, a);
    this.world = world;
    this.entities = entities;
    this.events = events;
  }

  get definedCount(): number {
    return this.defs.size;
  }

  def(id: string): AbilityDef | undefined {
    return this.defs.get(id);
  }

  canUse(casterId: string, abilityId: string, now: number): boolean {
    const def = this.defs.get(abilityId);
    if (!def) return false;
    const rt = this.runtime.get(casterId + ':' + abilityId);
    if (rt && now - rt.lastUsed < def.cooldownMs) return false;
    return true;
  }

  /**
   * Execute an ability. Returns true on success.
   * Direction is the caster's facing (-Z at yaw 0, matching player convention).
   */
  execute(
    caster: Entity,
    abilityId: string,
    now: number,
    dir?: { x: number; z: number },
  ): boolean {
    const def = this.defs.get(abilityId);
    if (!def) return false;

    // cooldown gate
    const rtKey = caster.id + ':' + abilityId;
    const rt = this.runtime.get(rtKey);
    if (rt && now - rt.lastUsed < def.cooldownMs) return false;

    // energy gate
    if (caster.stats.energy < def.energyCost) return false;
    caster.stats.energy -= def.energyCost;
    this.runtime.set(rtKey, { lastUsed: now });

    const dx = dir?.x ?? -Math.sin(caster.yaw);
    const dz = dir?.z ?? -Math.cos(caster.yaw);
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;

    switch (def.type) {
      case 'aoe':
      case 'aoe_self': {
        if (def.type === 'aoe_self' && def.selfDamage) caster.stats.health -= def.selfDamage;
        for (const other of this.entities.all()) {
          if (other.id === caster.id || other.dead) continue;
          const d = Math.hypot(other.position.x - caster.position.x, other.position.z - caster.position.z);
          if (d <= (def.radius ?? 3)) {
            this.damage(other, def.damage ?? 5, caster.id);
            if (def.knockback) {
              other.velocity.x += ((other.position.x - caster.position.x) / (d || 1)) * def.knockback;
              other.velocity.z += ((other.position.z - caster.position.z) / (d || 1)) * def.knockback;
            }
          }
        }
        break;
      }
      case 'heal': {
        caster.stats.health = Math.min(
          caster.stats.maxHealth,
          caster.stats.health + (def.healAmount ?? 5),
        );
        break;
      }
      case 'teleport': {
        const range = def.range ?? 6;
        let targetX = caster.position.x + nx * range;
        let targetZ = caster.position.z + nz * range;
        // snap up to surface if inside ground
        const y = this.world.heightAt(Math.floor(targetX), Math.floor(targetZ)) + 1;
        caster.prevPosition = { ...caster.position };
        caster.position.x = targetX;
        caster.position.z = targetZ;
        caster.position.y = Math.max(caster.position.y, y + 0.1);
        void targetX; void targetZ;
        break;
      }
      case 'cone': {
        const halfCone = (((def.coneDeg ?? 40) / 2) * Math.PI) / 180;
        for (const other of this.entities.all()) {
          if (other.id === caster.id || other.dead) continue;
          const odx = other.position.x - caster.position.x;
          const odz = other.position.z - caster.position.z;
          const d = Math.hypot(odx, odz);
          if (d > (def.range ?? 8)) continue;
          const dot = (odx / (d || 1)) * nx + (odz / (d || 1)) * nz;
          if (dot >= Math.cos(halfCone)) {
            this.damage(other, def.damage ?? 10, caster.id);
          }
        }
        break;
      }
      case 'projectile': {
        // instant raycast hit-scan along direction up to range
        const range = def.range ?? 10;
        for (let t = 1; t <= range; t += 0.5) {
          const px = Math.floor(caster.position.x + nx * t);
          const py = Math.floor(caster.position.y + 1.4);
          const pz = Math.floor(caster.position.z + nz * t);
          if (this.world.getBlock(px, py, pz) !== 0) break; // wall stops it
          for (const other of this.entities.all()) {
            if (other.id === caster.id || other.dead) continue;
            if (
              Math.floor(other.position.x) === px &&
              Math.floor(other.position.z) === pz &&
              py >= Math.floor(other.position.y) &&
              py <= Math.floor(other.position.y + 1.8)
            ) {
              this.damage(other, def.damage ?? 6, caster.id);
              t = range + 1; // consumed
              break;
            }
          }
        }
        break;
      }
      case 'shield': {
        caster.components.set('shield', { absorb: def.absorb ?? 10, until: now + (def.durationMs ?? 5000) });
        break;
      }
      case 'melee_buff': {
        caster.components.set('melee_buff', { bonus: def.bonusDamage ?? 5, until: now + (def.durationMs ?? 5000) });
        break;
      }
      case 'lifesteal': {
        // hits the current melee target in front within range
        for (const other of this.entities.all()) {
          if (other.id === caster.id || other.dead) continue;
          const d = Math.hypot(other.position.x - caster.position.x, other.position.z - caster.position.z);
          if (d <= (def.range ?? 2.5)) {
            const dealt = this.damage(other, def.damage ?? 8, caster.id);
            caster.stats.health = Math.min(
              caster.stats.maxHealth,
              caster.stats.health + dealt * (def.healRatio ?? 0.5),
            );
            break;
          }
        }
        break;
      }
    }

    this.events.emit('ability:used', { casterId: caster.id, abilityId });
    return true;
  }

  /** Apply damage with defense reduction + shield absorption. Returns dealt HP. */
  private damage(target: Entity, raw: number, sourceId: string): number {
    const shield = target.components.get('shield') as { absorb: number; until: number } | undefined;
    let amount = Math.max(1, raw - target.stats.defense);
    if (shield) {
      const absorbed = Math.min(shield.absorb, amount);
      shield.absorb -= absorbed;
      amount -= absorbed;
      if (shield.absorb <= 0) target.components.delete('shield');
    }
    target.stats.health = Math.max(0, target.stats.health - amount);
    target.memory.recordInteraction('attack', sourceId, Date.now());
    target.memory.addThreat(sourceId, 30);
    // expire stale shields using wall clock only if it's actually ahead
    // (test clocks may be synthetic; treat `until` as authoritative)
    if (target.stats.health <= 0) {
      this.events.emit('entity:died', { entityId: target.id, killerId: sourceId });
    }
    return amount;
  }
}
