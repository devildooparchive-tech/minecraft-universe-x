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

export interface WorldOptions {
  seed?: number;
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

  constructor(options: WorldOptions = {}) {
    this.seed = options.seed ?? 1337;
    this.baseHeight = options.baseHeight ?? 24;
    this.amplitude = options.amplitude ?? 12;
    this.noise = new PerlinNoise(this.seed);
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
        // Height from fractal noise, deterministic per (seed, wx, wz)
        const h = this.terrainHeight(wx, wz);
        for (let y = 0; y <= h; y++) {
          let id: number;
          if (y === 0) id = 8; // bedrock
          else if (y === h) id = h < 20 ? 4 : 1; // sand low / grass high
          else if (y >= h - 3) id = 2; // dirt
          else id = 3; // stone
          chunk.set(lx, y, lz, id);
        }
      }
    }
  }

  private terrainHeight(wx: number, wz: number): number {
    const n = this.noise.fractal2D(wx * 0.01, wz * 0.01, 4, 0.5, 2.0); // [-1,1]
    const detail = this.noise.noise2D(wx * 0.05, wz * 0.05) * 2;
    return Math.max(1, Math.min(CHUNK_HEIGHT - 2, Math.round(this.baseHeight + n * this.amplitude + detail)));
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
