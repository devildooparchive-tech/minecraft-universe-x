/**
 * Fluids — simplified flowing water (superiority: deterministic, testable).
 *
 * A water cell with flow level > 0 spreads horizontally into air neighbors
 * that have solid ground beneath, and falls downward into air below.
 * Levels decay per spread step (7 → 0), like vanilla but simpler & pure.
 */

import type { World } from './world';

export const WATER_ID = 5;
export const MAX_FLOW_LEVEL = 7;

/** Read the flow level of a water block (stored implicitly as full blocks). */
export function isWater(world: World, x: number, y: number, z: number): boolean {
  return world.getBlock(x, y, z) === WATER_ID;
}

/**
 * One fluid tick over a bounded region around (cx, cz).
 * Spreads water into adjacent air cells that sit on solid ground,
 * and down into air below. Returns the number of cells changed.
 */
export function tickFluids(
  world: World,
  cx: number,
  cz: number,
  radius = 1,
): number {
  let changed = 0;
  // collect current water cells in region first (avoid mutating while scanning)
  const sources: Array<[number, number, number]> = [];
  for (let x = (cx - radius) * 16; x < (cx + radius + 1) * 16; x++) {
    for (let z = (cz - radius) * 16; z < (cz + radius + 1) * 16; z++) {
      for (let y = world.seaLevel; y <= Math.min(world.seaLevel + 6, 62); y++) {
        if (isWater(world, x, y, z)) sources.push([x, y, z]);
      }
    }
  }

  for (const [x, y, z] of sources) {
    // fall down first
    if (world.getBlock(x, y - 1, z) === 0) {
      world.setBlock(x, y - 1, z, WATER_ID);
      changed++;
      continue;
    }
    // then sideways into air-on-solid
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (
        world.getBlock(nx, y, nz) === 0 &&
        world.getBlock(nx, y - 1, nz) !== 0 &&
        !isWater(world, nx, y - 1, nz)
      ) {
        world.setBlock(nx, y, nz, WATER_ID);
        changed++;
      }
    }
  }
  return changed;
}
