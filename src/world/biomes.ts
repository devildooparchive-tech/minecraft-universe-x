/**
 * Biomes — climate-driven biome selection (temperature × humidity fields).
 *
 * Selection: two low-frequency noise fields pick a point in climate space;
 * the biome whose temperature/humidity window contains it wins. Windows
 * overlap deliberately near edges → natural, walkable transitions (the
 * surface block changes but height stays continuous because heightBias/
 * Scale differences are blended by climate distance).
 */

export interface BiomeDef {
  id: number;
  name: string;
  nameAr: string;
  surfaceBlock: number;
  fillerBlock: number;
  underwater?: boolean;
  temperature: [number, number];
  humidity: [number, number];
  heightBias: number;
  heightScale: number;
  treeDensity: number;
  structure?: string;
}

export interface BiomeFile {
  version: string;
  biomes: BiomeDef[];
}

/** Distance from (t,h) to a biome's climate window; 0 inside. */
function climateDistance(biome: BiomeDef, t: number, h: number): number {
  const dt = Math.max(biome.temperature[0] - t, 0, t - biome.temperature[1]);
  const dh = Math.max(biome.humidity[0] - h, 0, h - biome.humidity[1]);
  return Math.hypot(dt, dh);
}

/** Distance from (t,h) to the biome's climate-window CENTER (tie-breaker). */
function climateCenterDistance(biome: BiomeDef, t: number, h: number): number {
  const ct = (biome.temperature[0] + biome.temperature[1]) / 2;
  const ch = (biome.humidity[0] + biome.humidity[1]) / 2;
  return Math.hypot(ct - t, ch - h);
}

export class BiomeRegistry {
  readonly biomes: BiomeDef[];

  constructor(file: BiomeFile) {
    if (file.biomes.length === 0) throw new Error('biome file empty');
    this.biomes = [...file.biomes].sort((a, b) => a.id - b.id);
  }

  get count(): number {
    return this.biomes.length;
  }

  byId(id: number): BiomeDef | undefined {
    return this.biomes.find((b) => b.id === id);
  }

  /** Nearest biome in climate space; ties broken by window-center distance. */
  select(temperature: number, humidity: number): BiomeDef {
    let best = this.biomes[0];
    let bestDist = Infinity;
    let bestCenter = Infinity;
    for (const b of this.biomes) {
      const d = climateDistance(b, temperature, humidity);
      if (d < bestDist - 1e-9) {
        bestDist = d;
        bestCenter = climateCenterDistance(b, temperature, humidity);
        best = b;
      } else if (Math.abs(d - bestDist) <= 1e-9) {
        const c = climateCenterDistance(b, temperature, humidity);
        if (c < bestCenter) {
          best = b;
          bestCenter = c;
        }
      }
    }
    return best;
  }

  /** Blend two biomes' height params by climate distance ratio (smooth transitions). */
  blendHeight(temperature: number, humidity: number): { bias: number; scale: number } {
    // find two nearest
    const scored = this.biomes
      .map((b) => ({ b, d: climateDistance(b, temperature, humidity) }))
      .sort((x, y) => x.d - y.d);
    const first = scored[0];
    const second = scored[1] ?? first;
    const total = first.d + second.d;
    const w2 = total > 0 ? second.d / total : 0; // weight of nearest
    return {
      bias: first.b.heightBias * w2 + second.b.heightBias * (1 - w2),
      scale: first.b.heightScale * w2 + second.b.heightScale * (1 - w2),
    };
  }
}
