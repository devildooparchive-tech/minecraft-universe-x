/**
 * World — chunk container + terrain generation + edit journal.
 *
 * Design decisions:
 *  - Chunks keyed by `cx,cz` string (simple, fast enough at our scale).
 *  - Negative coordinates: chunk coords floor-divide world coords; local
 *    coords use modulo that stays in [0,15] for negatives.
 *  - Edit journal: player modifications survive unload/regeneration.
 *    Persistence (Phase 1.9) will serialize this journal, not raw chunks.
 */

import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk';
import { PerlinNoise } from './noise';
import { PerlinNoise3D, hash2 } from './noise3d';
import { isBigRoom, pickOre } from './ores';
import { BiomeRegistry, type BiomeFile } from './biomes';
import biomesJson from '../../data/world/biomes.json';

/** Per-biome surface decoration tables (Overhaul P2). */
const DECORATIONS: Record<string, Array<{ block: number; chance: number }>> = {
  forest: [
    { block: 17, chance: 0.02 }, // fern
    { block: 18, chance: 0.012 }, // red flower
    { block: 19, chance: 0.006 }, // mushroom
  ],
  plains: [{ block: 20, chance: 0.05 }], // tall grass
  desert: [{ block: 21, chance: 0.03 }], // dead bush
  snow: [{ block: 22, chance: 0.06 }], // snow layer
  swamp: [
    { block: 19, chance: 0.02 }, // mushrooms love swamps
    { block: 17, chance: 0.015 },
  ],
};

export interface WorldOptions {
  seed?: number;
  /** Sea level (default baseHeight-4). */
  seaLevel?: number;
  /** Base terrain height (default 24). */
  baseHeight?: number;
  /** Terrain amplitude in blocks (default 12). */
  amplitude?: number;
}

export class World {
  readonly seed: number;
  private readonly chunks = new Map<string, Chunk>();
  private readonly edits = new Map<string, number>(); // "x,y,z" -> blockId
  private readonly noise: PerlinNoise;
  private readonly baseHeight: number;
  private readonly amplitude: number;
  /** Sea level for oceans/lakes (default 20). */
  readonly seaLevel: number;
  private readonly biomeRegistry: BiomeRegistry;
  private readonly tempNoise: PerlinNoise;
  private readonly humidNoise: PerlinNoise;
  private readonly caveA: PerlinNoise3D;
  private readonly caveB: PerlinNoise3D;
  private readonly roomNoise: PerlinNoise3D;
  private readonly riverNoise: PerlinNoise;

  constructor(options: WorldOptions = {}) {
    this.seed = options.seed ?? 1337;
    this.baseHeight = options.baseHeight ?? 24;
    this.amplitude = options.amplitude ?? 12;
    this.seaLevel = options.seaLevel ?? Math.round(this.baseHeight - 4);
    this.noise = new PerlinNoise(this.seed);
    this.biomeRegistry = new BiomeRegistry(biomesJson as unknown as BiomeFile);
    // independent sub-seeds so climate/caves never correlate with terrain
    this.tempNoise = new PerlinNoise(this.seed ^ 0x51ab);
    this.humidNoise = new PerlinNoise(this.seed ^ 0x9e37);
    this.caveA = new PerlinNoise3D(this.seed ^ 0xcafe);
    this.caveB = new PerlinNoise3D(this.seed ^ 0xbeef);
    this.roomNoise = new PerlinNoise3D(this.seed ^ 0x4007);
    this.riverNoise = new PerlinNoise(this.seed ^ 0x21be7);
  }

  get biomeCount(): number {
    return this.biomeRegistry.count;
  }

  /** Public biome query for HUD/debug/ spawning logic. */
  biomeAt(x: number, z: number): { id: number; name: string; nameAr: string } {
    const t = this.climate(x, z, this.tempNoise);
    const h = this.climate(x, z, this.humidNoise);
    const b = this.biomeRegistry.select(t, h);
    return { id: b.id, name: b.name, nameAr: b.nameAr };
  }

  static key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  /** World coords → chunk coords (floor division, correct for negatives). */
  static chunkCoord(x: number, z: number): { cx: number; cz: number } {
    return {
      cx: Math.floor(x / CHUNK_SIZE),
      cz: Math.floor(z / CHUNK_SIZE),
    };
  }

