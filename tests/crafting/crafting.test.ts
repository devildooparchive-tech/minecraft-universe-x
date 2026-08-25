import { describe, it, expect, beforeEach } from 'vitest';
import { CraftingSystem, type RecipesFile } from '../../src/crafting/CraftingSystem';
import { Inventory } from '../../src/player/inventory';
import recipesJson from '../../data/crafting/recipes.json';

function makeInv(items: Array<[number, number]>): Inventory {
  const inv = new Inventory();
  for (const [id, count] of items) inv.add(id, count);
  return inv;
}

describe('P7: Adaptive crafting', () => {
  let sys: CraftingSystem;

  beforeEach(() => {
    // fresh instance per test — craftedItems must not leak between tests
    sys = new CraftingSystem(recipesJson as unknown as RecipesFile);
  });

  it('loads recipes from JSON', () => {
    expect(sys.recipes.length).toBeGreaterThanOrEqual(7);
  });

  it('recipe unavailable when inputs missing, available when covered', () => {
    const empty = new Inventory();
    expect(sys.available(empty)).toHaveLength(0);
    const withWood = makeInv([[6, 1]]); // 1 wood
    const avail = sys.available(withWood).map((r) => r.id);
    expect(avail).toContain('planks'); // 1 wood → planks
    expect(avail).not.toContain('wooden_pickaxe'); // needs 3 wood
  });

  it('craft consumes inputs and produces outputs (planks: 1 wood → 4 planks)', () => {
    const inv = makeInv([[6, 2]]);
    const made = sys.craft('planks', inv);
    expect(made).toBe(1);
    expect(inv.countOf(6)).toBe(1); // spent one wood
    expect(sys.countOfItem('planks')).toBe(4); // produced 4 plank items
  });

  it('craft-all makes the maximum possible count', () => {
    const inv = makeInv([[6, 10]]); // stick costs 1 wood each → 10 crafts
    const made = sys.craft('stick', inv, 999);
    expect(made).toBe(10);
    expect(sys.countOfItem('stick')).toBe(40); // 10 × 4
  });

  it('full progression: wood → table → pickaxe → stone pickaxe gated', () => {
    const inv = makeInv([
      [6, 8], // wood
      [3, 6], // stone
    ]);
    // craft table (4 wood)
    expect(sys.craft('crafting_table', inv, 1)).toBe(1);
    expect(sys.countOfItem('crafting_table')).toBe(1);
    // wooden pickaxe needs 3 wood — we have 8-4=4 left ✓
    expect(sys.craft('wooden_pickaxe', inv, 1)).toBe(1);

    // stone pickaxe requires crafting_table item + 3 stone:
    const recipe = sys.recipes.find((r) => r.id === 'stone_pickaxe')!;
    expect(recipe.conditions?.requiresItem).toBe('crafting_table');
    const canMake = recipe.inputs.every((i) => inv.countOf(i.block) >= i.count);
    expect(canMake).toBe(true); // 6 stone ≥ 3

    const crafted = sys.craft('stone_pickaxe', inv, 1);
    expect(crafted).toBe(1);
    expect(sys.countOfItem('stone_pickaxe')).toBe(1);
    expect(inv.countOf(3)).toBe(3); // 6-3
  });

  it('craft stops early when materials run out mid-batch', () => {
    const inv = makeInv([[6, 5]]); // stick costs 1 wood → 5 crafts possible
    const made = sys.craft('stick', inv, 100);
    expect(made).toBe(5); // exactly what materials allowed
    expect(inv.countOf(6)).toBe(0); // wood fully consumed
    expect(sys.countOfItem('stick')).toBe(20); // 5 × 4
  });
});
