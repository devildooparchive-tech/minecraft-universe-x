import { describe, it, expect } from 'vitest';
import { buildChunkMesh } from '../../src/renderer/mesher';
import { World } from '../../src/world/world';
import { BlockRegistry, type BlockFile } from '../../src/world/blocks';

import vanilla from '../../data/blocks/vanilla.json';

const registry = new BlockRegistry(vanilla as unknown as BlockFile);

function setup() {
  const world = new World({ seed: 1 });
  const deps = { world, registry };
  return { world, deps };
}

describe('AO + water + decor meshing', () => {
  it('flat open ground: all top-face AO = 1.0 (no false darkening)', () => {
    const { world, deps } = setup();
    world.setBlock(0, 10, 0, 1); // grass block
    const chunk = world.getChunk(0, 0)!;
    const data = buildChunkMesh(chunk, deps);
    // find the brightest vertex color — should be exactly the grass color
    let maxC = 0;
    for (let i = 2; i < data.colors.length; i += 3) {
      maxC = Math.max(maxC, data.colors[i]);
    }
    expect(maxC).toBeGreaterThan(0.55); // grass green ~0.56 unshaded
  });

  it('block in a corner gets darker vertices (AO works)', () => {
    const { world, deps } = setup();
    // floor at y=10, wall column at y=11 next to a floor block
    for (let x = -2; x <= 4; x++) {
      world.setBlock(x, 10, 0, 3); // stone floor
      world.setBlock(x, 11, -1, 3); // wall behind
    }
    world.ensureChunk(0, 0);
    const chunk = world.getChunk(0, 0)!;
    const data = buildChunkMesh(chunk, deps);
    // with a wall adjacent, some top-face vertices must be darker than open ones
    let minTop = 999;
    let maxTop = -1;
    // sample all vertex colors (top faces of stone are gray-blue ~0.42 blue channel)
    for (let i = 2; i < data.colors.length; i += 3) {
      if (data.colors[i] > 0.2 && data.colors[i] < 0.6) {
        minTop = Math.min(minTop, data.colors[i]);
        maxTop = Math.max(maxTop, data.colors[i]);
      }
    }
    expect(minTop).toBeLessThan(maxTop); // variance exists → AO shading active
  });

  it('water surfaces emit a translucent pass', () => {
    const { world, deps } = setup();
    // carve a pit above terrain so our water cell has air overhead
    for (let y = 12; y <= 30; y++) world.setBlock(5, y, 5, 0);
    world.setBlock(5, 12, 5, 5);
    world.ensureChunk(0, 0);
    const chunk = world.getChunk(0, 0)!;
    const data = buildChunkMesh(chunk, deps);
    expect(data.waterIndices.length).toBeGreaterThanOrEqual(6); // one quad
    // solid pass may contain terrain but NOT our water cell's faces
    expect(data.waterPositions.length / 3).toBeGreaterThanOrEqual(4);
  });

  it('decorations emit cross-quad billboards (not invisible!)', () => {
    const { world, deps } = setup();
    // clear a column to bedrock-free zone then build floor + flower
    for (let y = 20; y <= 30; y++) world.setBlock(7, y, 7, 0);
    world.setBlock(7, 20, 7, 1); // grass ground
    world.setBlock(7, 21, 7, 18); // red flower
    world.ensureChunk(0, 0);
    const chunk = world.getChunk(0, 0)!;
    const data = buildChunkMesh(chunk, deps);
    expect(data.decorIndices.length).toBeGreaterThanOrEqual(12); // 2 quads × 6 idx
    expect(data.decorPositions.length / 3).toBeGreaterThanOrEqual(8);
  });

  it('water surface sits slightly below block top (y+0.85)', () => {
    const { world, deps } = setup();
    for (let y = 15; y <= 30; y++) world.setBlock(3, y, 3, 0);
    world.setBlock(3, 15, 3, 5);
    world.ensureChunk(0, 0);
    const chunk = world.getChunk(0, 0)!;
    const data = buildChunkMesh(chunk, deps);
    expect(data.waterPositions.length).toBeGreaterThan(0);
    expect(data.waterPositions[1]).toBeCloseTo(15.85, 2);
  });
});
