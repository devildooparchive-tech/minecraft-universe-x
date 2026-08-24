import { describe, it, expect, vi } from 'vitest';
import { BlockInteraction } from '../../src/player/block-interaction';
import { World } from '../../src/world/world';
import { BlockRegistry, type BlockFile } from '../../src/world/blocks';
import { Inventory } from '../../src/player/inventory';
import { EventBus } from '../../src/core/events';
import vanilla from '../../data/blocks/vanilla.json';

function setup() {
  const world = new World({ seed: 99 });
  world.ensureChunk(0, 0);
  const registry = new BlockRegistry(vanilla as unknown as BlockFile);
  const inventory = new Inventory();
  const events = new EventBus();
  const bi = new BlockInteraction({ world, registry, inventory, events });
  return { world, registry, inventory, events, bi };
}

describe('Block breaking (mining)', () => {
  it('dirt (hardness 0.5) breaks after 0.5s of mining and enters inventory', () => {
    const { world, inventory, events, bi } = setup();
    world.setBlock(2, 30, 2, 2); // dirt
    const brokenSpy = vi.fn();
    events.on('block:break', brokenSpy);

    bi.startMining(2, 30, 2);
    bi.tickMining(0.25);
    expect(world.getBlock(2, 30, 2)).toBe(2); // not yet
    bi.tickMining(0.25); // total 0.5s
    expect(world.getBlock(2, 30, 2)).toBe(0); // gone
    expect(inventory.countOf(2)).toBe(1); // in inventory
    expect(brokenSpy).toHaveBeenCalledWith({ x: 2, y: 30, z: 2, id: 2 });
  });

  it('stone takes longer than dirt (1.5s vs 0.5s)', () => {
    const { world, bi } = setup();
    world.setBlock(4, 30, 4, 3); // stone hardness 1.5
    bi.startMining(4, 30, 4);
    bi.tickMining(0.6); // would break dirt already
    expect(world.getBlock(4, 30, 4)).toBe(3);
    bi.tickMining(0.9); // total 1.5
    expect(world.getBlock(4, 30, 4)).toBe(0);
  });

  it('bedrock is unbreakable no matter how long you mine', () => {
    const { world, bi } = setup();
    world.setBlock(5, 30, 5, 8); // bedrock hardness -1
    bi.startMining(5, 30, 5);
    expect(bi.miningTarget).toBeNull(); // refused to start
    bi.tickMining(100);
    expect(world.getBlock(5, 30, 5)).toBe(8);
  });

  it('switching targets resets progress', () => {
    const { world, bi } = setup();
    world.setBlock(1, 30, 1, 2);
    world.setBlock(2, 30, 2, 2);
    bi.startMining(1, 30, 1);
    bi.tickMining(0.49);
    bi.startMining(2, 30, 2); // retarget
    expect(bi.miningProgress).toBe(0);
    bi.tickMining(0.1);
    expect(world.getBlock(1, 30, 1)).toBe(2); // first block untouched
  });

  it('mining air is a safe no-op', () => {
    const { bi } = setup();
    bi.startMining(999, 999, 999);
    expect(bi.miningTarget).toBeNull();
    expect(() => bi.tickMining(1)).not.toThrow();
  });
});

describe('Block placing', () => {
  it('places selected item into empty space and decrements inventory', () => {
    const { world, inventory, events, bi } = setup();
    inventory.add(3, 5); // 5 stone
    inventory.select(0);
    const placedSpy = vi.fn();
    events.on('block:place', placedSpy);

    const ok = bi.placeSelected(7, 40, 7);
    expect(ok).toBe(true);
    expect(world.getBlock(7, 40, 7)).toBe(3);
    expect(inventory.countOf(3)).toBe(4);
    expect(placedSpy).toHaveBeenCalledWith({ x: 7, y: 40, z: 7, id: 3 });
  });

  it('refuses placement into an occupied cell (item stays)', () => {
    const { world, inventory, bi } = setup();
    world.setBlock(8, 40, 8, 3);
    inventory.add(6, 2);
    expect(bi.placeSelected(8, 40, 8)).toBe(false);
    expect(inventory.countOf(6)).toBe(2);
    expect(world.getBlock(8, 40, 8)).toBe(3);
  });

  it('empty hand places nothing', () => {
    const { bi } = setup();
    expect(bi.placeSelected(9, 40, 9)).toBe(false);
  });
});

describe('Full loop: mine → inventory → place', () => {
  it('break a block then place the very same block elsewhere', () => {
    const { world, inventory, bi } = setup();
    world.setBlock(10, 30, 10, 6); // wood
    inventory.select(0);

    // mine it (hardness 1.0)
    bi.startMining(10, 30, 10);
    for (let i = 0; i < 10; i++) bi.tickMining(0.1);
    expect(world.getBlock(10, 30, 10)).toBe(0);
    expect(inventory.countOf(6)).toBe(1);

    // now place it somewhere else
    const ok = bi.placeSelected(12, 35, 12);
    expect(ok).toBe(true);
    expect(world.getBlock(12, 35, 12)).toBe(6);
    expect(inventory.isEmpty()).toBe(true);
  });
});
