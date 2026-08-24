/**
 * Inventory — 36 slots (9 hotbar + 27 storage), stacks up to 64.
 *
 * Contract:
 *  - add() tops up existing stacks first (hotbar-first), then fills empty
 *    slots; returns the amount that did NOT fit.
 *  - remove() pulls from storage-end backwards (hotbar depletes last);
 *    returns what was actually removed.
 *  - takeSelected() touches ONLY the selected hotbar slot (placement path).
 */

export const HOTBAR_SIZE = 9;
export const TOTAL_SLOTS = 36;
export const MAX_STACK = 64;

export interface Slot {
  id: number;
  count: number;
}

export class Inventory {
  readonly slots: Array<Slot | null> = new Array<Slot | null>(TOTAL_SLOTS).fill(null);
  private _selected = 0;

  get selected(): number {
    return this._selected;
  }

  /** Select a hotbar slot (clamped to 0..8). */
  select(index: number): void {
    const i = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this._selected = i;
  }

  /** Add items; returns leftover that did not fit. */
  add(id: number, count = 1): number {
    if (count <= 0) return 0;
    let remaining = count;
    // 1) top up existing stacks (hotbar first)
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < MAX_STACK) {
        const take = Math.min(MAX_STACK - s.count, remaining);
        s.count += take;
        remaining -= take;
      }
    }
    // 2) fill empty slots
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(MAX_STACK, remaining);
        this.slots[i] = { id, count: take };
        remaining -= take;
      }
    }
    return remaining;
  }

  /** Remove up to `count` of id from any slot; returns actually-removed. */
  remove(id: number, count = 1): number {
    let toRemove = count;
    for (let i = TOTAL_SLOTS - 1; i >= 0 && toRemove > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, toRemove);
        s.count -= take;
        toRemove -= take;
        if (s.count === 0) this.slots[i] = null;
      }
    }
    return count - toRemove;
  }

  countOf(id: number): number {
    let total = 0;
    for (const s of this.slots) {
      if (s && s.id === id) total += s.count;
    }
    return total;
  }

  peekSelected(): Slot | null {
    return this.slots[this._selected];
  }

  /** Decrement the selected hotbar slot by up to `max`; returns taken {id,count} or null. */
  takeSelected(max = 1): { id: number; count: number } | null {
    const s = this.slots[this._selected];
    if (!s || s.count <= 0) return null;
    const take = Math.min(s.count, max);
    s.count -= take;
    if (s.count === 0) this.slots[this._selected] = null;
    return { id: s.id, count: take };
  }

  /** Serializable snapshot (JSON-safe). */
  export(): Array<Slot | null> {
    return this.slots.map((s) => (s ? { id: s.id, count: s.count } : null));
  }

  /** Restore from snapshot (length-clamped, entries validated). */
  import(data: Array<Slot | null>): void {
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = data[i];
      this.slots[i] =
        s && typeof s.id === 'number' && typeof s.count === 'number' && s.count > 0
          ? { id: s.id, count: Math.min(s.count, MAX_STACK) }
          : null;
    }
  }

  isEmpty(): boolean {
    return this.slots.every((s) => s === null);
  }
}
