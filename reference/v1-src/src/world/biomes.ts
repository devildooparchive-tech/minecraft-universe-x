import * as THREE from 'three';
import { gameEvents } from '../core/events';

export enum BiomeType {
  PLAINS = 'plains',
  FOREST = 'forest',
  DESERT = 'desert',
  MOUNTAINS = 'mountains',
  TAIGA = 'taiga',
  SWAMP = 'swamp',
  JUNGLE = 'jungle',
  SAVANNA = 'savanna',
  MUSHROOM = 'mushroom',
  BEACH = 'beach',
  RIVER = 'river',
  OCEAN = 'ocean',
  DEEP_OCEAN = 'deep_ocean',
  NETHER_WASTES = 'nether_wastes',
  SOUL_SAND_VALLEY = 'soul_sand_valley',
  CRIMSON_FOREST = 'crimson_forest',
  WARPED_FOREST = 'warped_forest',
  BASALT_DELTAS = 'basalt_deltas',
  END_HIGHLANDS = 'end_highlands',
  END_MIDLANDS = 'end_midlands',
  SMALL_END_ISLANDS = 'small_end_islands',
  END_BARRENS = 'end_barrens',
}

export enum DimensionType {
  OVERWORLD = 'overworld',
  NETHER = 'nether',
  END = 'end',
  CUSTOM = 'custom',
}

export interface BiomeConfig {
  id: BiomeType;
  name: string;
  dimension: DimensionType;
  temperature: number;
  humidity: number;
  baseHeight: number;
  heightVariation: number;
  surfaceBlock: number;
  subsurfaceBlock: number;
  topBlock: number;
  fillerBlock: number;
  waterColor: number;
  grassColor: number;
  foliageColor: number;
  skyColor: number;
  fogColor: number;
  precipitation: 'none' | 'rain' | 'snow';
  temperatureModifier: number;
  tags: string[];
  spawnableEntities: string[];
  structures: string[];
  caveChance: number;
  caveSize: number;
  oreVeins: OreVeinConfig[];
}

export interface OreVeinConfig {
  blockType: number;
  minY: number;
  maxY: number;
  veinSize: number;
  chance: number;
  countPerChunk: number;
}

export interface StructureConfig {
  id: string;
  name: string;
  biomes: BiomeType[];
  dimensions: DimensionType[];
  spacing: number;
  separation: number;
  terrainAdaptation: 'none' | 'beard_thin' | 'beard_box' | 'bury';
  startHeight: { type: 'absolute' | 'relative'; value: number };
  maxDistanceFromCenter: number;
  pieces: StructurePieceConfig[];
  lootTables: string[];
}

export interface StructurePieceConfig {
  id: string;
  template: string;
  weight: number;
  size: THREE.Vector3;
  connectionPoints: ConnectionPoint[];
}

export interface ConnectionPoint {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  type: 'entrance' | 'hallway' | 'room' | 'stairs';
}

export interface CaveConfig {
  id: string;
  name: string;
  biomes: BiomeType[];
  dimensions: DimensionType[];
  frequency: number;
  size: number;
  thickness: number;
  minY: number;
  maxY: number;
  noiseScale: number;
  noiseThreshold: number;
  carvers: CaveCarverConfig[];
  decorations: CaveDecorationConfig[];
}

export interface CaveCarverConfig {
  type: 'noodle' | 'cheese' | 'aquifer' | 'canyon' | 'tunnel';
  probability: number;
  size: number;
  length: number;
  yScale: number;
}

export interface CaveDecorationConfig {
  blockType: number;
  chance: number;
  minClusterSize: number;
  maxClusterSize: number;
  yRange: [number, number];
  requireSurface: boolean;
}

export interface DimensionConfig {
  id: DimensionType;
  name: string;
  bedrockFloor: boolean;
  bedrockCeiling: boolean;
  hasSkyLight: boolean;
  hasCeiling: boolean;
  logicalHeight: number;
  minY: number;
  maxY: number;
  biomeSource: BiomeSourceConfig;
  generator: WorldGeneratorConfig;
  effects: DimensionEffects;
}

