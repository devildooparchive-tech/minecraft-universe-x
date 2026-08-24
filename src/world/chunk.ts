/**
 * Chunk — a 16×64×16 column of blocks stored in a flat Uint8Array.
 *
 * Memory: 16*64*16 = 16,384 bytes per chunk (16 KB).
 * Index layout: (y * CHUNK_SIZE + z) * CHUNK_SIZE + x — y-major so
 * horizontal scans (meshing) walk contiguous memory per layer.
 */

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;

const AREA = CHUNK_SIZE * CHUNK_SIZE; // 256

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly data: Uint8Array;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  /** Local coordinates only (0..15, 0..63, 0..15). Out of bounds → air/ignore. */
  get(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    return this.data[y * AREA + z * CHUNK_SIZE + x];
  }

  set(x: number, y: number, z: number, id: number): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    this.data[y * AREA + z * CHUNK_SIZE + x] = id;
  }

  /** Number of non-air blocks (cheap dirty metric for tests/telemetry). */
  solidCount(): number {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== 0) n++;
    }
    return n;
  }
}