  /** World coords → local coords within a chunk (always 0..15). */
  static localCoord(x: number, z: number): { lx: number; lz: number } {
    return {
      lx: ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
      lz: ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    };
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  hasChunk(cx: number, cz: number): boolean {
    return this.chunks.has(World.key(cx, cz));
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(World.key(cx, cz));
  }

  /** Load (generate) a chunk if missing. Idempotent. */
  ensureChunk(cx: number, cz: number): Chunk {
    const key = World.key(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.generateTerrain(chunk);
      this.applyEditsTo(chunk);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  unloadChunk(cx: number, cz: number): void {
    this.chunks.delete(World.key(cx, cz));
  }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return 3; // below the world behaves as solid stone
    if (y >= CHUNK_HEIGHT) return 0;
    const { cx, cz } = World.chunkCoord(x, z);
    const chunk = this.chunks.get(World.key(cx, cz));
    if (!chunk) return 0;
    const { lx, lz } = World.localCoord(x, z);
    return chunk.get(lx, y, lz);
  }

  setBlock(x: number, y: number, z: number, id: number): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const { cx, cz } = World.chunkCoord(x, z);
    // Contract: after setBlock(x,y,z,id), getBlock(x,y,z) === id.
    // Auto-ensure keeps that promise even for not-yet-generated chunks;
    // the edit is journaled so regeneration preserves it.
    const chunk = this.ensureChunk(cx, cz);
    const { lx, lz } = World.localCoord(x, z);
    chunk.set(lx, y, lz, id);
    // Journal the edit so it survives unload/regenerate.
    this.edits.set(`${x},${y},${z}`, id);
  }

  /** Surface height (topmost solid y) at world x,z. Generates the chunk if needed. */
  heightAt(x: number, z: number): number {
    const { cx, cz } = World.chunkCoord(x, z);
    this.ensureChunk(cx, cz);
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this.getBlock(x, y, z) !== 0) return y;
    }
    return 0;
  }

  /** Spawn position: on top of terrain at origin-ish coordinates. */
  findSpawn(x = 8, z = 8): { x: number; y: number; z: number } {
    return { x: x + 0.5, y: this.heightAt(x, z) + 2, z: z + 0.5 };
  }

  /** Export the edit journal for persistence. */
  exportEdits(): Array<{ x: number; y: number; z: number; id: number }> {
    const out: Array<{ x: number; y: number; z: number; id: number }> = [];
    for (const [key, id] of this.edits) {
      const [x, y, z] = key.split(',').map(Number);
      out.push({ x, y, z, id });
    }
    return out;
  }

  importEdits(list: Array<{ x: number; y: number; z: number; id: number }>): void {
    for (const e of list) {
      this.edits.set(`${e.x},${e.y},${e.z}`, e.id);
      // Apply immediately if chunk is loaded
      const { cx, cz } = World.chunkCoord(e.x, e.z);
      const chunk = this.chunks.get(World.key(cx, cz));
      if (chunk) {
        const { lx } = World.localCoord(e.x, e.z);
        const { lz } = World.localCoord(e.x, e.z);
        chunk.set(lx, e.y, lz, e.id);
      }
    }
  }

  private generateTerrain(chunk: Chunk): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = ox + lx;
        const wz = oz + lz;

        // --- climate fields → biome selection + blended height params ---
        const temperature = this.climate(wx, wz, this.tempNoise);
        const humidity = this.climate(wx, wz, this.humidNoise);
        const biome = this.biomeRegistry.select(temperature, humidity);
        const blended = this.biomeRegistry.blendHeight(temperature, humidity);

        // --- Bold terrain: 3-octave mix (mountains/hills/detail) — Overhaul P1 ---
        const mountain = this.noise.noise2D(wx * 0.003, wz * 0.003); // long waves
        const hill = this.noise.fractal2D(wx * 0.008, wz * 0.008, 3, 0.5, 2.0); // medium
        const detailN = this.noise.noise2D(wx * 0.04, wz * 0.04); // fine detail
        const hRaw =
          this.baseHeight +
          blended.bias +
          (mountain * 1.6 + hill * 0.7 + detailN * 0.35) *
            this.amplitude *
            blended.scale;
        let h = Math.max(1, Math.min(CHUNK_HEIGHT - 3, Math.round(hRaw)));
        const seaLevel = this.seaLevel;

        // --- Rivers: low noise bands carve water channels (Overhaul P1) ---
        const riverVal = this.riverNoise.noise2D(wx * 0.02, wz * 0.02);
        const isRiver =
          riverVal < -0.34 && h > seaLevel - 2 && biome.name !== 'ocean';
        if (isRiver && h > seaLevel - 1) {
          h = seaLevel - 1; // carve the channel below sea level → fills with water
        }

        // --- Snow caps on high peaks (Overhaul P1) ---
        const snowyTop = h > seaLevel + 12;

        // --- column fill ---
        for (let y = 0; y <= Math.max(h, seaLevel); y++) {
          let id = 0;
          if (y === 0) {
            id = 8; // bedrock
          } else if (y <= h) {
            const caveHere = this.isCave(wx, y, wz);
            const roomHere = y > 2 && y < h - 1 && isBigRoom(this.roomNoise, wx, y, wz);
            if (y === h) {
              id = snowyTop ? 9 : biome.surfaceBlock; // snow cap overrides
              if (isRiver) id = 23; // gravel riverbeds
            } else if (y >= h - 3) {
              id = caveHere || roomHere ? 0 : isRiver ? 23 : biome.fillerBlock;
            } else {
              if (caveHere || roomHere) {
                id = 0;
              } else {
                id = 3; // stone
                const ore = pickOre(this.seed, wx, y, wz);
                if (ore !== null) id = ore;
              }
            }
          } else if (y <= seaLevel) {
            id = 5; // ocean/lake/river water
          }
          chunk.set(lx, y, lz, id);
        }

        // --- decorations (Overhaul P2) — deterministic per-column ---
        this.placeDecoration(chunk, lx, h, lz, biome.name, wx, wz, isRiver);

        // --- trees (deterministic per-column hash) ---
        if (
          biome.treeDensity > 0 &&
          h > seaLevel &&
          !snowyTop &&
          !isRiver &&
          !this.isCave(wx, h, wz)
        ) {
          const roll = hash2(this.seed ^ 0x7ee3, wx, wz) / 4294967296;
          if (roll < biome.treeDensity) this.placeTree(chunk, lx, h + 1, lz, wx, wz);
        }
      }
    }
  }

  /**
   * Surface decorations per biome — ferns/flowers/mushrooms in forests,
   * tall grass in plains, dead bushes in deserts, snow layers in tundra.
   */
  private placeDecoration(
    chunk: Chunk,
    lx: number,
    h: number,
    lz: number,
    biomeName: string,
    wx: number,
    wz: number,
    isRiver: boolean,
  ): void {
    if (isRiver || h <= this.seaLevel) return; // no decor in rivers/water
    const table: Array<{ block: number; chance: number }> | undefined =
      DECORATIONS[biomeName];
    if (!table || table.length === 0) return;
    const roll = hash2(this.seed ^ 0xdec0, wx, wz) / 4294967296;
    let acc = 0;
    for (const entry of table) {
      acc += entry.chance;
      if (roll < acc) {
        const y = h + 1;
        if (y < CHUNK_HEIGHT && chunk.get(lx, y, lz) === 0) {
          chunk.set(lx, y, lz, entry.block);
        }
        return;
      }
    }
  }

  /** Low-frequency climate field in [0,1]. */
  private climate(wx: number, wz: number, noise: PerlinNoise): number {
    // remap [-1,1] → [0,1] with very low frequency
    return (noise.noise2D(wx * 0.0018, wz * 0.0018) + 1) / 2;
  }

  /**
   * Cave test — "swiss cheese" via two 3D noise fields: a point is air when
   * both fields sit inside a band (tunnel-like intersections), scaled by
   * depth so caves get bigger deeper down and never touch the sky.
   */
  private isCave(wx: number, wy: number, wz: number): boolean {
    if (wy < 2 || wy > this.baseHeight + this.amplitude + 4) return false;
    const a = this.caveA.noise3D(wx * 0.055, wy * 0.075, wz * 0.055);
    const b = this.caveB.noise3D(wx * 0.055, wy * 0.075, wz * 0.055);
    // band width grows slightly with depth
    const depthFactor = 1 - wy / (CHUNK_HEIGHT * 1.2);
    const threshold = 0.088 + depthFactor * 0.03;
    return Math.abs(a) < threshold && Math.abs(b) < threshold;
  }

  /** Small oak-style tree: trunk 4-5, leaf blob. Fits within the chunk column. */
  private placeTree(chunk: Chunk, lx: number, baseY: number, lz: number, wx: number, wz: number): void {
    const trunkH = 4 + (hash2(this.seed ^ 0x11, wx, wz) % 2);
    if (baseY + trunkH + 2 >= CHUNK_HEIGHT) return;
    for (let i = 0; i < trunkH; i++) chunk.set(lx, baseY + i, lz, 6); // wood
    // canopy 3x3x2 + cap
    for (let dy = trunkH - 2; dy <= trunkH - 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0 && dy < trunkH) continue; // trunk
          chunk.set(lx + dx, baseY + dy, lz + dz, 7); // leaves
        }
      }
    }
    chunk.set(lx, baseY + trunkH, lz, 7);
    chunk.set(lx, baseY + trunkH + 1, lz, 7);
  }

  private applyEditsTo(chunk: Chunk): void {
    if (this.edits.size === 0) return;
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    for (const [key, id] of this.edits) {
      const [ex, ey, ez] = key.split(',').map(Number);
      if (ex >= ox && ex < ox + CHUNK_SIZE && ez >= oz && ez < oz + CHUNK_SIZE) {
        chunk.set(ex - ox, ey, ez - oz, id);
      }
    }
  }
}
