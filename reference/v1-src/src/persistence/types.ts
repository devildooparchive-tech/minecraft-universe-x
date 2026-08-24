export interface ChunkData {
  x: number;
  z: number;
  data: string;
}

export interface PlayerData {
  position: { x: number; y: number; z: number };
  inventory: { type: number; count: number }[];
  selectedSlot: number;
}

export interface GameSaveData {
  version: number;
  generatorVersion: number;
  world: {
    seed: number;
    modifiedChunkKeys: string[];
  };
  player: PlayerData;
}

export interface WorldPersistence {
  loadGame(): Promise<GameSaveData | null>;
  saveGame(seed: number, playerData: PlayerData, modifiedKeys: string[]): Promise<void>;
  loadChunk(cx: number, cz: number): Promise<ChunkData | null>;
  saveChunks(chunks: ChunkData[]): Promise<void>;
  loadAllModifiedChunkKeys(): Promise<string[]>;
  close?: () => Promise<void>;
}