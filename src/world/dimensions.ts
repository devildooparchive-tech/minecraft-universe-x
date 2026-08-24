/**
 * Dimensions — multiple worlds with distinct terrain rules, isolated chunks.
 *
 * A Dimension owns its own World (seed-derived, own block palette defaults)
 * plus gameplay modifiers (gravity, ambient light). Chunk keys are namespaced
 * per dimension so coordinates never collide.
 */

import { World } from './world';

export interface DimensionRules {
  gravity: number; // blocks/s²
  skyColor: number; // hex for renderer
  fogNear: number;
  fogFar: number;
  ambient: number;
}

export interface DimensionDef {
  id: string;
  nameAr: string;
  seedSalt: number;
  baseHeight: number;
  amplitude: number;
  seaLevel: number | null; // null = no water world-wide
  rules: DimensionRules;
  /** Terrain style hook id — generator reads it to switch behavior. */
  style: 'surface' | 'nether' | 'end';
}

const DEFAULT_DIMENSIONS: DimensionDef[] = [
  {
    id: 'overworld',
    nameAr: 'العالم العلوي',
    seedSalt: 0,
    baseHeight: 24,
    amplitude: 12,
    seaLevel: 20,
    style: 'surface',
    rules: { gravity: 28, skyColor: 0x87ceeb, fogNear: 60, fogFar: 140, ambient: 0.7 },
  },
  {
    id: 'nether',
    nameAr: 'العالم السفلي',
    seedSalt: 0x6e6574,
    baseHeight: 18,
    amplitude: 16,
    seaLevel: null, // lava seas come in Phase 3
    style: 'nether',
    rules: { gravity: 20, skyColor: 0x2a0a08, fogNear: 12, fogFar: 48, ambient: 0.35 },
  },
  {
    id: 'aether',
    nameAr: 'البعد السحري',
    seedSalt: 0x414554,
    baseHeight: 30,
    amplitude: 8,
    seaLevel: null,
    style: 'end',
    rules: { gravity: 14, skyColor: 0x120b1e, fogNear: 40, fogFar: 110, ambient: 0.5 },
  },
];

export class Dimension {
  readonly def: DimensionDef;
  readonly world: World;

  constructor(def: DimensionDef, masterSeed: number) {
    this.def = def;
    this.world = new World({
      seed: (masterSeed ^ def.seedSalt) >>> 0 || masterSeed + 1,
      baseHeight: def.baseHeight,
      amplitude: def.amplitude,
      ...(def.seaLevel !== null ? { seaLevel: def.seaLevel } : {}),
    });
  }
}

export class DimensionManager {
  private readonly dims = new Map<string, Dimension>();
  private activeId = 'overworld';

  constructor(
    readonly masterSeed: number,
    dimensions: DimensionDef[] = DEFAULT_DIMENSIONS,
  ) {
    for (const d of dimensions) {
      this.dims.set(d.id, new Dimension(d, masterSeed));
    }
  }

  get ids(): string[] {
    return [...this.dims.keys()];
  }

  get active(): Dimension {
    return this.dims.get(this.activeId)!;
  }

  byId(id: string): Dimension | undefined {
    return this.dims.get(id);
  }

  /** Switch dimension. Returns the new active one. */
  travel(id: string): Dimension {
    const dim = this.dims.get(id);
    if (!dim) throw new Error(`unknown dimension: ${id}`);
    this.activeId = id;
    return dim;
  }

  get currentId(): string {
    return this.activeId;
  }

  static defaultDefs(): DimensionDef[] {
    return DEFAULT_DIMENSIONS.map((d) => ({ ...d }));
  }
}
