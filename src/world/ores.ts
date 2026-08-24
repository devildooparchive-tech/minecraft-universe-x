/**
 * Ore & room generation — extends Phase-2 caves with:
 *  - Big rooms: low-frequency 3D noise < threshold carves spherical pockets.
 *  - Ores: depth-banded coal/iron/gold/diamond seeded by hash3.
 *
 * Block IDs (from data/blocks/vanilla.json + ore extension):
 *   12 coal_ore, 13 iron_ore, 14 gold_ore, 15 diamond_ore
 */

import { hash3 } from './noise3d';

export interface OreBand {
  blockId: number;
  minY: number;
  maxY: number;
  /** chance in percent per candidate stone cell */
  chancePercent: number;
}

export const ORE_IDS = { coal: 12, iron: 13, gold: 14, diamond: 15 };

export const DEFAULT_ORE_BANDS: OreBand[] = [
  { blockId: ORE_IDS.coal, minY: 5, maxY: 40, chancePercent: 1.2 },
  { blockId: ORE_IDS.iron, minY: 5, maxY: 30, chancePercent: 0.9 },
  { blockId: ORE_IDS.gold, minY: 2, maxY: 20, chancePercent: 0.45 },
  { blockId: ORE_IDS.diamond, minY: 1, maxY: 12, chancePercent: 0.22 },
];

/** Big-room test: separate very-low-frequency field. */
export function isBigRoom(
  roomNoise: { noise3D(x: number, y: number, z: number): number },
  wx: number,
  wy: number,
  wz: number,
): boolean {
  return roomNoise.noise3D(wx * 0.018, wy * 0.03, wz * 0.018) < -0.52;
}

/** Pick an ore for a stone cell adjacent to cave air (or inside rooms). */
export function pickOre(
  seed: number,
  x: number,
  y: number,
  z: number,
  bands: OreBand[] = DEFAULT_ORE_BANDS,
): number | null {
  for (const band of bands) {
    if (y >= band.minY && y <= band.maxY) {
      // hash → 0..9999; compare against chance scaled to that range
      const roll = hash3(seed ^ 0x04e5, x, y, z) % 10000;
      if (roll < band.chancePercent * 100) return band.blockId;
    }
  }
  return null;
}
