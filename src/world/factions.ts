/**
 * Factions — inter-character relations & spawn rules (data-driven).
 *
 * The AI system (Phase 4) reads relations from here; combat/assist decisions
 * never hardcode faction names.
 */

export interface FactionDef {
  id: number;
  name: string;
  nameAr: string;
  disposition: 'neutral' | 'friendly' | 'hostile' | 'elusive';
  allies: string[];
  enemies: string[];
  spawnBiomes: string[];
  lootMultiplier: number;
  behavior: string;
}

export interface FactionFile {
  version: string;
  factions: FactionDef[];
}

export class FactionRegistry {
  private readonly byId = new Map<string, FactionDef>();

  constructor(file: FactionFile) {
    for (const f of file.factions) this.byId.set(f.name, f);
  }

  get count(): number {
    return this.byId.size;
  }

  byName(name: string): FactionDef | undefined {
    return this.byId.get(name);
  }

  /** Are two factions hostile to each other? Symmetric. */
  areEnemies(a: string, b: string): boolean {
    const fa = this.byName(a);
    const fb = this.byName(b);
    if (!fa || !fb) return false;
    return fa.enemies.includes(b) && fb.enemies.includes(a);
  }

  areAllies(a: string, b: string): boolean {
    const fa = this.byName(a);
    const fb = this.byName(b);
    if (!fa || !fb) return false;
    return fa.allies.includes(b) && fb.allies.includes(a);
  }

  /** Which factions can spawn in this biome? */
  spawnersFor(biomeName: string): FactionDef[] {
    return [...this.byId.values()].filter((f) => f.spawnBiomes.includes(biomeName));
  }

  all(): FactionDef[] {
    return [...this.byId.values()];
  }
}
