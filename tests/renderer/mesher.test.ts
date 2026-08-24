import { describe, it, expect } from 'vitest';
import { buildChunkMesh } from '../../src/renderer/mesher';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from '../../src/world/chunk';
import { World } from '../../src/world/world';
import { BlockRegistry } from '../../src/world/blocks';
import vanilla from '../../data/blocks/vanilla.json';

const reg = new BlockRegistry(vanilla as never);

describe('Mesher', () => {
  it('produces empty geometry for an all-air chunk', () => {
    const world = new World({ seed: 1 });
    const c = new Chunk(0, 0);
    const mesh = buildChunkMesh(c, { world, registry: reg });
    expect(mesh.indices.length).toBe(0);
    expect(mesh.positions.length).toBe(0);
  });

  it('a single block emits exactly 6 faces (24 verts, 36 indices)', () => {
    const world = new World({ seed: 1 });
    world.ensureChunk(0, 0);
    const c = world.getChunk(0, 0)!;
    // clear and place one block
    c.data.fill(0);
    c.set(8, 10, 8, 3); // stone
    const mesh = buildChunkMesh(c, { world, registry: reg });
    expect(mesh.indices.length / 6).toBe(6); // 6 quads
    expect(mesh.positions.length / 4 / 3).toBe(6); // 4 verts per quad
  });

  it('two adjacent blocks share a hidden face (culling works)', () => {
    const world = new World({ seed: 1 });
    world.ensureChunk(0, 0);
    const c = world.getChunk(0, 0)!;
    c.data.fill(0);
    c.set(8, 10, 8, 3);
    c.set(9, 10, 8, 3); // neighbor on +x
    const mesh = buildChunkMesh(c, { world, registry: reg });
    expect(mesh.indices.length / 6).toBe(10); // 12 faces - 2 hidden
  });

  it('cross-chunk neighbor faces are culled (border correctness)', () => {
    const world = new World({ seed: 1 });
    // chunk 0,0 with a block at local x=15 (world x=15)
    world.ensureChunk(0, 0);
    const c0 = world.getChunk(0, 0)!;
    c0.data.fill(0);
    c0.set(15, 10, 0, 3);
    // chunk 1,0 with a block at local x=0 (world x=16) — adjacent!
    world.ensureChunk(1, 0);
    const c1 = world.getChunk(1, 0)!;
    c1.data.fill(0);
    c1.set(0, 10, 0, 3);

    const mesh0 = buildChunkMesh(c0, { world, registry: reg });
    const mesh1 = buildChunkMesh(c1, { world, registry: reg });
    // each block alone has 6 faces; adjacent pair hides 2 (one per block)
    expect(mesh0.indices.length / 6).toBe(5);
    expect(mesh1.indices.length / 6).toBe(5);
  });

  it('terrain chunk produces a reasonable mesh (smoke test)', () => {
    const world = new World({ seed: 42 });
    world.ensureChunk(0, 0);
    const c = world.getChunk(0, 0)!;
    const mesh = buildChunkMesh(c, { world, registry: reg });
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.positions.length / 3).toBe(mesh.colors.length / 3);
    expect(mesh.positions.length / 3).toBe(mesh.normals.length / 3);
    // indices reference valid vertices
    const vertCount = mesh.positions.length / 3;
    for (let i = 0; i < mesh.indices.length; i++) {
      expect(mesh.indices[i]).toBeLessThan(vertCount);
    }
  });

  it('chunk dimensions constants are as expected', () => {
    expect(CHUNK_SIZE).toBe(16);
    expect(CHUNK_HEIGHT).toBe(64);
  });
});
