/**
 * CraftingMatcher — data-driven recipe matching over the Inventory.
 *
 * A recipe is craftable when every input is covered by inventory counts.
 * `craft` consumes inputs and produces either block stacks (into the same
 * inventory) or named items (tracked in a simple items map).
 */

import type { Inventory } from '../player/inventory';

export interface RecipeInput {
  block: number;
  count: number;
}

export interface RecipeResult {
  block?: number;
  item?: string;
  count: number;
  attackBonus?: number;
}

export interface RecipeDef {
  id: string;
  nameAr: string;
  inputs: RecipeInput[];
  result: RecipeResult;
  station: 'hand' | 'crafting_table';
  conditions?: Record<string, unknown>;
}

export interface RecipesFile {
  version: string;
  recipes: RecipeDef[];
}

export class CraftingSystem {
  readonly recipes: RecipeDef[];
  private readonly craftedItems = new Map<string, number>();

  constructor(file: RecipesFile) {
    this.recipes = file.recipes;
  }

  /** Can this recipe be made with current inventory? */
  canCraft(recipe: RecipeDef, inv: Inventory): boolean {
    return recipe.inputs.every((input) => inv.countOf(input.block) >= input.count);
  }

  /** All craftable recipes right now. */
  available(inv: Inventory): RecipeDef[] {
    return this.recipes.filter((r) => this.canCraft(r, inv));
  }

  /**
   * Craft once (or up to `times`). Returns actual times crafted.
   * Block results go into the inventory; item results into craftedItems.
   */
  craft(
    recipeId: string,
    inv: Inventory,
    times = 1,
  ): number {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe) return 0;

    let made = 0;
    for (let i = 0; i < times; i++) {
      if (!this.canCraft(recipe, inv)) break;
      for (const input of recipe.inputs) {
        const removed = inv.remove(input.block, input.count);
        if (removed < input.count) break; // safety (shouldn't happen post-canCraft)
      }
      if (recipe.result.block !== undefined) {
        inv.add(recipe.result.block, recipe.result.count);
      } else if (recipe.result.item) {
        this.craftedItems.set(
          recipe.result.item,
          (this.craftedItems.get(recipe.result.item) ?? 0) + recipe.result.count,
        );
      }
      made++;
    }
    return made;
  }

  countOfItem(item: string): number {
    return this.craftedItems.get(item) ?? 0;
  }
}
