import { describe, it, expect } from 'vitest';
import {
  Inventory,
  TOTAL_SLOTS,
  MAX_STACK,
  HOTBAR_SIZE,
} from '../../src/player/inventory';

describe('Inventory', () => {
  it('add() stores items and countOf reflects them', () => {
    const inv = new Inventory();
    inv.add(3, 10);
    expect(inv.countOf(3)).toBe(10);
    expect(inv.slots[0]).toEqual({ id: 3, count: 10 });
  });

  it('stacks merge into one slot up to 64 then spill to the next', () => {
    const inv = new Inventory();
    inv.add(3, 60);
    inv.add(3, 10); // 60 + 10 → 64 in slot0, 6 in slot1
    expect(inv.slots[0]).toEqual({ id: 3, count: MAX_STACK });
    expect(inv.slots[1]).toEqual({ id: 3, count: 6 });
    expect(inv.countOf(3)).toBe(70);
  });

  it('capacity overflow returns the leftover that did not fit', () => {
    const inv = new Inventory();
    const capacity = TOTAL_SLOTS * MAX_STACK;
    expect(inv.add(1, capacity)).toBe(0); // exactly full
    const leftover = inv.add(1, 5);
    expect(leftover).toBe(5);
    expect(inv.add(2, 1)).toBe(1); // totally full: different id also rejected
  });

  it('remove() pulls across stacks and reports actual removed', () => {
    const inv = new Inventory();
    inv.add(3, 70); // 64 + 6
    expect(inv.remove(3, 10)).toBe(10);
    expect(inv.countOf(3)).toBe(60);
    expect(inv.remove(3, 1000)).toBe(60); // can't remove more than exists
    expect(inv.countOf(3)).toBe(0);
    expect(inv.isEmpty()).toBe(true);
  });

  it('remove empties slots completely (no zero-count ghosts)', () => {
    const inv = new Inventory();
    inv.add(3, 5);
    inv.remove(3, 5);
    expect(inv.slots[0]).toBeNull();
  });

  it('takeSelected() only touches the selected hotbar slot', () => {
    const inv = new Inventory();
    inv.add(3, 5); // slot 0
    inv.select(2);
    inv.slots[2] = { id: 4, count: 7 };
    const taken = inv.takeSelected(3);
    expect(taken).toEqual({ id: 4, count: 3 });
    expect(inv.countOf(3)).toBe(5); // untouched
    expect(inv.peekSelected()).toEqual({ id: 4, count: 4 });
    inv.select(0);
    expect(inv.takeSelected()).toEqual({ id: 3, count: 1 });
  });

  it('select() wraps within hotbar bounds', () => {
    const inv = new Inventory();
    inv.select(-1);
    expect(inv.selected).toBe(HOTBAR_SIZE - 1);
    inv.select(HOTBAR_SIZE + 1);
    expect(inv.selected).toBe(1); // 10 % 9 = 1
    inv.select(50);
    expect(inv.selected).toBe(5); // 50 % 9 = 5
  });

  it('export/import round-trips the full state', () => {
    const inv = new Inventory();
    inv.add(3, 64);
    inv.add(5, 3);
    const snap = inv.export();
    const inv2 = new Inventory();
    inv2.import(snap);
    expect(inv2.countOf(3)).toBe(64);
    expect(inv2.countOf(5)).toBe(3);
  });
});
