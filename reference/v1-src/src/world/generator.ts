import * as THREE from 'three';
import { Chunk, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './chunk';
import { BlockType } from './block';
import { BiomeRegistry, BiomeConfig, BiomeType, DimensionType, SimplexNoise, createBiomeRegistry } from './biomes';
import { StructureGenerator, StructureTemplate } from './structures';
import { CaveGenerator } from './caves';

export interface WorldGeneratorConfig {
  seed: number;
  dimension: DimensionType;
  biomeRegistry: BiomeRegistry;
  structureGenerator: StructureGenerator;
  caveGenerator: CaveGenerator;
}

export class WorldGenerator {
  public config: WorldGeneratorConfig;
  private noise: SimplexNoise;
  private biomeNoise: SimplexNoise;
  private heightNoise: SimplexNoise;
  private temperatureNoise: SimplexNoise;
  private humidityNoise: SimplexNoise;
  private continentalnessNoise: SimplexNoise;
  private erosionNoise: SimplexNoise;
  private weirdnessNoise: SimplexNoise;
  private pvNoise: SimplexNoise;
  private aquiferNoise: SimplexNoise;
  private structureNoise: SimplexNoise;

  constructor(config: WorldGeneratorConfig) {
    this.config = config;
    this.noise = new SimplexNoise(config.seed);
    this.biomeNoise = new SimplexNoise(config.seed + 1);
    this.heightNoise = new SimplexNoise(config.seed + 2);
    this.temperatureNoise = new SimplexNoise(config.seed + 3);
    this.humidityNoise = new SimplexNoise(config.seed + 4);
    this.continentalnessNoise = new SimplexNoise(config.seed + 5);
    this.erosionNoise = new SimplexNoise(config.seed + 6);
    this.weirdnessNoise = new SimplexNoise(config.seed + 7);
    this.pvNoise = new SimplexNoise(config.seed + 8);
    this.aquiferNoise = new SimplexNoise(config.seed + 9);
    this.structureNoise = new SimplexNoise(config.seed + 10);
  }

  generateChunk(chunk: Chunk): void {
    const cx = chunk.x;
    const cz = chunk.z;

    if (this.config.dimension === DimensionType.OVERWORLD) {
      this.generateOverworldChunk(chunk);
    } else if (this.config.dimension === DimensionType.NETHER) {
      this.generateNetherChunk(chunk);
    } else if (this.config.dimension === DimensionType.END) {
      this.generateEndChunk(chunk);
    }

    this.generateStructures(chunk);
    this.generateCaves(chunk);
    this.generateOres(chunk);
  }

  private generateOverworldChunk(chunk: Chunk): void {
    const cx = chunk.x;
    const cz = chunk.z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = cx * CHUNK_SIZE_X + lx;
        const worldZ = cz * CHUNK_SIZE_Z + lz;

        const biome = this.config.biomeRegistry.getBiomeAt(worldX, worldZ, DimensionType.OVERWORLD);
        const surfaceHeight = this.calculateSurfaceHeight(worldX, worldZ, biome);

        for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
          const worldY = ly;
          let block = this.getBlockAt(worldX, worldY, worldZ, surfaceHeight, biome);

          if (block !== BlockType.Air) {
            chunk.setBlock(lx, ly, lz, block);
          }
        }
      }
    }
  }

  private calculateSurfaceHeight(worldX: number, worldZ: number, biome: BiomeConfig): number {
    const continentalness = this.continentalnessNoise.noise2D(worldX * 0.005, worldZ * 0.005);
    const erosion = this.erosionNoise.noise2D(worldX * 0.008, worldZ * 0.008);
    const weirdness = this.weirdnessNoise.noise2D(worldX * 0.02, worldZ * 0.02);
    const pv = this.pvNoise.noise2D(worldX * 0.015, worldZ * 0.015);

    const baseHeight = biome.baseHeight;
    const heightVariation = biome.heightVariation;

    let height = baseHeight;

    const continentalFactor = (continentalness + 1) * 0.5;
    const erosionFactor = (erosion + 1) * 0.5;

    height += continentalFactor * heightVariation * 0.5;
    height += erosionFactor * heightVariation * 0.3;

    const detailNoise = this.heightNoise.fractalNoise2D(worldX * 0.02, worldZ * 0.02, 4, 0.5, 1);
    height += detailNoise * heightVariation * 0.2;

    const peaksNoise = this.heightNoise.fractalNoise2D(worldX * 0.005, worldZ * 0.005, 3, 0.6, 1);
    if (peaksNoise > 0.7) {
      height += (peaksNoise - 0.7) * 30;
    }

    const valleyNoise = this.heightNoise.fractalNoise2D(worldX * 0.01 + 100, worldZ * 0.01 + 100, 2, 0.5, 1);
    if (valleyNoise < -0.6) {
      height += (valleyNoise + 0.6) * 15;
    }

    return Math.max(0, Math.min(CHUNK_SIZE_Y - 1, Math.floor(height)));
  }

  private getBlockAt(worldX: number, worldY: number, worldZ: number, surfaceHeight: number, biome: BiomeConfig): BlockType {
    if (worldY > surfaceHeight) {
      if (worldY <= 63) {
        return BlockType.Water;
      }
      return BlockType.Air;
    }

    if (worldY === surfaceHeight) {
      return biome.topBlock;
    }

    if (worldY >= surfaceHeight - 3) {
      return biome.fillerBlock;
    }

    if (worldY >= surfaceHeight - 10) {
      return biome.subsurfaceBlock;
    }

    return biome.surfaceBlock;
  }

  private generateNetherChunk(chunk: Chunk): void {
    const cx = chunk.x;
    const cz = chunk.z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = cx * CHUNK_SIZE_X + lx;
        const worldZ = cz * CHUNK_SIZE_Z + lz;

        const biome = this.config.biomeRegistry.getBiomeAt(worldX, worldZ, DimensionType.NETHER);

        for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
          const worldY = ly;
          let block = this.getNetherBlockAt(worldX, worldY, worldZ, biome);

          if (block !== BlockType.Air) {
            chunk.setBlock(lx, ly, lz, block);
          }
        }
      }
    }

    this.addNetherFeatures(chunk);
  }

  private getNetherBlockAt(worldX: number, worldY: number, worldZ: number, biome: BiomeConfig): BlockType {
    const ceilingNoise = this.noise.noise3D(worldX * 0.01, worldY * 0.01, worldZ * 0.01);
    const floorNoise = this.noise.noise3D(worldX * 0.01 + 1000, worldY * 0.01, worldZ * 0.01 + 1000);

    const ceilingHeight = 127 - Math.floor((ceilingNoise + 1) * 10);
    const floorHeight = Math.floor((floorNoise + 1) * 10);

    if (worldY >= ceilingHeight) return biome.topBlock;
    if (worldY <= floorHeight) return biome.topBlock;

    const density = this.noise.fractalNoise3D(worldX * 0.02, worldY * 0.02, worldZ * 0.02, 4, 0.5, 1);
    const threshold = 0.2 + (worldY / 128) * 0.3;

    if (density > threshold) {
      return biome.surfaceBlock;
    }

    if (worldY < 30) {
      const lavaNoise = this.noise.noise3D(worldX * 0.05, worldY * 0.05, worldZ * 0.05);
      if (lavaNoise > 0.8) {
        return BlockType.Water;
      }
    }

    return BlockType.Air;
  }

  private addNetherFeatures(chunk: Chunk): void {
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = chunk.x * CHUNK_SIZE_X + lx;
        const worldZ = chunk.z * CHUNK_SIZE_Z + lz;

        const glowstoneNoise = this.noise.noise3D(worldX * 0.05, 0, worldZ * 0.05);
        if (glowstoneNoise > 0.95) {
          for (let ly = CHUNK_SIZE_Y - 1; ly >= 0; ly--) {
            if (chunk.getBlock(lx, ly, lz) !== BlockType.Air) {
              if (ly < CHUNK_SIZE_Y - 1 && chunk.getBlock(lx, ly + 1, lz) === BlockType.Air) {
                chunk.setBlock(lx, ly + 1, lz, BlockType.Glowstone);
              }
              break;
            }
          }
        }
      }
    }
  }

  private generateEndChunk(chunk: Chunk): void {
    const cx = chunk.x;
    const cz = chunk.z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = cx * CHUNK_SIZE_X + lx;
        const worldZ = cz * CHUNK_SIZE_Z + lz;

        const biome = this.config.biomeRegistry.getBiomeAt(worldX, worldZ, DimensionType.END);

        const islandNoise = this.noise.fractalNoise2D(worldX * 0.01, worldZ * 0.01, 4, 0.5, 1);
        if (islandNoise < 0.3) continue;

        const height = Math.floor(50 + islandNoise * 50);

        for (let ly = 0; ly <= height && ly < CHUNK_SIZE_Y; ly++) {
          chunk.setBlock(lx, ly, lz, biome.surfaceBlock);
        }

        if (height < CHUNK_SIZE_Y) {
          chunk.setBlock(lx, height, lz, biome.topBlock);
        }
      }
    }

    this.addEndFeatures(chunk);
  }

  private addEndFeatures(chunk: Chunk): void {
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = chunk.x * CHUNK_SIZE_X + lx;
        const worldZ = chunk.z * CHUNK_SIZE_Z + lz;

        const chorusNoise = this.noise.noise2D(worldX * 0.03, worldZ * 0.03);
        if (chorusNoise > 0.9) {
          for (let ly = CHUNK_SIZE_Y - 1; ly >= 0; ly--) {
            if (chunk.getBlock(lx, ly, lz) !== BlockType.Air) {
              this.generateChorusPlant(chunk, lx, ly + 1, lz);
              break;
            }
          }
        }
      }
    }
  }

  private generateChorusPlant(chunk: Chunk, lx: number, ly: number, lz: number): void {
    const height = 5 + Math.floor(Math.random() * 10);
    for (let i = 0; i < height; i++) {
      if (ly + i >= CHUNK_SIZE_Y) break;
      chunk.setBlock(lx, ly + i, lz, BlockType.ChorusPlant);
    }
  }

  private generateStructures(chunk: Chunk): void {
    const cx = chunk.x;
    const cz = chunk.z;
    const worldX = cx * CHUNK_SIZE_X;
    const worldZ = cz * CHUNK_SIZE_Z;

    this.config.structureGenerator.generateInChunk(chunk, worldX, worldZ, this.config.dimension);
  }

  private generateCaves(chunk: Chunk): void {
    this.config.caveGenerator.generateInChunk(chunk, this.config.dimension);
  }

  private generateOres(chunk: Chunk): void {
    const cx = chunk.x;
    const cz = chunk.z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const worldX = cx * CHUNK_SIZE_X + lx;
        const worldZ = cz * CHUNK_SIZE_Z + lz;

        const biome = this.config.biomeRegistry.getBiomeAt(worldX, worldZ, this.config.dimension);

        for (const vein of biome.oreVeins) {
          if (Math.random() > vein.chance) continue;

          const count = vein.countPerChunk;
          for (let i = 0; i < count; i++) {
            const veinX = worldX + Math.floor(Math.random() * CHUNK_SIZE_X);
            const veinZ = worldZ + Math.floor(Math.random() * CHUNK_SIZE_Z);
            const veinY = vein.minY + Math.floor(Math.random() * (vein.maxY - vein.minY + 1));

            this.generateOreVein(chunk, veinX, veinY, veinZ, vein, biome);
          }
        }
      }
    }
  }

  private generateOreVein(chunk: Chunk, centerX: number, centerY: number, centerZ: number, vein: any, biome: any): void {
    const veinSize = vein.veinSize;
    const radius = Math.max(1, veinSize / 4);

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq > radius * radius) continue;

          const blockX = centerX + dx;
          const blockY = centerY + dy;
          const blockZ = centerZ + dz;

          if (blockY < 0 || blockY >= CHUNK_SIZE_Y) continue;

          const chunkX = Math.floor(blockX / CHUNK_SIZE_X);
          const chunkZ = Math.floor(blockZ / CHUNK_SIZE_Z);

          if (chunkX !== chunk.x || chunkZ !== chunk.z) continue;

          const localX = ((blockX % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
          const localZ = ((blockZ % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

          const currentBlock = chunk.getBlock(localX, blockY, localZ);
          if (currentBlock === BlockType.Stone || currentBlock === BlockType.Dirt || currentBlock === biome.surfaceBlock) {
            chunk.setBlock(localX, blockY, localZ, vein.blockType);
          }
        }
      }
    }
  }

  getBiomeAt(x: number, z: number): BiomeConfig {
    return this.config.biomeRegistry.getBiomeAt(x, z, this.config.dimension);
  }

  getSurfaceHeight(x: number, z: number): number {
    const biome = this.getBiomeAt(x, z);
    return this.calculateSurfaceHeight(x, z, biome);
  }
}

export function createWorldGenerator(config: WorldGeneratorConfig): WorldGenerator {
  return new WorldGenerator(config);
}