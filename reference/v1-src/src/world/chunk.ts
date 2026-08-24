import { BlockType } from './block';

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Y = 64;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_TOTAL = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;

export class Chunk {
  x: number;
  z: number;
  blocks: Uint8Array;
  generated = false;
  dirty = false;
  dirtyRevision = 0;

  constructor(x: number, z: number) {
    this.x = x;
    this.z = z;
    this.blocks = new Uint8Array(CHUNK_TOTAL);
  }

  getBlockIndex(localX: number, localY: number, localZ: number): number {
    return (localY * CHUNK_SIZE_X + localZ) * CHUNK_SIZE_X + localX;
  }

  getBlock(localX: number, localY: number, localZ: number): BlockType {
    if (
      localX < 0 || localX >= CHUNK_SIZE_X ||
      localY < 0 || localY >= CHUNK_SIZE_Y ||
      localZ < 0 || localZ >= CHUNK_SIZE_Z
    ) return BlockType.Air;
    return this.blocks[this.getBlockIndex(localX, localY, localZ)];
  }

  setBlock(localX: number, localY: number, localZ: number, type: BlockType) {
    if (
      localX < 0 || localX >= CHUNK_SIZE_X ||
      localY < 0 || localY >= CHUNK_SIZE_Y ||
      localZ < 0 || localZ >= CHUNK_SIZE_Z
    ) return;
    this.blocks[this.getBlockIndex(localX, localY, localZ)] = type;
    this.dirty = true;
    this.dirtyRevision++;
  }

  serialize(): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < this.blocks.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(this.blocks.subarray(i, i + chunkSize))
      );
    }
    return btoa(binary);
  }

  static deserialize(x: number, z: number, data: string): Chunk {
    const chunk = new Chunk(x, z);
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    chunk.blocks.set(bytes);
    chunk.generated = true;
    chunk.dirty = false;
    chunk.dirtyRevision = 0;
    return chunk;
  }
}