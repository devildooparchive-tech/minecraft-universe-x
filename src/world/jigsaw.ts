/**
 * JigsawStructures — blueprint-driven multi-piece structures (Overhaul P5).
 *
 * A blueprint lists piece placements; pieces come from a shared library.
 * Same seed+chunk always assembles identically (deterministic), but the
 * blueprint CHOICE varies → villages look varied, never cloned.
 */

import { hash2 } from './noise3d';
import type { BlockWriter } from './structures';

export interface PieceDef {
  id: string;
  size: [number, number, number];
  block: number;
  solid: boolean;
}

export interface BlueprintStep {
  piece: string;
  at: [number, number, number];
  rotate?: number;
}

export interface BlueprintDef {
  id: string;
  biomes: string[];
  rarity: number;
  footprint: [number, number, number];
  steps: BlueprintStep[];
}

export interface StructuresV2File {
  version: string;
  pieces: PieceDef[];
  blueprints: BlueprintDef[];
}

export class JigsawBuilder {
  private readonly pieces = new Map<string, PieceDef>();
  readonly blueprints: BlueprintDef[];

  constructor(file: StructuresV2File) {
    for (const p of file.pieces) this.pieces.set(p.id, p);
    this.blueprints = file.blueprints;
  }

  /**
   * Try to place a blueprint in this chunk. Deterministic per (seed,cx,cz).
   * Returns the placed blueprint id or null.
   */
  tryPlace(
    seed: number,
    cx: number,
    cz: number,
    biomeName: string,
    surfaceAt: (x: number, z: number) => number,
    setBlock: BlockWriter,
  ): string | null {
    const eligible = this.blueprints.filter((b) => b.biomes.includes(biomeName));
    if (eligible.length === 0) return null;

    const pickRoll = hash2(seed ^ 0x51a5, cx, cz) / 4294967296;
    const bp = eligible[hash2(seed ^ 0x77aa, cx, cz) % eligible.length];
    if (pickRoll >= bp.rarity) return null;

    // position inside chunk with margin
    const marginX = Math.max(1, bp.footprint[0] >> 1);
    const marginZ = Math.max(1, bp.footprint[2] >> 1);
    const spanX = Math.max(1, 16 - marginX * 2);
    const localX = marginX + (hash2(seed ^ 0x11, cx, cz) % spanX);
    const localZ = marginZ + (hash2(seed ^ 0x22, cx, cz) % spanX);
    const groundY = surfaceAt(cx * 16 + localX, cz * 16 + localZ) + 1;
    const ox = cx * 16 + localX;
    const oz = cz * 16 + localZ;

    for (const step of bp.steps) {
      const piece = this.pieces.get(step.piece);
      if (!piece) continue;
      const [px, py, pz] = step.at;
      const [sx, sy, sz] = piece.size;
      for (let dy = 0; dy < sy; dy++) {
        for (let dz = 0; dz < sz; dz++) {
          for (let dx = 0; dx < sx; dx++) {
            setBlock(ox + px + dx, groundY + py + dy, oz + pz + dz, piece.block);
          }
        }
      }
    }
    return bp.id;
  }
}
