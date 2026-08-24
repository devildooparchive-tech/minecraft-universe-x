/**
 * BlockInteraction — mining (break) & placing, driven by hardness data.
 *
 * Mining contract:
 *  - startMining(x,y,z) begins progress; tickMining(dt) accumulates.
 *  - Progress completes after hardness seconds (bedrock hardness<0 = unbreakable).
 *  - On completion: world.setBlock(...,0) + emit 'block:break' {x,y,z,id}.
 *  - Moving off the target or releasing cancels.
 *
 * Place contract:
 *  - placeSelected(x,y,z): takes from inventory selected slot, writes world,
 *    emits 'block:place'. Fails safely on empty slot / occupied target.
 */

import type { World } from '../world/world';
import type { BlockRegistry } from '../world/blocks';
import type { Inventory } from './inventory';
import type { EventBus } from '../core/events';

export interface BlockInteractionDeps {
  world: World;
  registry: BlockRegistry;
  inventory: Inventory;
  events: EventBus;
}

export class BlockInteraction {
  private readonly deps: BlockInteractionDeps;
  private target: { x: number; y: number; z: number } | null = null;
  private progress = 0;
  private hardness = Infinity;

  constructor(deps: BlockInteractionDeps) {
    this.deps = deps;
  }

  get miningProgress(): number {
    return this.target ? Math.min(1, this.progress / this.hardness) : 0;
  }

  get miningTarget(): { x: number; y: number; z: number } | null {
    return this.target;
  }

  /** Begin/retarget mining. No-op for air. */
  startMining(x: number, y: number, z: number): void {
    const id = this.deps.world.getBlock(x, y, z);
    if (id === 0) {
      this.cancel();
      return;
    }
    const def = this.deps.registry.byId(id);
    const hard = def?.hardness ?? 1;
    if (hard < 0) {
      // unbreakable (bedrock)
      this.cancel();
      return;
    }
    if (
      !this.target ||
      this.target.x !== x ||
      this.target.y !== y ||
      this.target.z !== z
    ) {
      this.target = { x, y, z };
      this.progress = 0;
      this.hardness = hard > 0 ? hard : 0.25; // missing hardness → default snap
    }
  }

  /** Advance mining by dt seconds. Emits block:break when finished.
   *  Epsilon guards float accumulation (0.1*10 !== 1.0 exactly). */
  tickMining(dt: number): void {
    if (!this.target) return;
    this.progress += dt;
    if (this.progress >= this.hardness - 1e-9) {
      const { x, y, z } = this.target;
      const id = this.deps.world.getBlock(x, y, z);
      if (id !== 0) {
        this.deps.world.setBlock(x, y, z, 0);
        this.deps.inventory.add(id, 1);
        this.deps.events.emit('block:break', { x, y, z, id });
      }
      this.cancel();
    }
  }

  cancel(): void {
    this.target = null;
    this.progress = 0;
    this.hardness = Infinity;
  }

  /**
   * Place the selected hotbar item at (x,y,z).
   * Returns true when a block was placed.
   */
  placeSelected(x: number, y: number, z: number): boolean {
    if (this.deps.world.getBlock(x, y, z) !== 0) return false; // occupied
    const taken = this.deps.inventory.takeSelected(1);
    if (!taken) return false; // empty hand
    this.deps.world.setBlock(x, y, z, taken.id);
    this.deps.events.emit('block:place', { x, y, z, id: taken.id });
    return true;
  }
}
