import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore, SaveManager, type SaveDataV1 } from '../../src/persistence/persistence';
import { World } from '../../src/world/world';

function sampleSave(): SaveDataV1 {
  return {
    version: 1,
    seed: 777,
    player: { x: 8.5, y: 30, z: 8.5, yaw: 0.5, pitch: -0.1 },
    edits: [
      { x: 1, y: 25, z: 1, id: 10 },
      { x: -3, y: 26, z: 4, id: 6 },
    ],
    savedAt: 1700000000000,
  };
}

describe('Persistence (X: save, Y: reload, Z: integrity)', () => {
  let mgr: SaveManager;

  beforeEach(() => {
    mgr = new SaveManager(new MemoryStore());
  });

  it('X: save then load returns identical data', async () => {
    const data = sampleSave();
    await mgr.save('slot1', data);
    const loaded = await mgr.load('slot1');
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe(777);
    expect(loaded!.player).toEqual(data.player);
    expect(loaded!.edits).toHaveLength(2);
  });

  it('Y: loading a missing slot returns null safely', async () => {
    expect(await mgr.load('never-saved')).toBeNull();
  });

  it('Z: loading corrupt/unknown-version data is refused', async () => {
    await mgr.save('bad', { version: 999 } as unknown as SaveDataV1);
    expect(await mgr.load('bad')).toBeNull();
  });

  it('round-trip: world edits survive save → fresh world → load', async () => {
    // One storage backend = one browser profile; SaveManager instances
    // are per-session, so a NEW manager over the SAME store = app restart.
    const store = new MemoryStore();
    const session1 = new SaveManager(store);

    // 1. play & edit
    const w1 = new World({ seed: 42 });
    w1.ensureChunk(0, 0);
    w1.setBlock(3, 30, 3, 11);
    const save: SaveDataV1 = {
      version: 1,
      seed: w1.seed,
      player: { x: 8.5, y: 30, z: 8.5, yaw: 0, pitch: 0 },
      edits: w1.exportEdits(),
      savedAt: Date.now(),
    };
    await session1.save('rt', save);

    // 2. app restart: new manager, same storage
    const session2 = new SaveManager(store);
    const loaded = await session2.load('rt');
    expect(loaded).not.toBeNull();

    // 3. rebuild world from save
    const w2 = new World({ seed: loaded!.seed });
    w2.importEdits(loaded!.edits);
    w2.ensureChunk(0, 0);
    expect(w2.getBlock(3, 30, 3)).toBe(11); // the edit survived
  });

  it('multiple slots are listed and deletable', async () => {
    await mgr.save('a', sampleSave());
    await mgr.save('b', sampleSave());
    expect(await mgr.listSlots()).toEqual(['a', 'b']);
    await mgr.deleteSlot('a');
    expect(await mgr.listSlots()).toEqual(['b']);
    expect(await mgr.load('a')).toBeNull();
  });

  it('save data is isolated per slot (no cross-contamination)', async () => {
    const a = sampleSave();
    const b = { ...sampleSave(), seed: 1 };
    await mgr.save('a', a);
    await mgr.save('b', b);
    const la = await mgr.load('a');
    expect(la!.seed).toBe(777);
  });
});
