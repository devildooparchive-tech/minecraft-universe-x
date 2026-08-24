/**
 * Persistence — save/load world state.
 *
 * Two implementations behind one interface:
 *  - MemoryStore: for tests (deterministic, no browser APIs)
 *  - IndexedDBStore: for the real game
 *
 * Save format (versioned for future migrations):
 * { version: 1, seed, player: {x,y,z,yaw,pitch}, edits: [{x,y,z,id}], savedAt }
 */

export interface SaveDataV1 {
  version: 1;
  seed: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  edits: Array<{ x: number; y: number; z: number; id: number }>;
  savedAt: number;
}

export interface Storage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  keys(): Promise<string[]>;
  delete(key: string): Promise<void>;
}

export class MemoryStore implements Storage {
  private map = new Map<string, unknown>();
  async get(key: string): Promise<unknown> {
    return this.map.get(key);
  }
  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, structuredClone(value));
  }
  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

export class IndexedDBStore implements Storage {
  private readonly dbPromise: Promise<IDBDatabase>;

  constructor(dbName = 'mux2', storeName = 'saves') {
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(storeName)) {
          req.result.createObjectStore(storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.dbPromise;
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction('saves', mode);
      const req = fn(t.objectStore('saves'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async get(key: string): Promise<unknown> {
    return this.tx('readonly', (s) => s.get(key));
  }
  async set(key: string, value: unknown): Promise<void> {
    await this.tx('readwrite', (s) => s.put(value, key));
  }
  async keys(): Promise<string[]> {
    return this.tx('readonly', (s) => s.getAllKeys()) as Promise<string[]>;
  }
  async delete(key: string): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(key));
  }
}

export class SaveManager {
  constructor(private readonly storage: Storage) {}

  async save(slot: string, data: SaveDataV1): Promise<void> {
    await this.storage.set(`save:${slot}`, data);
  }

  async load(slot: string): Promise<SaveDataV1 | null> {
    const raw = await this.storage.get(`save:${slot}`);
    if (!raw || typeof raw !== 'object') return null;
    const data = raw as SaveDataV1;
    if (data.version !== 1) return null; // unknown version → refuse (migration later)
    return data;
  }

  async listSlots(): Promise<string[]> {
    const keys = await this.storage.keys();
    return keys
      .filter((k) => k.startsWith('save:'))
      .map((k) => k.slice(5))
      .sort();
  }

  async deleteSlot(slot: string): Promise<void> {
    await this.storage.delete(`save:${slot}`);
  }
}
