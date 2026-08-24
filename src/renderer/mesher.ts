/**
 * Mesher — converts chunk voxel data into renderable geometry.
 *
 * Strategy: face culling (emit a quad only where a solid block faces air).
 * Greedy meshing is the Phase-1 optimization once this is verified working.
 * Colors come from the block registry via vertex colors (single material).
 */

import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from '../world/chunk';
import type { World } from '../world/world';
import type { BlockRegistry, BlockDef } from '../world/blocks';

export interface MesherDeps {
  world: World;
  registry: BlockRegistry;
}

// Face definitions: [dir, corner offsets (4 verts, CCW from outside)]
interface FaceDef {
  dir: [number, number, number];
  corners: Array<[number, number, number]>;
}

const FACES: FaceDef[] = [
  // +X
  { dir: [1, 0, 0], corners: [[1, 1, 0], [1, 0, 0], [1, 0, 1], [1, 1, 1]] },
  // -X
  { dir: [-1, 0, 0], corners: [[0, 1, 1], [0, 0, 1], [0, 0, 0], [0, 1, 0]] },
  // +Y (top)
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  // -Y (bottom)
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  // +Z
  { dir: [0, 0, 1], corners: [[1, 1, 1], [1, 0, 1], [0, 0, 1], [0, 1, 1]] },
  // -Z
  { dir: [0, 0, -1], corners: [[0, 1, 0], [0, 0, 0], [1, 0, 0], [1, 1, 0]] },
];

/** Slightly shade faces by direction for fake ambient lighting. */
const FACE_SHADE: Record<string, number> = {
  '0,1,0': 1.0,
  '0,-1,0': 0.5,
  '1,0,0': 0.8,
  '-1,0,0': 0.8,
  '0,0,1': 0.65,
  '0,0,-1': 0.65,
};

function hexToRgb(hex: string | undefined): [number, number, number] {
  if (!hex) return [1, 0, 1]; // magenta = missing color (visible bug marker)
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

/** Build mesh data for one chunk. Neighbor lookups cross chunk borders via world. */
export function buildChunkMesh(chunk: Chunk, deps: MesherDeps): MeshData {
  const { world, registry } = deps;
  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const cache = new Map<number, BlockDef | undefined>();

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = chunk.get(lx, y, lz);
        if (id === 0) continue;
        const def = cache.get(id) ?? registry.byId(id);
        cache.set(id, def);
        if (!def || def.solid === false) continue; // liquids/air not meshed (Phase 5)

        const wx = ox + lx;
        const wz = oz + lz;

        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          // neighbor in world coords (crosses chunk borders correctly)
          const neighbor = world.getBlock(wx + dx, y + dy, wz + dz);
          const neighborDef = neighbor !== 0 ? registry.byId(neighbor) : undefined;
          if (neighborDef?.solid) continue; // hidden face

          const rgb = hexToRgb(def.color);
          const shade = FACE_SHADE[face.dir.join(',')] ?? 1;
          const base = positions.length / 3;

          for (const [cx, cy, cz] of face.corners) {
            positions.push(wx + cx, y + cy, wz + cz);
            normals.push(dx, dy, dz);
            colors.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade);
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  };
}
