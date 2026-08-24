/**
 * EntityManager — registry + spatial index + persistence for entities.
 *
 * Superiority: entity memory is chunk-anchored and survives save/load.
 */

import { Entity, type SerializedEntity } from './Entity';

export interface EntitySaveData {
  version: 1;
  entities: SerializedEntity[];
}

export class EntityManager {
  private readonly byId = new Map<string, Entity>();
  private readonly byChunk = new Map<string, Set<string>>();

  static chunkKey(x: number, z: number): string {
    return `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
  }

  spawn(entity: Entity): void {
    if (this.byId.has(entity.id)) {
      throw new Error(`duplicate entity id: ${entity.id}`);
    }
    this.byId.set(entity.id, entity);
    const key = EntityManager.chunkKey(entity.position.x, entity.position.z);
    let set = this.byChunk.get(key);
    if (!set) {
      set = new Set();
      this.byChunk.set(key, set);
    }
    set.add(entity.id);
  }

  despawn(id: string): void {
    const e = this.byId.get(id);
    if (!e) return;
    this.byId.delete(id);
    const key = EntityManager.chunkKey(e.position.x, e.position.z);
    this.byChunk.get(key)?.delete(id);
  }

  get(id: string): Entity | undefined {
    return this.byId.get(id);
  }

  /** Entities whose anchor chunk matches (fast local queries for AI). */
  inChunk(cx: number, cz: number): Entity[] {
    const ids = this.byChunk.get(`${cx},${cz}`);
    if (!ids) return [];
    return [...ids].map((id) => this.byId.get(id)!).filter(Boolean);
  }

  all(): Entity[] {
    return [...this.byId.values()];
  }

  get count(): number {
    return this.byId.size;
  }

  /**
   * Re-index an entity after it moved chunks (call once per tick per moved
   * entity — cheap because it early-outs when the key is unchanged).
   */
  reindex(entity: Entity): void {
    const key = EntityManager.chunkKey(entity.position.x, entity.position.z);
    // find its current recorded chunk by scanning the one-set membership via id map
    for (const [k, set] of this.byChunk) {
      if (set.has(entity.id)) {
        if (k === key) return; // unchanged
        set.delete(entity.id);
        break;
      }
    }
    let set = this.byChunk.get(key);
    if (!set) {
      set = new Set();
      this.byChunk.set(key, set);
    }
    set.add(entity.id);
  }

  export(): EntitySaveData {
    return {
      version: 1,
      entities: this.all().map((e) => e.export()),
    };
  }

  import(data: EntitySaveData): void {
    if (data.version !== 1) return;
    for (const raw of data.entities) {
      try {
        this.spawn(Entity.from(raw));
      } catch {
        // duplicate id on reload → replace instead of crash
        this.despawn(raw.id);
        this.spawn(Entity.from(raw));
      }
    }
  }
}