export interface BiomeSourceConfig {
  type: 'multi_noise' | 'fixed' | 'checkerboard' | 'the_end' | 'nether';
  biomes: BiomeType[];
  params: Record<string, number>;
}

export interface WorldGeneratorConfig {
  type: 'noise' | 'flat' | 'debug' | 'end' | 'nether';
  noiseSettings: NoiseSettingsConfig;
  surfaceRule: SurfaceRuleConfig;
  carvers: CarverConfig[];
  structures: StructureConfig[];
}

export interface NoiseSettingsConfig {
  minY: number;
  height: number;
  sizeHorizontal: number;
  sizeVertical: number;
  densityFactor: number;
  densityOffset: number;
  simplexSurfaceNoise: boolean;
  topSlide: { target: number; size: number; offset: number };
  bottomSlide: { target: number; size: number; offset: number };
  sampling: { xzScale: number; yScale: number; xzFactor: number; yFactor: number };
}

export interface SurfaceRuleConfig {
  sequences: SurfaceSequence[];
}

export interface SurfaceSequence {
  conditions: SurfaceCondition[];
  blocks: SurfaceBlock[];
}

export interface SurfaceCondition {
  type: 'biome' | 'y_above' | 'y_below' | 'noise' | 'vertical_gradient';
  params: Record<string, number>;
}

export interface SurfaceBlock {
  block: number;
  count: number;
  state?: Record<string, any>;
}

export interface CarverConfig {
  type: string;
  probability: number;
  y: { min: number; max: number; type: 'uniform' | 'triangle' };
  lavaLevel: number;
  aquifer: boolean;
}

export interface DimensionEffects {
  skyColor: number;
  fogColor: number;
  waterColor: number;
  waterFogColor: number;
  grassColor: number;
  foliageColor: number;
  particleAmbient?: { type: string; probability: number; options: Record<string, any> };
  hasRaids: boolean;
  hasSkylight: boolean;
  naturalSpawnValid: boolean;
  respawnAnchorWorks: boolean;
  bedWorks: boolean;
  hasCeiling: boolean;
  logicalHeight: number;
  infiniburn: string;
  coordinatesScale: number;
}

export class BiomeRegistry {
  private biomes: Map<BiomeType, BiomeConfig> = new Map();
  private noise: SimplexNoise;

  constructor(seed: number) {
    this.noise = new SimplexNoise(seed);
    this.registerVanillaBiomes();
  }

