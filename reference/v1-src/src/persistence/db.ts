import { WorldPersistence, ChunkData, PlayerData, GameSaveData } from './types';

const SAVE_VERSION = 1;
const GENERATOR_VERSION = 1;

export class SaveManager implements WorldPersistence {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private dbName = 'minecraft-universe';
  private gameStore = 'game';
  private chunkStore = 'chunks';

  private openDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.gameStore)) {
            db.createObjectStore(this.gameStore, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(this.chunkStore)) {
            db.createObjectStore(this.chunkStore, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  private async getStore(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDB();
    const tx = db.transaction(name, mode);
    return tx.objectStore(name);
  }

  async loadGame(): Promise<GameSaveData | null> {
    const store = await this.getStore(this.gameStore, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get('current');
      req.onsuccess = () => resolve(req.result ? (req.result.data as GameSaveData) : null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveGame(seed: number, playerData: PlayerData, modifiedKeys: string[]): Promise<void> {
    const store = await this.getStore(this.gameStore, 'readwrite');
    const snapshot: GameSaveData = {
      version: SAVE_VERSION,
      generatorVersion: GENERATOR_VERSION,
      world: { seed, modifiedChunkKeys: modifiedKeys },
      player: playerData,
    };
    return new Promise((resolve, reject) => {
      const req = store.put({ id: 'current', data: snapshot });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async loadChunk(cx: number, cz: number): Promise<ChunkData | null> {
    const store = await this.getStore(this.chunkStore, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(`${cx},${cz}`);
      req.onsuccess = () => resolve(req.result ? (req.result.data as ChunkData) : null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveChunks(chunks: ChunkData[]): Promise<void> {
    if (chunks.length === 0) return;
    const db = await this.openDB();
    const tx = db.transaction(this.chunkStore, 'readwrite');
    const store = tx.objectStore(this.chunkStore);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      for (const chunk of chunks) {
        store.put({ key: `${chunk.x},${chunk.z}`, data: chunk });
      }
    });
  }

  async loadAllModifiedChunkKeys(): Promise<string[]> {
    const store = await this.getStore(this.chunkStore, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  }

  async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }
}