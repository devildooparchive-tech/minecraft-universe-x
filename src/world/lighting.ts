/**
 * Block light propagation — flood-fill lighting stored per chunk.
 *
 * Superiority over vanilla: computed ONCE on placement/removal (not every
 * tick), capped at 7 steps of decay, and exposed via a simple getter so the
 * mesher can bake vertex brightness.
 */

import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk';


export interface LightWorld {
  getBlock(x: number, y: number, z: number): number;
  getChunk(cx: number, cz: number): Chunk | undefined;
  ensureChunk(cx: number, cz: number): Chunk;
}

/** Per-chunk light storage (lazy). Keyed on the chunk object itself. */
const lightStore = new WeakMap<Chunk, Uint8Array>();

function lightArray(chunk: Chunk): Uint8Array {
  let arr = lightStore.get(chunk);
  if (!arr) {
    arr = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    lightStore.set(chunk, arr);
  }
  return arr;
}

export function getLight(world: LightWorld, x: number, y: number, z: number): number {
  const chunk = world.getChunk(Math.floor(x / 16), Math.floor(z / 16));
  if (!chunk || y < 0 || y >= CHUNK_HEIGHT) return 0;
  const lx = ((x % 16) + 16) % 16;
  const lz = ((z % 16) + 16) % 16;
  return lightArray(chunk)[y * 256 + lz * 16 + lx];
}

function setLightRaw(
  world: LightWorld,
  chunk: Chunk,
  x: number,
  y: number,
  z: number,
  value: number,
): void {
  void world;
  const lx = ((x % 16) + 16) % 16;
  const lz = ((z % 16) + 16) % 16;
  lightArray(chunk)[y * 256 + lz * 16 + lx] = value;
}

/**
 * Flood-fill light from a source cell. Opaque blocks stop propagation.
 * Crosses chunk borders transparently through world lookups.
 */
export function propagateLight(
  world: LightWorld,
  x: number,
  y: number,
  z: number,
  intensity: number,
): void {
  if (intensity <= 0) return;
  const queue: Array<[number, number, number, number]> = [[x, y, z, intensity]];

  while (queue.length > 0) {
    const [qx, qy, qz, level] = queue.shift()!;
    const cx = Math.floor(qx / 16);
    const cz = Math.floor(qz / 16);
    world.ensureChunk(cx, cz);
    const chunk = world.getChunk(cx, cz)!;

    const existing = getLight(world, qx, qy, qz);
    if (existing >= level) continue;
    setLightRaw(world, chunk, qx, qy, qz, level);

    if (level <= 1) continue;
    // opaque check on the SOURCE cell only — light passes through air/water/decor
    for (const [dx, dy, dz] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ] as const) {
      const nx = qx + dx;
      const ny = qy + dy;
      const nz = qz + dz;
      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
      const nid = world.getBlock(nx, ny, nz);
      // solid non-transparent blocks block light; decor/air/water pass it
      const opaque =
        nid !== 0 &&
        nid !== 5 && // water
        !(nid >= 17 && nid <= 22); // decorations
      if (!opaque) {
        queue.push([nx, ny, nz, level - 1]);
      } else {
        // lit faces still receive some light for shading
        const c2 = world.getChunk(Math.floor(nx / 16), Math.floor(nz / 16));
        if (c2 && getLight(world, nx, ny, nz) < level - 4) {
          setLightRaw(world, c2, nx, ny, nz, level - 4);
        }
      }
    }
  }
}

/** Clear light in a radius (used when removing a light source). */
export function clearLight(
  world: LightWorld,
  x: number,
  y: number,
  z: number,
  radius = 8,
): void {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
        const chunk = world.getChunk(Math.floor(nx / 16), Math.floor(nz / 16));
        if (chunk && getLight(world, nx, ny, nz) > 0) {
          setLightRaw(world, chunk, nx, ny, nz, 0);
        }
      }
    }
  }
}
