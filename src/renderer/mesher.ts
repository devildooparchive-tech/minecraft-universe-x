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

/**
 * Per-vertex ambient occlusion — the classic voxel AO (0fps.net algorithm).
 * For each face corner we inspect its two side neighbors + diagonal corner
 * neighbor in the plane of the face's normal. occluded count → brightness:
 *   0 sides → 1.0 · 1 → 0.8 · 2 (or corner rule) → 0.62 · 3 → 0.45
 * This is THE single biggest contributor to the "Minecraft look".
 *
 * faceNormal: outward axis. corner: [cx,cy,cz] in {0,1}³ local cube coords.
 * Returns multiplier in [0.45, 1].
 */
function vertexAO(
  world: MesherDeps['world'],
  wx: number,
  y: number,
  wz: number,
  dir: [number, number, number],
  corner: [number, number, number],
  registry: MesherDeps['registry'],
): number {
  const [dx, dy, dz] = dir;

  // offsets of the two side-neighbor cells and the diagonal cell for THIS corner
  let s1x = 0, s1y = 0, s1z = 0;
  let s2x = 0, s2y = 0, s2z = 0;
  let cxo = 0, cyo = 0, czo = 0;

  if (dy !== 0) {
    // tangent axes are X and Z
    const ox = corner[0] === 0 ? -1 : 1;
    const oz = corner[2] === 0 ? -1 : 1;
    s1x = ox; s2z = oz; cxo = ox; czo = oz;
  } else if (dx !== 0) {
    // tangent axes Y and Z
    const oy = corner[1] === 0 ? -1 : 1;
    const oz = corner[2] === 0 ? -1 : 1;
    s1y = oy; s2z = oz; cyo = oy; czo = oz;
  } else {
    // tangent axes X and Y
    const ox = corner[0] === 0 ? -1 : 1;
    const oy = corner[1] === 0 ? -1 : 1;
    s1x = ox; s2y = oy; cxo = ox; cyo = oy;
  }

  // sample one layer OUT along the normal from the block
  const nx = wx + dx;
  const ny = y + dy;
  const nz = wz + dz;

  const solidAt = (ax: number, ay: number, az: number): boolean => {
    const id = world.getBlock(ax, ay, az);
    if (id === 0) return false;
    const d = registry.byId(id);
    return d?.solid === true && d.transparent !== true;
  };

  const side1 = solidAt(nx + s1x, ny + s1y, nz + s1z);
  const side2 = solidAt(nx + s2x, ny + s2y, nz + s2z);
  const diag = solidAt(nx + cxo, ny + cyo, nz + czo);

  // classic AO rule: two opposing sides → darkest; else count occluders
  const level: number =
    side1 && side2 ? 3 : (side1 ? 1 : 0) + (side2 ? 1 : 0) + (diag ? 1 : 0);
  switch (level) {
    case 0: return 1.0;
    case 1: return 0.8;
    case 2: return 0.62;
    default: return 0.45;
  }
}

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
  /** translucent pass (water) — render with opacity, no face culling between cells */
  waterPositions: Float32Array;
  waterNormals: Float32Array;
  waterColors: Float32Array;
  waterIndices: Uint32Array;
  /** cross-billboard quads for plants (grass/flowers/mushrooms/cactus-free decor) */
  decorPositions: Float32Array;
  decorNormals: Float32Array;
  decorColors: Float32Array;
  decorIndices: Uint32Array;
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
  // water (translucent) buffers
  const wPos: number[] = [];
  const wNor: number[] = [];
  const wCol: number[] = [];
  const wIdx: number[] = [];
  // decoration cross-quads
  const dPos: number[] = [];
  const dNor: number[] = [];
  const dCol: number[] = [];
  const dIdx: number[] = [];

  const cache = new Map<number, BlockDef | undefined>();

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = chunk.get(lx, y, lz);
        if (id === 0) continue;
        const def = cache.get(id) ?? registry.byId(id);
        cache.set(id, def);
        if (!def) continue;

        const wx = ox + lx;
        const wz = oz + lz;

        // --- decorations: two crossed quads (X shape), full brightness ---
        if (def.solid === false && id >= 17 && id <= 22) {
          const rgb = hexToRgb(def.color);
          const x0 = wx + 0.15, x1 = wx + 0.85;
          const z0 = wz + 0.15, z1 = wz + 0.85;
          const yb = y, yt = y + 1;
          // quad A: diagonal plane
          let b0 = dPos.length / 3;
          dPos.push(x0, yb, z0, x1, yb, z1, x1, yt, z1, x0, yt, z0);
          for (let i = 0; i < 4; i++) {
            dNor.push(0, 1, 0);
            dCol.push(rgb[0], rgb[1], rgb[2]);
          }
          dIdx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
          // quad B: opposite diagonal (double-sided via material)
          b0 = dPos.length / 3;
          dPos.push(x1, yb, z0, x0, yb, z1, x0, yt, z1, x1, yt, z0);
          for (let i = 0; i < 4; i++) {
            dNor.push(0, 1, 0);
            dCol.push(rgb[0] * 0.9, rgb[1] * 0.9, rgb[2] * 0.9);
          }
          dIdx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
          continue;
        }

        if (def.solid === false && id !== 5) continue; // other non-solids unmeshed

        // --- WATER: top surface only (where above is air), translucent ---
        if (id === 5) {
          const above = world.getBlock(wx, y + 1, wz);
          if (above === 0 || (above !== 5 && registry.byId(above)?.solid === false)) {
            const rgb = hexToRgb(def.color);
            const base = wPos.length / 3;
            const yTop = y + 0.85; // slightly below block top — classic MC look
            wPos.push(wx, yTop, wz + 1, wx + 1, yTop, wz + 1, wx + 1, yTop, wz, wx, yTop, wz);
            for (let i = 0; i < 4; i++) {
              wNor.push(0, 1, 0);
              wCol.push(rgb[0], rgb[1], rgb[2]);
            }
            wIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
          continue;
        }

        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          // neighbor in world coords (crosses chunk borders correctly)
          const neighbor = world.getBlock(wx + dx, y + dy, wz + dz);
          const neighborDef = neighbor !== 0 ? registry.byId(neighbor) : undefined;
          if (neighborDef?.solid) continue; // hidden face

          const rgb = hexToRgb(def.color);
          const shade = FACE_SHADE[face.dir.join(',')] ?? 1;
          const base = positions.length / 3;

          for (const corner of face.corners) {
            const ao = vertexAO(world, wx, y, wz, face.dir, corner, registry);
            const b = shade * ao;
            positions.push(wx + corner[0], y + corner[1], wz + corner[2]);
            normals.push(dx, dy, dz);
            colors.push(rgb[0] * b, rgb[1] * b, rgb[2] * b);
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
    waterPositions: new Float32Array(wPos),
    waterNormals: new Float32Array(wNor),
    waterColors: new Float32Array(wCol),
    waterIndices: new Uint32Array(wIdx),
    decorPositions: new Float32Array(dPos),
    decorNormals: new Float32Array(dNor),
    decorColors: new Float32Array(dCol),
    decorIndices: new Uint32Array(dIdx),
  };
}
