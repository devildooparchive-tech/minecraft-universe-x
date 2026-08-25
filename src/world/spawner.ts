/**
 * Spawner — biome/faction-driven entity generation (Overhaul P6).
 *
 * Every spawned entity starts with EMPTY memory — it will learn about the
 * player through interactions (superiority: born-innocent, not preset).
 */

import { Entity } from '../entity/Entity';
import type { EntityManager } from '../entity/EntityManager';
import type { World } from '../world/world';
import type { FactionRegistry, FactionDef } from '../world/factions';
import { hash2 } from './noise3d';

export interface SpawnResult {
  entityId: string;
  faction: string;
  type: 'hostile' | 'passive' | 'npc';
}

/** Name pools per faction for flavor. */
const NAME_POOLS: Record<string, string[]> = {
  neutral: ['قروي', 'مسافر', 'حرفي'],
  verdant: ['حارس المرج', 'راعي الغابة'],
  nightbrood: ['زومبي', 'عنكبوت ظل', 'هامس الليل'],
  ashborn: ['محارب رماد', 'غول الحمم'],
  mythic: ['كائن أسطوري'],
};

export function spawnEntitiesForChunk(
  world: World,
  entities: EntityManager,
  factions: FactionRegistry,
  cx: number,
  cz: number,
  seed: number,
): SpawnResult[] {
  const results: SpawnResult[] = [];
  // avoid double-spawning the same chunk (idempotent by id scheme)
  const chunkTag = `c${cx}_${cz}`;
  const probeId = `probe_${chunkTag}_0`;
  if (entities.get(probeId)) return [];

  const biome = world.biomeAt(cx * 16 + 8, cz * 16 + 8);
  const spawners: FactionDef[] = factions.spawnersFor(biome.name);
  if (spawners.length === 0) return [];

  for (let fi = 0; fi < spawners.length; fi++) {
    const f = spawners[fi];
    const count = 1 + (hash2(seed ^ 0xdead, cx * 7 + fi, cz) % 2); // 1-2 per faction
    for (let i = 0; i < count; i++) {
      const lx = hash2(seed ^ (i + 1) * 31, cx, cz) % 16;
      const lz = hash2(seed ^ (i + 5) * 17, cx, cz) % 16;
      const wx = cx * 16 + lx;
      const wz = cz * 16 + lz;
      const y = world.heightAt(wx, wz) + 1;
      if (y <= world.seaLevel) continue; // don't spawn in water

      const isHostile =
        f.disposition === 'hostile' || f.disposition === 'elusive';
      const names = NAME_POOLS[f.name] ?? [f.nameAr];
      const nameAr = names[hash2(seed ^ i * 101, cx, cz) % names.length];

      const entity = new Entity({
        id: `${f.name}_${chunkTag}_${i}`,
        type: isHostile ? 'hostile' : f.disposition === 'friendly' ? 'npc' : 'passive',
        faction: f.name,
        role: isHostile ? 'warrior' : 'support',
        position: { x: wx + 0.5, y, z: wz + 0.5 },
        nameAr,
        stats: {
          maxHealth: isHostile ? 16 : 10,
          health: isHostile ? 16 : 10,
          speed: isHostile ? 3 : 2.2,
          attackDamage: isHostile ? 4 : 1,
        },
      });
      try {
        entities.spawn(entity);
        results.push({
          entityId: entity.id,
          faction: f.name,
          type: entity.type as 'hostile' | 'passive' | 'npc',
        });
      } catch {
        // duplicate → skip silently (idempotency)
      }
    }
  }
  void probeId;
  return results;
}
