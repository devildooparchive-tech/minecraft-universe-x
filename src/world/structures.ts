/**
 * Structures — template-driven generation (houses, towers, ruins).
 *
 * Placement: deterministic hash per chunk; a chunk hosts at most one
 * structure attempt. The generator receives a placement callback so it
 * works on any block-writable surface (chunk or dimension).
 */

import { CHUNK_SIZE } from './chunk';
import { hash2 } from './noise3d';

export interface StructureBlockSpec {
  type: 'walls' | 'floor' | 'roof' | 'door' | 'windows' | 'pillar_ring' | 'top_platform' | 'beacon' | 'broken_columns';
  block: number;
  at?: [number, number, number];
  height?: number;
  y?: number;
  radius?: number;
  count?: number;
}

export interface StructureDef {
  id: string;
  size: [number, number, number];
  biomes: string[];
  rarity: number; // chance per eligible chunk
  blocks: StructureBlockSpec[];
}

export interface StructureFile {
  version: string;
  structures: StructureDef[];
}

export type BlockWriter = (x: number, y: number, z: number, id: number) => void;

export class StructureBuilder {
  readonly structures: StructureDef[];

  constructor(file: StructureFile) {
    this.structures = file.structures;
  }

  /**
   * Try to place a structure in this chunk. Returns the placed def or null.
   * `surfaceAt` gives terrain height for grounding; biome gates eligibility.
   */
  tryPlace(
    seed: number,
    cx: number,
    cz: number,
    biomeName: string,
    surfaceAt: (x: number, z: number) => number,
    setBlock: BlockWriter,
  ): StructureDef | null {
    const roll = hash2(seed ^ 0x57bc, cx, cz) / 4294967296;

    // one attempt per chunk: pick a deterministic structure candidate
    const eligible = this.structures.filter((s) => s.biomes.includes(biomeName));
    if (eligible.length === 0) return null;
    const pick = eligible[hash2(seed ^ 0x99aa, cx, cz) % eligible.length];
    if (roll >= pick.rarity) return null;

    // center-ish position inside the chunk, away from borders
    const margin = Math.max(pick.size[0], pick.size[2]) >> 1;
    const localX = margin + (hash2(seed ^ 0x31, cx, cz) % Math.max(1, CHUNK_SIZE - margin * 2));
    const localZ = margin + (hash2(seed ^ 0x77, cx, cz) % Math.max(1, CHUNK_SIZE - margin * 2));

    const groundY = surfaceAt(cx * CHUNK_SIZE + localX, cz * CHUNK_SIZE + localZ);
    this.build(pick, cx * CHUNK_SIZE + localX, groundY + 1, cz * CHUNK_SIZE + localZ, setBlock);
    return pick;
  }

  /** Build the structure at world coords (origin = door level). */
  private build(def: StructureDef, ox: number, oy: number, oz: number, set: BlockWriter): void {
    const [w, h, d] = def.size;
    for (const spec of def.blocks) {
      switch (spec.type) {
        case 'floor':
          for (let x = 0; x < w; x++)
            for (let z = 0; z < d; z++) set(ox + x, oy - 1, oz + z, spec.block);
          break;
        case 'walls':
          for (let y = 0; y < h - 1; y++) {
            for (let x = 0; x < w; x++) {
              set(ox + x, oy + y, oz, spec.block);
              set(ox + x, oy + y, oz + d - 1, spec.block);
            }
            for (let z = 0; z < d; z++) {
              set(ox, oy + y, oz + z, spec.block);
              set(ox + w - 1, oy + y, oz + z, spec.block);
            }
          }
          break;
        case 'roof':
          for (let x = 0; x < w; x++)
            for (let z = 0; z < d; z++) set(ox + x, oy + h - 1, oz + z, spec.block);
          break;
        case 'door': {
          const [dx, , dz] = spec.at ?? [Math.floor(w / 2), 0, 0];
          const dh = spec.height ?? 2;
          for (let y = 0; y < dh; y++) {
            set(ox + dx, oy + y, oz + dz, 0); // carve opening
            if (dz === 0 || dz === d - 1 ? true : false) { /* front/back only */ }
          }
          break;
        }
        case 'windows': {
          const wy = oy + (spec.y ?? 2);
          for (const wx of [1, w - 2]) {
            set(ox + wx, wy, oz, spec.block); // front windows (glowstone)
            set(ox + wx, wy, oz + d - 1, spec.block);
          }
          break;
        }
        case 'pillar_ring': {
          const r = spec.radius ?? 2;
          for (let i = 0; i < 4; i++) {
            const px = r * (i === 0 || i === 3 ? 1 : -1);
            const pz = r * (i < 2 ? 1 : -1);
            for (let y = 0; y < h; y++) set(ox + r + px, oy + y, oz + r + pz, spec.block);
          }
          break;
        }
        case 'top_platform':
          for (let x = 0; x < w; x++)
            for (let z = 0; z < d; z++) set(ox + x, oy + h - 1, oz + z, spec.block);
          break;
        case 'beacon':
          set(ox + Math.floor(w / 2), oy + h, oz + Math.floor(d / 2), spec.block);
          break;
        case 'broken_columns': {
          const count = spec.count ?? 4;
          for (let i = 0; i < count; i++) {
            const px = (i % 2) * (w - 1);
            const pz = Math.floor(i / 2) * (d - 1);
            const colH = 1 + ((hash2(ox + px, oz + pz, i * 7919) % Math.max(1, h))); // broken tops
            for (let y = 0; y < colH; y++) set(ox + px, oy + y, oz + pz, spec.block);
          }
          break;
        }
      }
    }
  }
}