  private registerVanillaBiomes(): void {
    const biomes: BiomeConfig[] = [
      {
        id: BiomeType.PLAINS,
        name: 'Plains',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.8,
        humidity: 0.4,
        baseHeight: 64,
        heightVariation: 4,
        surfaceBlock: 2,
        subsurfaceBlock: 3,
        topBlock: 1,
        fillerBlock: 3,
        waterColor: 0x3b6fd4,
        grassColor: 0x90c45e,
        foliageColor: 0x7fae4f,
        skyColor: 0x87ceeb,
        fogColor: 0xc0d8f0,
        precipitation: 'rain',
        temperatureModifier: 0,
        tags: ['plains', 'flat'],
        spawnableEntities: ['cow', 'pig', 'sheep', 'chicken', 'horse', 'donkey', 'villager'],
        structures: ['village', 'pillager_outpost'],
        caveChance: 0.5,
        caveSize: 1.0,
        oreVeins: [
          { blockType: 56, minY: 0, maxY: 64, veinSize: 8, chance: 0.8, countPerChunk: 20 },
          { blockType: 15, minY: 0, maxY: 32, veinSize: 4, chance: 0.6, countPerChunk: 8 },
          { blockType: 14, minY: 0, maxY: 16, veinSize: 3, chance: 0.4, countPerChunk: 4 },
        ],
      },
      {
        id: BiomeType.FOREST,
        name: 'Forest',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.7,
        humidity: 0.6,
        baseHeight: 68,
        heightVariation: 6,
        surfaceBlock: 2,
        subsurfaceBlock: 3,
        topBlock: 1,
        fillerBlock: 3,
        waterColor: 0x3b6fd4,
        grassColor: 0x6a9e4a,
        foliageColor: 0x5d8a3e,
        skyColor: 0x87ceeb,
        fogColor: 0xa0c8e0,
        precipitation: 'rain',
        temperatureModifier: 0,
        tags: ['forest', 'trees'],
        spawnableEntities: ['cow', 'pig', 'sheep', 'chicken', 'wolf', 'fox', 'rabbit', 'bee'],
        structures: ['village', 'woodland_mansion', 'ruined_portal'],
        caveChance: 0.6,
        caveSize: 1.2,
        oreVeins: [
          { blockType: 56, minY: 0, maxY: 64, veinSize: 8, chance: 0.8, countPerChunk: 20 },
          { blockType: 15, minY: 0, maxY: 32, veinSize: 4, chance: 0.6, countPerChunk: 8 },
          { blockType: 14, minY: 0, maxY: 16, veinSize: 3, chance: 0.4, countPerChunk: 4 },
        ],
      },
      {
        id: BiomeType.DESERT,
        name: 'Desert',
        dimension: DimensionType.OVERWORLD,
        temperature: 2.0,
        humidity: 0.0,
        baseHeight: 64,
        heightVariation: 2,
        surfaceBlock: 4,
        subsurfaceBlock: 4,
        topBlock: 4,
        fillerBlock: 4,
        waterColor: 0x3b6fd4,
        grassColor: 0xbdb36a,
        foliageColor: 0xa8a058,
        skyColor: 0xf0e68c,
        fogColor: 0xe8dc9c,
        precipitation: 'none',
        temperatureModifier: 0,
        tags: ['desert', 'hot', 'dry'],
        spawnableEntities: ['rabbit', 'camel', 'husk'],
        structures: ['desert_temple', 'desert_village', 'pillager_outpost', 'ruined_portal'],
        caveChance: 0.4,
        caveSize: 0.8,
        oreVeins: [
          { blockType: 56, minY: 0, maxY: 64, veinSize: 8, chance: 0.8, countPerChunk: 20 },
          { blockType: 15, minY: 0, maxY: 32, veinSize: 4, chance: 0.6, countPerChunk: 8 },
          { blockType: 14, minY: 0, maxY: 16, veinSize: 3, chance: 0.4, countPerChunk: 4 },
          { blockType: 73, minY: 0, maxY: 64, veinSize: 6, chance: 0.5, countPerChunk: 6 },
        ],
      },
      {
        id: BiomeType.MOUNTAINS,
        name: 'Mountains',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.2,
        humidity: 0.3,
        baseHeight: 100,
        heightVariation: 40,
        surfaceBlock: 2,
        subsurfaceBlock: 3,
        topBlock: 1,
        fillerBlock: 3,
        waterColor: 0x3b6fd4,
        grassColor: 0x7a9e5e,
        foliageColor: 0x6b8a4e,
        skyColor: 0x87ceeb,
        fogColor: 0xb0c8d8,
        precipitation: 'snow',
        temperatureModifier: -0.5,
        tags: ['mountains', 'high', 'snowy'],
        spawnableEntities: ['goat', 'llama', 'snow_golem'],
        structures: ['pillager_outpost', 'ruined_portal'],
        caveChance: 0.7,
        caveSize: 1.5,
        oreVeins: [
          { blockType: 56, minY: 0, maxY: 64, veinSize: 8, chance: 0.8, countPerChunk: 20 },
          { blockType: 15, minY: 0, maxY: 32, veinSize: 4, chance: 0.6, countPerChunk: 8 },
          { blockType: 14, minY: 0, maxY: 16, veinSize: 3, chance: 0.4, countPerChunk: 4 },
          { blockType: 16, minY: 0, maxY: 32, veinSize: 4, chance: 0.5, countPerChunk: 6 },
          { blockType: 73, minY: 0, maxY: 64, veinSize: 6, chance: 0.7, countPerChunk: 8 },
        ],
      },
      {
        id: BiomeType.TAIGA,
        name: 'Taiga',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.25,
        humidity: 0.4,
        baseHeight: 70,
        heightVariation: 8,
        surfaceBlock: 2,
        subsurfaceBlock: 3,
        topBlock: 1,
        fillerBlock: 3,
        waterColor: 0x3b6fd4,
        grassColor: 0x5a7e4a,
        foliageColor: 0x4d6e3e,
        skyColor: 0x87ceeb,
        fogColor: 0x90a8c0,
        precipitation: 'snow',
        temperatureModifier: -0.3,
        tags: ['taiga', 'cold', 'spruce'],
        spawnableEntities: ['wolf', 'fox', 'rabbit', 'sheep', 'pig', 'cow'],
        structures: ['village', 'pillager_outpost', 'ruined_portal'],
        caveChance: 0.6,
        caveSize: 1.1,
        oreVeins: [
          { blockType: 56, minY: 0, maxY: 64, veinSize: 8, chance: 0.8, countPerChunk: 20 },
          { blockType: 15, minY: 0, maxY: 32, veinSize: 4, chance: 0.6, countPerChunk: 8 },
          { blockType: 14, minY: 0, maxY: 16, veinSize: 3, chance: 0.4, countPerChunk: 4 },
        ],
      },
      {
        id: BiomeType.SWAMP,
        name: 'Swamp',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.8,
        humidity: 0.9,
        baseHeight: 63,
        heightVariation: 2,
        surfaceBlock: 2,
        subsurfaceBlock: 3,
        topBlock: 1,
        fillerBlock: 3,
        waterColor: 0x4a6b4a,
        grassColor: 0x6a8b4a,
        foliageColor: 0x5d7a3e,
        skyColor: 0x87ceeb,
        fogColor: 0x90a8a0,
        precipitation: 'rain',
        temperatureModifier: 0,
        tags: ['swamp', 'wet', 'water'],
        spawnableEntities: ['frog', 'slime', 'witch', 'sheep', 'chicken'],
        structures: ['witch_hut', 'ruined_portal'],
        caveChance: 0.5,
        caveSize: 1.0,
        oreVeins: [
          { blockType: 56, minY: 0, maxY: 64, veinSize: 8, chance: 0.8, countPerChunk: 20 },
          { blockType: 15, minY: 0, maxY: 32, veinSize: 4, chance: 0.6, countPerChunk: 8 },
        ],
      },
      {
        id: BiomeType.JUNGLE,
        name: 'Jungle',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.95,
        humidity: 0.9,
        baseHeight: 70,
        heightVariation: 12,
        surfaceBlock: 2,
        subsurfaceBlock: 3,
        topBlock: 1,
        fillerBlock: 3,
        waterColor: 0x3b6fd4,
        grassColor: 0x5a8b3a,
        foliageColor: 0x4d7a2e,
        skyColor: 0x87ceeb,
        fogColor: 0x90a8b0,
        precipitation: 'rain',
        temperatureModifier: 0,
        tags: ['jungle', 'tropical', 'dense'],
        spawnableEntities: ['parrot', 'panda', 'ocelot', 'sheep', 'pig', 'chicken'],
        structures: ['jungle_temple', 'ruined_portal'],
        caveChance: 0.7,
        caveSize: 1.3,
        oreVeins: [
          { blockType: 56, minY: 0, maxY: 64, veinSize: 8, chance: 0.8, countPerChunk: 20 },
          { blockType: 15, minY: 0, maxY: 32, veinSize: 4, chance: 0.6, countPerChunk: 8 },
          { blockType: 14, minY: 0, maxY: 16, veinSize: 3, chance: 0.4, countPerChunk: 4 },
        ],
      },
      {
        id: BiomeType.SAVANNA,
        name: 'Savanna',
        dimension: DimensionType.OVERWORLD,
        temperature: 1.2,
        humidity: 0.0,
        baseHeight: 68,
        heightVariation: 10,
        surfaceBlock: 2,
        subsurfaceBlock: 3,
        topBlock: 1,
        fillerBlock: 3,
        waterColor: 0x3b6fd4,
        grassColor: 0x8a9e4a,
        foliageColor: 0x7e8e3e,
        skyColor: 0xf0e68c,
        fogColor: 0xe8dc9c,
        precipitation: 'none',
        temperatureModifier: 0,
        tags: ['savanna', 'warm', 'acacia'],
        spawnableEntities: ['horse', 'donkey', 'llama', 'sheep', 'cow', 'chicken'],
        structures: ['village', 'pillager_outpost', 'ruined_portal'],
        caveChance: 0.5,
        caveSize: 1.0,
        oreVeins: [
          { blockType: 56, minY: 0, maxY: 64, veinSize: 8, chance: 0.8, countPerChunk: 20 },
          { blockType: 15, minY: 0, maxY: 32, veinSize: 4, chance: 0.6, countPerChunk: 8 },
        ],
      },
      {
        id: BiomeType.MUSHROOM,
        name: 'Mushroom Fields',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.9,
        humidity: 0.8,
        baseHeight: 66,
        heightVariation: 3,
        surfaceBlock: 127,
        subsurfaceBlock: 126,
        topBlock: 127,
        fillerBlock: 126,
        waterColor: 0x3b6fd4,
        grassColor: 0xa87ea8,
        foliageColor: 0x9c6e9c,
        skyColor: 0x87ceeb,
        fogColor: 0xb8a8c0,
        precipitation: 'rain',
        temperatureModifier: 0,
        tags: ['mushroom', 'rare', 'mycelium'],
        spawnableEntities: ['mooshroom', 'bat'],
        structures: [],
        caveChance: 0.4,
        caveSize: 0.8,
        oreVeins: [
          { blockType: 56, minY: 0, maxY: 64, veinSize: 8, chance: 0.8, countPerChunk: 20 },
        ],
      },
      {
        id: BiomeType.BEACH,
        name: 'Beach',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.8,
        humidity: 0.4,
        baseHeight: 63,
        heightVariation: 1,
        surfaceBlock: 4,
        subsurfaceBlock: 4,
        topBlock: 4,
        fillerBlock: 4,
        waterColor: 0x3b6fd4,
        grassColor: 0x9c8e4a,
        foliageColor: 0x8e7e3e,
        skyColor: 0x87ceeb,
        fogColor: 0xc0d8f0,
        precipitation: 'rain',
        temperatureModifier: 0,
        tags: ['beach', 'coast', 'water'],
        spawnableEntities: ['turtle', 'crab'],
        structures: ['buried_treasure', 'ruined_portal'],
        caveChance: 0.3,
        caveSize: 0.6,
        oreVeins: [],
      },
      {
        id: BiomeType.RIVER,
        name: 'River',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.5,
        humidity: 0.5,
        baseHeight: 62,
        heightVariation: 1,
        surfaceBlock: 3,
        subsurfaceBlock: 3,
        topBlock: 3,
        fillerBlock: 3,
        waterColor: 0x3b6fd4,
        grassColor: 0x7a9e5e,
        foliageColor: 0x6e8e4e,
        skyColor: 0x87ceeb,
        fogColor: 0xb0c8e0,
        precipitation: 'rain',
        temperatureModifier: 0,
        tags: ['river', 'water', 'flowing'],
        spawnableEntities: ['salmon', 'cod', 'squid', 'drowned'],
        structures: ['ruined_portal'],
        caveChance: 0.2,
        caveSize: 0.4,
        oreVeins: [
          { blockType: 73, minY: 0, maxY: 64, veinSize: 6, chance: 0.8, countPerChunk: 10 },
        ],
      },
      {
        id: BiomeType.OCEAN,
        name: 'Ocean',
        dimension: DimensionType.OVERWORLD,
        temperature: 0.5,
        humidity: 0.5,
        baseHeight: 60,
        heightVariation: 5,
        surfaceBlock: 3,
        subsurfaceBlock: 3,
        topBlock: 3,
        fillerBlock: 3,
        waterColor: 0x3b6fd4,
        grassColor: 0x6a8b5e,
        foliageColor: 0x5e7e4e,
        skyColor: 0x87ceeb,
        fogColor: 0xa0b8d0,
        precipitation: 'rain',
        temperatureModifier: 0,
        tags: ['ocean', 'water', 'deep'],
        spawnableEntities: ['cod', 'salmon', 'tropical_fish', 'pufferfish', 'dolphin', 'squid', 'drowned', 'guardian'],
        structures: ['ocean_ruins', 'shipwreck', 'ocean_monument', 'buried_treasure'],
        caveChance: 0.1,
        caveSize: 0.3,
        oreVeins: [
          { blockType: 73, minY: 0, maxY: 64, veinSize: 8, chance: 0.9, countPerChunk: 15 },
        ],
      },
      {
        id: BiomeType.NETHER_WASTES,
        name: 'Nether Wastes',
        dimension: DimensionType.NETHER,
        temperature: 2.0,
        humidity: 0.0,
        baseHeight: 32,
        heightVariation: 20,
        surfaceBlock: 87,
        subsurfaceBlock: 87,
        topBlock: 87,
        fillerBlock: 87,
        waterColor: 0xb33a3a,
        grassColor: 0xb33a3a,
        foliageColor: 0x9c2e2e,
        skyColor: 0x4a1a1a,
        fogColor: 0x8b2a2a,
        precipitation: 'none',
        temperatureModifier: 0,
        tags: ['nether', 'hell', 'wastes'],
        spawnableEntities: ['zombified_piglin', 'ghast', 'magma_cube', 'strider'],
        structures: ['nether_fortress', 'bastion_remnant', 'ruined_portal'],
        caveChance: 0.8,
        caveSize: 2.0,
        oreVeins: [
          { blockType: 87, minY: 0, maxY: 127, veinSize: 20, chance: 1.0, countPerChunk: 50 },
          { blockType: 88, minY: 0, maxY: 127, veinSize: 10, chance: 0.5, countPerChunk: 10 },
          { blockType: 89, minY: 0, maxY: 127, veinSize: 8, chance: 0.3, countPerChunk: 5 },
        ],
      },
      {
        id: BiomeType.SOUL_SAND_VALLEY,
        name: 'Soul Sand Valley',
        dimension: DimensionType.NETHER,
        temperature: 2.0,
        humidity: 0.0,
        baseHeight: 32,
        heightVariation: 15,
        surfaceBlock: 88,
        subsurfaceBlock: 87,
        topBlock: 88,
        fillerBlock: 87,
        waterColor: 0x5a3a5a,
        grassColor: 0x7a4a7a,
        foliageColor: 0x6e3e6e,
        skyColor: 0x3a1a3a,
        fogColor: 0x6a2a6a,
        precipitation: 'none',
        temperatureModifier: 0,
        tags: ['nether', 'soul', 'valley'],
        spawnableEntities: ['ghast', 'skeleton', 'strider'],
        structures: ['bastion_remnant', 'ruined_portal'],
        caveChance: 0.9,
        caveSize: 2.5,
        oreVeins: [
          { blockType: 87, minY: 0, maxY: 127, veinSize: 15, chance: 0.8, countPerChunk: 30 },
          { blockType: 88, minY: 0, maxY: 127, veinSize: 12, chance: 0.9, countPerChunk: 20 },
          { blockType: 115, minY: 0, maxY: 127, veinSize: 6, chance: 0.6, countPerChunk: 8 },
        ],
      },
      {
        id: BiomeType.CRIMSON_FOREST,
        name: 'Crimson Forest',
        dimension: DimensionType.NETHER,
        temperature: 2.0,
        humidity: 0.0,
        baseHeight: 35,
        heightVariation: 10,
        surfaceBlock: 89,
        subsurfaceBlock: 87,
        topBlock: 89,
        fillerBlock: 87,
        waterColor: 0x8b2a2a,
        grassColor: 0xb33a3a,
        foliageColor: 0x9c2e2e,
        skyColor: 0x4a1a1a,
        fogColor: 0x8b2a2a,
        precipitation: 'none',
        temperatureModifier: 0,
        tags: ['nether', 'crimson', 'forest'],
        spawnableEntities: ['hoglin', 'piglin', 'zoglin', 'strider'],
        structures: ['bastion_remnant', 'ruined_portal'],
        caveChance: 0.6,
        caveSize: 1.5,
        oreVeins: [
          { blockType: 87, minY: 0, maxY: 127, veinSize: 10, chance: 0.7, countPerChunk: 20 },
          { blockType: 89, minY: 0, maxY: 127, veinSize: 8, chance: 0.8, countPerChunk: 15 },
          { blockType: 116, minY: 0, maxY: 127, veinSize: 4, chance: 0.5, countPerChunk: 6 },
        ],
      },
      {
        id: BiomeType.WARPED_FOREST,
        name: 'Warped Forest',
        dimension: DimensionType.NETHER,
        temperature: 2.0,
        humidity: 0.0,
        baseHeight: 35,
        heightVariation: 10,
        surfaceBlock: 90,
        subsurfaceBlock: 87,
        topBlock: 90,
        fillerBlock: 87,
        waterColor: 0x2a5a8b,
        grassColor: 0x3a7a9c,
        foliageColor: 0x2e6e8e,
        skyColor: 0x1a2a4a,
        fogColor: 0x2a4a6a,
        precipitation: 'none',
        temperatureModifier: 0,
        tags: ['nether', 'warped', 'forest'],
        spawnableEntities: ['enderman', 'strider'],
        structures: ['bastion_remnant', 'ruined_portal'],
        caveChance: 0.5,
        caveSize: 1.2,
        oreVeins: [
          { blockType: 87, minY: 0, maxY: 127, veinSize: 10, chance: 0.7, countPerChunk: 20 },
          { blockType: 90, minY: 0, maxY: 127, veinSize: 8, chance: 0.8, countPerChunk: 15 },
          { blockType: 117, minY: 0, maxY: 127, veinSize: 4, chance: 0.5, countPerChunk: 6 },
        ],
      },
      {
        id: BiomeType.BASALT_DELTAS,
        name: 'Basalt Deltas',
        dimension: DimensionType.NETHER,
        temperature: 2.0,
        humidity: 0.0,
        baseHeight: 40,
        heightVariation: 25,
        surfaceBlock: 91,
        subsurfaceBlock: 91,
        topBlock: 91,
        fillerBlock: 91,
        waterColor: 0x3a3a3a,
        grassColor: 0x5a5a5a,
        foliageColor: 0x4e4e4e,
        skyColor: 0x1a1a1a,
        fogColor: 0x4a4a4a,
        precipitation: 'none',
        temperatureModifier: 0,
        tags: ['nether', 'basalt', 'volcanic'],
        spawnableEntities: ['magma_cube', 'ghast', 'strider'],
        structures: ['bastion_remnant', 'ruined_portal'],
        caveChance: 0.7,
        caveSize: 1.8,
        oreVeins: [
          { blockType: 87, minY: 0, maxY: 127, veinSize: 12, chance: 0.6, countPerChunk: 25 },
          { blockType: 91, minY: 0, maxY: 127, veinSize: 15, chance: 0.9, countPerChunk: 30 },
          { blockType: 92, minY: 0, maxY: 127, veinSize: 8, chance: 0.4, countPerChunk: 8 },
        ],
      },
      {
        id: BiomeType.END_HIGHLANDS,
        name: 'End Highlands',
        dimension: DimensionType.END,
        temperature: 0.5,
        humidity: 0.5,
        baseHeight: 80,
        heightVariation: 30,
        surfaceBlock: 93,
        subsurfaceBlock: 93,
        topBlock: 93,
        fillerBlock: 93,
        waterColor: 0x0,
        grassColor: 0x8a8a9c,
        foliageColor: 0x7e7e8e,
        skyColor: 0x1a1a2a,
        fogColor: 0x3a3a4a,
        precipitation: 'none',
        temperatureModifier: 0,
        tags: ['end', 'highlands', 'chorus'],
        spawnableEntities: ['enderman', 'shulker'],
        structures: ['end_city', 'end_gateway'],
        caveChance: 0.1,
        caveSize: 0.2,
        oreVeins: [],
      },
      {
        id: BiomeType.END_MIDLANDS,
        name: 'End Midlands',
        dimension: DimensionType.END,
        temperature: 0.5,
        humidity: 0.5,
        baseHeight: 60,
        heightVariation: 15,
        surfaceBlock: 93,
        subsurfaceBlock: 93,
        topBlock: 93,
        fillerBlock: 93,
        waterColor: 0x0,
        grassColor: 0x8a8a9c,
        foliageColor: 0x7e7e8e,
        skyColor: 0x1a1a2a,
        fogColor: 0x3a3a4a,
        precipitation: 'none',
        temperatureModifier: 0,
        tags: ['end', 'midlands'],
        spawnableEntities: ['enderman'],
        structures: ['end_gateway'],
        caveChance: 0.05,
        caveSize: 0.1,
        oreVeins: [],
      },
    ];

    for (const biome of biomes) {
      this.biomes.set(biome.id, biome);
    }
  }

