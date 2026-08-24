import * as THREE from 'three';
import { Chunk, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './chunk';
import { BlockType } from './block';
import { BiomeType, DimensionType } from './biomes';

export interface CaveCarver {
  carve(chunk: Chunk, noise: any, dimension: DimensionType): void;
}

export class CaveGenerator {
  private noise: any;
  private carvers: CaveCarver[] = [];

  constructor(seed: number) {
    this.noise = new SimplexNoise(seed + 200);
    this.registerCarvers();
  }

  private registerCarvers(): void {
    this.carvers.push(new NoodleCaveCarver());
    this.carvers.push(new CheeseCaveCarver());
    this.carvers.push(new AquiferCarver());
    this.carvers.push(new CanyonCarver());
    this.carvers.push(new TunnelCarver());
  }

  generateInChunk(chunk: Chunk, dimension: DimensionType): void {
    for (const carver of this.carvers) {
      carver.carve(chunk, this.noise, dimension);
    }
  }
}

class NoodleCaveCarver implements CaveCarver {
  carve(chunk: Chunk, noise: any, dimension: DimensionType): void {
    const cx = chunk.x;
    const cz = chunk.z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = cx * CHUNK_SIZE_X + lx;
        const worldZ = cz * CHUNK_SIZE_Z + lz;

        const noodleNoise = noise.fractalNoise3D(worldX * 0.05, 0, worldZ * 0.05, 2, 0.5, 1);
        
        if (noodleNoise > 0.85) {
          const startY = Math.floor(noise.noise2D(worldX * 0.01, worldZ * 0.01) * 20) + 30;
          
          for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
            const worldY = ly;
            const distFromCenter = Math.abs(worldY - startY);
            
            if (distFromCenter > 4) continue;
            
            const thickness = 2 - distFromCenter * 0.4;
            const caveNoise = noise.noise3D(worldX * 0.1, worldY * 0.1, worldZ * 0.1);
            
            if (caveNoise > 0.7 - distFromCenter * 0.1) {
              for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                  const nx = lx + dx;
                  const nz = lz + dz;
                  if (nx >= 0 && nx < CHUNK_SIZE_X && nz >= 0 && nz < CHUNK_SIZE_Z) {
                    const current = chunk.getBlock(nx, worldY, nz);
                    if (current !== BlockType.Air && current !== BlockType.Water) {
                      chunk.setBlock(nx, worldY, nz, BlockType.Air);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

class CheeseCaveCarver implements CaveCarver {
  carve(chunk: Chunk, noise: any, dimension: DimensionType): void {
    const cx = chunk.x;
    const cz = chunk.z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
          const worldX = cx * CHUNK_SIZE_X + lx;
          const worldY = ly;
          const worldZ = cz * CHUNK_SIZE_Z + lz;

          if (worldY < 0 || worldY > 120) continue;

          const cheeseNoise = noise.fractalNoise3D(worldX * 0.04, worldY * 0.04, worldZ * 0.04, 3, 0.5, 1);
          
          if (cheeseNoise > 0.88) {
            const current = chunk.getBlock(lx, ly, lz);
            if (current !== BlockType.Air && current !== BlockType.Water) {
              chunk.setBlock(lx, ly, lz, BlockType.Air);
            }
          }
        }
      }
    }
  }
}

class AquiferCarver implements CaveCarver {
  carve(chunk: Chunk, noise: any, dimension: DimensionType): void {
    const cx = chunk.x;
    const cz = chunk.z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = cx * CHUNK_SIZE_X + lx;
        const worldZ = cz * CHUNK_SIZE_Z + lz;

        const aquiferNoise = noise.noise2D(worldX * 0.02, worldZ * 0.02);
        
        if (aquiferNoise > 0.9) {
          const waterLevel = Math.floor(noise.noise2D(worldX * 0.01, worldZ * 0.01) * 10) + 20;
          
          for (let ly = waterLevel; ly < Math.min(CHUNK_SIZE_Y, waterLevel + 10); ly++) {
            const verticalNoise = noise.noise3D(worldX * 0.05, ly * 0.05, worldZ * 0.05);
            
            if (verticalNoise > 0.6) {
              for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                  const nx = lx + dx;
                  const nz = lz + dz;
                  if (nx >= 0 && nx < CHUNK_SIZE_X && nz >= 0 && nz < CHUNK_SIZE_Z) {
                    const current = chunk.getBlock(nx, ly, nz);
                    if (current !== BlockType.Air) {
                      chunk.setBlock(nx, ly, nz, BlockType.Water);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

class CanyonCarver implements CaveCarver {
  carve(chunk: Chunk, noise: any, dimension: DimensionType): void {
    const cx = chunk.x;
    const cz = chunk.z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = cx * CHUNK_SIZE_X + lx;
        const worldZ = cz * CHUNK_SIZE_Z + lz;

        const canyonNoise = noise.noise2D(worldX * 0.008, worldZ * 0.008);
        const canyonDirection = noise.noise2D(worldX * 0.008 + 1000, worldZ * 0.008 + 1000);
        
        if (canyonNoise > 0.95) {
          const angle = canyonDirection * Math.PI * 2;
          const canyonWidth = 4 + Math.floor(Math.abs(noise.noise2D(worldX * 0.02, worldZ * 0.02)) * 6);
          
          for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
            const worldY = ly;
            const depthFactor = 1 - worldY / CHUNK_SIZE_Y;
            const widthAtDepth = canyonWidth * (0.5 + depthFactor * 0.5);
            
            for (let dx = -widthAtDepth; dx <= widthAtDepth; dx++) {
              for (let dz = -widthAtDepth; dz <= widthAtDepth; dz++) {
                const distFromCenter = Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle));
                if (distFromCenter > widthAtDepth) continue;
                
                const nx = lx + dx;
                const nz = lz + dz;
                if (nx >= 0 && nx < CHUNK_SIZE_X && nz >= 0 && nz < CHUNK_SIZE_Z) {
                  const current = chunk.getBlock(nx, worldY, nz);
                  if (current !== BlockType.Air && current !== BlockType.Water) {
                    chunk.setBlock(nx, worldY, nz, BlockType.Air);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

class TunnelCarver implements CaveCarver {
  carve(chunk: Chunk, noise: any, dimension: DimensionType): void {
    const cx = chunk.x;
    const cz = chunk.z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = cx * CHUNK_SIZE_X + lx;
        const worldZ = cz * CHUNK_SIZE_Z + lz;

        const tunnelNoise = noise.noise3D(worldX * 0.015, 50, worldZ * 0.015);
        
        if (tunnelNoise > 0.92) {
          const tunnelY = Math.floor(noise.noise2D(worldX * 0.02, worldZ * 0.02) * 40) + 20;
          const tunnelDirection = noise.noise2D(worldX * 0.01 + 2000, worldZ * 0.01 + 2000) * Math.PI * 2;
          
          for (let step = 0; step < 50; step++) {
            const tx = Math.floor(worldX + Math.cos(tunnelDirection) * step);
            const tz = Math.floor(worldZ + Math.sin(tunnelDirection) * step);
            const ty = tunnelY + Math.floor(noise.noise2D(step * 0.1, 0) * 3) - 1;
            
            if (ty < 0 || ty >= CHUNK_SIZE_Y) break;
            
            const chunkTx = tx - cx * CHUNK_SIZE_X;
            const chunkTz = tz - cz * CHUNK_SIZE_Z;
            
            if (chunkTx < -2 || chunkTx >= CHUNK_SIZE_X + 2 || 
                chunkTz < -2 || chunkTz >= CHUNK_SIZE_Z + 2) {
              if (step > 10) break;
              continue;
            }
            
            for (let dx = -1; dx <= 1; dx++) {
              for (let dz = -1; dz <= 1; dz++) {
                for (let dy = -1; dy <= 1; dy++) {
                  const nx = chunkTx + dx;
                  const ny = ty + dy;
                  const nz = chunkTz + dz;
                  
                  if (nx >= 0 && nx < CHUNK_SIZE_X && 
                      ny >= 0 && ny < CHUNK_SIZE_Y &&
                      nz >= 0 && nz < CHUNK_SIZE_Z) {
                    const current = chunk.getBlock(nx, ny, nz);
                    if (current !== BlockType.Air && current !== BlockType.Water) {
                      chunk.setBlock(nx, ny, nz, BlockType.Air);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

class SimplexNoise {
  private perm: number[] = [];
  private permMod12: number[] = [];
  private grad3: number[][] = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];

  constructor(seed: number) {
    // Simple seeded random number generator (Mulberry32)
    let state = seed >>> 0;
    const rng = () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    
    const source = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [source[i], source[j]] = [source[j], source[i]];
    }
    this.perm = [...source, ...source];
    this.permMod12 = this.perm.map(v => v % 12);
  }

  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    let n0 = 0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (this.grad3[gi0][0] * x0 + this.grad3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    let n1 = 0;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (this.grad3[gi1][0] * x1 + this.grad3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    let n2 = 0;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (this.grad3[gi2][0] * x2 + this.grad3[gi2][1] * y2);
    }

    return 70 * (n0 + n1 + n2);
  }

  noise3D(x: number, y: number, z: number): number {
    const F3 = 1/3;
    const G3 = 1/6;

    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;

    let i1, j1, k1;
    let i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }

    const x1 = x0 - i1 + G3; const y1 = y0 - j1 + G3; const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + G3; const y2 = y0 - j2 + G3; const z2 = z0 - k2 + G3;
    const x3 = x0 - 1 + 3*G3; const y3 = y0 - 1 + 3*G3; const z3 = z0 - 1 + 3*G3;

    const ii = i & 255; const jj = j & 255; const kk = k & 255;

    const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
    const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
    const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];

    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    let n0 = 0;
    if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * (this.grad3[gi0][0]*x0 + this.grad3[gi0][1]*y0 + this.grad3[gi0][2]*z0); }

    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    let n1 = 0;
    if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * (this.grad3[gi1][0]*x1 + this.grad3[gi1][1]*y1 + this.grad3[gi1][2]*z1); }

    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    let n2 = 0;
    if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * (this.grad3[gi2][0]*x2 + this.grad3[gi2][1]*y2 + this.grad3[gi2][2]*z2); }

    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    let n3 = 0;
    if (t3 > 0) { t3 *= t3; n3 = t3 * t3 * (this.grad3[gi3][0]*x3 + this.grad3[gi3][1]*y3 + this.grad3[gi3][2]*z3); }

    return 32 * (n0 + n1 + n2 + n3);
  }

  fractalNoise2D(x: number, z: number, octaves: number, persistence: number, scale: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, z * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }

  fractalNoise3D(x: number, y: number, z: number, octaves: number, persistence: number, scale: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise3D(x * frequency, y * frequency, z * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }
}

export function createCaveGenerator(seed: number): CaveGenerator {
  return new CaveGenerator(seed);
}