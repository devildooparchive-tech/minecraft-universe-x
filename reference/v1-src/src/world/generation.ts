import { Chunk, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './chunk';
import { BlockType } from './block';
import { WorldGenerator, createWorldGenerator, WorldGeneratorConfig } from './generator';
import { BiomeRegistry, createBiomeRegistry, DimensionType, BiomeType } from './biomes';
import { StructureGenerator, createStructureGenerator } from './structures';
import { CaveGenerator, createCaveGenerator } from './caves';

let worldGenerator: WorldGenerator | null = null;

export function initializeWorldGenerator(seed: number, dimension: DimensionType = DimensionType.OVERWORLD): WorldGenerator {
  if (worldGenerator && worldGenerator.config.seed === seed) {
    return worldGenerator;
  }

  const biomeRegistry = createBiomeRegistry(seed);
  const structureGenerator = createStructureGenerator(seed);
  const caveGenerator = createCaveGenerator(seed);

  const config: WorldGeneratorConfig = {
    seed,
    dimension,
    biomeRegistry,
    structureGenerator,
    caveGenerator,
  };

  worldGenerator = createWorldGenerator(config);
  return worldGenerator;
}

export function generateChunk(chunk: Chunk, seed: number) {
  const generator = initializeWorldGenerator(seed);
  generator.generateChunk(chunk);
}

export function setWorldGenerator(generator: WorldGenerator) {
  worldGenerator = generator;
}

export function getWorldGenerator(): WorldGenerator | null {
  return worldGenerator;
}