  getBiome(type: BiomeType): BiomeConfig | undefined {
    return this.biomes.get(type);
  }

  getBiomeAt(x: number, z: number, dimension: DimensionType = DimensionType.OVERWORLD): BiomeConfig {
    const temp = this.noise.noise2D(x * 0.01, z * 0.01);
    const humidity = this.noise.noise2D(x * 0.01 + 1000, z * 0.01 + 1000);
    const continentalness = this.noise.noise2D(x * 0.005, z * 0.005);
    const erosion = this.noise.noise2D(x * 0.008 + 2000, z * 0.008 + 2000);
    const weirdness = this.noise.noise2D(x * 0.02 + 3000, z * 0.02 + 3000);
    const pv = this.noise.noise2D(x * 0.015 + 4000, z * 0.015 + 4000);

    let biomeType = this.mapToBiome(temp, humidity, continentalness, erosion, weirdness, pv, dimension);
    return this.biomes.get(biomeType) || this.biomes.get(BiomeType.PLAINS)!;
  }

  private mapToBiome(
    temp: number, humidity: number, continentalness: number,
    erosion: number, weirdness: number, pv: number,
    dimension: DimensionType
  ): BiomeType {
    if (dimension === DimensionType.NETHER) {
      const netherBiomes = [BiomeType.NETHER_WASTES, BiomeType.SOUL_SAND_VALLEY, BiomeType.CRIMSON_FOREST, BiomeType.WARPED_FOREST, BiomeType.BASALT_DELTAS];
      const idx = Math.floor(Math.abs(weirdness) * netherBiomes.length) % netherBiomes.length;
      return netherBiomes[idx];
    }

    if (dimension === DimensionType.END) {
      return Math.abs(pv) > 0.5 ? BiomeType.END_HIGHLANDS : BiomeType.END_MIDLANDS;
    }

    const t = (temp + 1) * 0.5;
    const h = (humidity + 1) * 0.5;
    const c = (continentalness + 1) * 0.5;
    const e = (erosion + 1) * 0.5;

    if (c < 0.1) return BiomeType.OCEAN;
    if (c < 0.2) return BiomeType.DEEP_OCEAN;
    if (c < 0.3) return BiomeType.BEACH;
    if (h < 0.1) return BiomeType.DESERT;
    if (t < 0.2) return BiomeType.TAIGA;
    if (t < 0.3) {
      if (h > 0.6) return BiomeType.SWAMP;
      return BiomeType.FOREST;
    }
    if (t < 0.5) {
      if (h > 0.7) return BiomeType.JUNGLE;
      return BiomeType.FOREST;
    }
    if (t < 0.7) {
      if (h > 0.5) return BiomeType.JUNGLE;
      if (h < 0.2) return BiomeType.SAVANNA;
      return BiomeType.PLAINS;
    }
    if (h < 0.3) return BiomeType.DESERT;
    if (h < 0.6) return BiomeType.SAVANNA;
    return BiomeType.JUNGLE;
  }

  getAllBiomes(): BiomeConfig[] {
    return Array.from(this.biomes.values());
  }

  getBiomesForDimension(dimension: DimensionType): BiomeConfig[] {
    return Array.from(this.biomes.values()).filter(b => b.dimension === dimension);
  }
}

export class SimplexNoise {
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

export function createBiomeRegistry(seed: number): BiomeRegistry {
  return new BiomeRegistry(seed);
}

export const BIOME_REGISTRY: Record<BiomeType, BiomeConfig> = {} as any;
export const DIMENSION_REGISTRY: Record<DimensionType, DimensionConfig> = {} as any;