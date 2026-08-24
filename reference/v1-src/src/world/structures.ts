import * as THREE from 'three';
import { Chunk, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './chunk';
import { BlockType } from './block';
import { BiomeType, DimensionType } from './biomes';

export interface StructureTemplate {
  id: string;
  name: string;
  size: THREE.Vector3;
  blocks: StructureBlock[];
  connectionPoints: ConnectionPoint[];
  weight: number;
  biomeTags: string[];
  dimensionTags: string[];
}

export interface StructureBlock {
  x: number;
  y: number;
  z: number;
  blockType: number;
  state?: Record<string, any>;
  nbt?: string;
}

export interface ConnectionPoint {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  type: 'entrance' | 'hallway' | 'room' | 'stairs' | 'tower';
}

export interface PlacedStructure {
  template: StructureTemplate;
  position: THREE.Vector3;
  rotation: number;
  mirror: boolean;
  boundingBox: THREE.Box3;
  blocks: StructureBlock[];
}

export class StructureGenerator {
  private templates: Map<string, StructureTemplate> = new Map();
  private placedStructures: Map<string, PlacedStructure[]> = new Map();
  private structureNoise: any;

  constructor(seed: number) {
    this.structureNoise = new SimplexNoise(seed + 100);
    this.registerVanillaStructures();
  }

  private registerVanillaStructures(): void {
    const structures: StructureTemplate[] = [
      this.createVillageTemplate(),
      this.createDesertTempleTemplate(),
      this.createJungleTempleTemplate(),
      this.createWitchHutTemplate(),
      this.createPillagerOutpostTemplate(),
      this.createRuinedPortalTemplate(),
      this.createNetherFortressTemplate(),
      this.createBastionRemnantTemplate(),
      this.createEndCityTemplate(),
      this.createOceanRuinsTemplate(),
      this.createShipwreckTemplate(),
      this.createBuriedTreasureTemplate(),
      this.createWoodlandMansionTemplate(),
    ];

    for (const template of structures) {
      this.templates.set(template.id, template);
    }
  }

  private createVillageTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        if (Math.abs(x) === 5 || Math.abs(z) === 5) {
          for (let y = 0; y <= 3; y++) {
            blocks.push({ x, y, z, blockType: 5 });
          }
        }
      }
    }

    for (let y = 0; y <= 3; y++) {
      blocks.push({ x: 0, y, z: 0, blockType: 5 });
    }

    return {
      id: 'village_house',
      name: 'Village House',
      size: new THREE.Vector3(11, 5, 11),
      blocks,
      connectionPoints: [
        { position: new THREE.Vector3(0, 1, -5), direction: new THREE.Vector3(0, 0, -1), type: 'entrance' },
      ],
      weight: 10,
      biomeTags: ['plains', 'savanna', 'taiga', 'desert'],
      dimensionTags: ['overworld'],
    };
  }

  private createDesertTempleTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -10; x <= 10; x++) {
      for (let z = -10; z <= 10; z++) {
        if (Math.abs(x) === 10 || Math.abs(z) === 10) {
          for (let y = 0; y <= 8; y++) {
            blocks.push({ x, y, z, blockType: 4 });
          }
        }
      }
    }

    for (let x = -10; x <= 10; x++) {
      for (let z = -10; z <= 10; z++) {
        blocks.push({ x, y: 8, z, blockType: 4 });
      }
    }

    return {
      id: 'desert_temple',
      name: 'Desert Temple',
      size: new THREE.Vector3(21, 9, 21),
      blocks,
      connectionPoints: [
        { position: new THREE.Vector3(0, 1, -10), direction: new THREE.Vector3(0, 0, -1), type: 'entrance' },
      ],
      weight: 3,
      biomeTags: ['desert'],
      dimensionTags: ['overworld'],
    };
  }

  private createJungleTempleTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -6; x <= 6; x++) {
      for (let z = -6; z <= 6; z++) {
        if (Math.abs(x) === 6 || Math.abs(z) === 6) {
          for (let y = 0; y <= 6; y++) {
            blocks.push({ x, y, z, blockType: 3 });
          }
        }
      }
    }

    return {
      id: 'jungle_temple',
      name: 'Jungle Temple',
      size: new THREE.Vector3(13, 7, 13),
      blocks,
      connectionPoints: [
        { position: new THREE.Vector3(0, 1, -6), direction: new THREE.Vector3(0, 0, -1), type: 'entrance' },
      ],
      weight: 2,
      biomeTags: ['jungle'],
      dimensionTags: ['overworld'],
    };
  }

  private createWitchHutTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        if (Math.abs(x) === 3 || Math.abs(z) === 3) {
          for (let y = 0; y <= 4; y++) {
            blocks.push({ x, y, z, blockType: 126 });
          }
        }
      }
    }

    return {
      id: 'witch_hut',
      name: 'Witch Hut',
      size: new THREE.Vector3(7, 5, 7),
      blocks,
      connectionPoints: [
        { position: new THREE.Vector3(0, 1, -3), direction: new THREE.Vector3(0, 0, -1), type: 'entrance' },
      ],
      weight: 2,
      biomeTags: ['swamp'],
      dimensionTags: ['overworld'],
    };
  }

  private createPillagerOutpostTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        if (Math.abs(x) === 4 || Math.abs(z) === 4) {
          for (let y = 0; y <= 12; y++) {
            blocks.push({ x, y, z, blockType: 5 });
          }
        }
      }
    }

    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        blocks.push({ x, y: 12, z, blockType: 5 });
      }
    }

    return {
      id: 'pillager_outpost',
      name: 'Pillager Outpost',
      size: new THREE.Vector3(9, 13, 9),
      blocks,
      connectionPoints: [
        { position: new THREE.Vector3(0, 1, -4), direction: new THREE.Vector3(0, 0, -1), type: 'entrance' },
      ],
      weight: 3,
      biomeTags: ['plains', 'savanna', 'taiga', 'desert', 'forest'],
      dimensionTags: ['overworld'],
    };
  }

  private createRuinedPortalTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let y = 0; y <= 3; y++) {
      blocks.push({ x: -2, y, z: 0, blockType: 93 });
      blocks.push({ x: 2, y, z: 0, blockType: 93 });
    }
    for (let x = -2; x <= 2; x++) {
      blocks.push({ x, y: 3, z: 0, blockType: 93 });
    }

    return {
      id: 'ruined_portal',
      name: 'Ruined Portal',
      size: new THREE.Vector3(5, 5, 3),
      blocks,
      connectionPoints: [],
      weight: 5,
      biomeTags: ['plains', 'desert', 'forest', 'taiga', 'savanna', 'jungle', 'swamp', 'mountains', 'beach'],
      dimensionTags: ['overworld', 'nether'],
    };
  }

  private createNetherFortressTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -15; x <= 15; x += 10) {
      for (let z = -15; z <= 15; z += 10) {
        for (let y = 0; y <= 6; y++) {
          blocks.push({ x, y, z, blockType: 87 });
        }
      }
    }

    return {
      id: 'nether_fortress',
      name: 'Nether Fortress',
      size: new THREE.Vector3(31, 7, 31),
      blocks,
      connectionPoints: [
        { position: new THREE.Vector3(0, 1, -15), direction: new THREE.Vector3(0, 0, -1), type: 'entrance' },
        { position: new THREE.Vector3(0, 1, 15), direction: new THREE.Vector3(0, 0, 1), type: 'entrance' },
      ],
      weight: 2,
      biomeTags: ['nether_wastes', 'soul_sand_valley'],
      dimensionTags: ['nether'],
    };
  }

  private createBastionRemnantTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -20; x <= 20; x++) {
      for (let z = -20; z <= 20; z++) {
        if (Math.abs(x) === 20 || Math.abs(z) === 20) {
          for (let y = 0; y <= 15; y++) {
            blocks.push({ x, y, z, blockType: 115 });
          }
        }
      }
    }

    return {
      id: 'bastion_remnant',
      name: 'Bastion Remnant',
      size: new THREE.Vector3(41, 16, 41),
      blocks,
      connectionPoints: [
        { position: new THREE.Vector3(0, 1, -20), direction: new THREE.Vector3(0, 0, -1), type: 'entrance' },
      ],
      weight: 2,
      biomeTags: ['nether_wastes', 'soul_sand_valley', 'crimson_forest', 'warped_forest', 'basalt_deltas'],
      dimensionTags: ['nether'],
    };
  }

  private createEndCityTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -8; x <= 8; x++) {
      for (let z = -8; z <= 8; z++) {
        if (Math.abs(x) === 8 || Math.abs(z) === 8) {
          for (let y = 0; y <= 20; y++) {
            blocks.push({ x, y, z, blockType: 93 });
          }
        }
      }
    }

    return {
      id: 'end_city',
      name: 'End City',
      size: new THREE.Vector3(17, 21, 17),
      blocks,
      connectionPoints: [
        { position: new THREE.Vector3(0, 1, -8), direction: new THREE.Vector3(0, 0, -1), type: 'entrance' },
      ],
      weight: 2,
      biomeTags: ['end_highlands'],
      dimensionTags: ['end'],
    };
  }

  private createOceanRuinsTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        if (Math.abs(x) === 5 || Math.abs(z) === 5) {
          for (let y = 0; y <= 3; y++) {
            blocks.push({ x, y, z, blockType: 3 });
          }
        }
      }
    }

    return {
      id: 'ocean_ruins',
      name: 'Ocean Ruins',
      size: new THREE.Vector3(11, 4, 11),
      blocks,
      connectionPoints: [],
      weight: 4,
      biomeTags: ['ocean', 'deep_ocean'],
      dimensionTags: ['overworld'],
    };
  }

  private createShipwreckTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -2; x <= 2; x++) {
      for (let z = -8; z <= 8; z++) {
        for (let y = 0; y <= 2; y++) {
          blocks.push({ x, y, z, blockType: 5 });
        }
      }
    }

    return {
      id: 'shipwreck',
      name: 'Shipwreck',
      size: new THREE.Vector3(5, 3, 17),
      blocks,
      connectionPoints: [],
      weight: 3,
      biomeTags: ['ocean', 'deep_ocean', 'beach'],
      dimensionTags: ['overworld'],
    };
  }

  private createBuriedTreasureTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    blocks.push({ x: 0, y: 0, z: 0, blockType: 54 });

    return {
      id: 'buried_treasure',
      name: 'Buried Treasure',
      size: new THREE.Vector3(1, 1, 1),
      blocks,
      connectionPoints: [],
      weight: 3,
      biomeTags: ['beach', 'ocean'],
      dimensionTags: ['overworld'],
    };
  }

  private createWoodlandMansionTemplate(): StructureTemplate {
    const blocks: StructureBlock[] = [];
    
    for (let x = -15; x <= 15; x++) {
      for (let z = -15; z <= 15; z++) {
        if (Math.abs(x) === 15 || Math.abs(z) === 15) {
          for (let y = 0; y <= 12; y++) {
            blocks.push({ x, y, z, blockType: 5 });
          }
        }
      }
    }

    return {
      id: 'woodland_mansion',
      name: 'Woodland Mansion',
      size: new THREE.Vector3(31, 13, 31),
      blocks,
      connectionPoints: [
        { position: new THREE.Vector3(0, 1, -15), direction: new THREE.Vector3(0, 0, -1), type: 'entrance' },
      ],
      weight: 1,
      biomeTags: ['forest'],
      dimensionTags: ['overworld'],
    };
  }

  generateInChunk(chunk: Chunk, worldX: number, worldZ: number, dimension: DimensionType): void {
    const chunkKey = `${chunk.x},${chunk.z}`;
    
    if (!this.placedStructures.has(chunkKey)) {
      this.placedStructures.set(chunkKey, []);
    }

    const biome = this.getBiomeAtWorld(worldX, worldZ, dimension);
    const applicableTemplates = this.getApplicableTemplates(biome, dimension);

    for (const template of applicableTemplates) {
      if (this.shouldGenerateStructure(template, worldX, worldZ)) {
        const position = this.getStructurePosition(template, worldX, worldZ);
        this.placeStructure(chunk, template, position);
      }
    }
  }

  private getBiomeAtWorld(worldX: number, worldZ: number, dimension: DimensionType): BiomeType {
    const temp = this.structureNoise.noise2D(worldX * 0.01, worldZ * 0.01);
    const humidity = this.structureNoise.noise2D(worldX * 0.01 + 1000, worldZ * 0.01 + 1000);
    const continentalness = this.structureNoise.noise2D(worldX * 0.005, worldZ * 0.005);
    const erosion = this.structureNoise.noise2D(worldX * 0.008, worldZ * 0.008);
    const weirdness = this.structureNoise.noise2D(worldX * 0.02, worldZ * 0.02);
    const pv = this.structureNoise.noise2D(worldX * 0.015, worldZ * 0.015);

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

  private getApplicableTemplates(biome: BiomeType, dimension: DimensionType): StructureTemplate[] {
    return Array.from(this.templates.values()).filter(template => 
      template.biomeTags.some(tag => this.biomeMatches(tag, biome)) &&
      template.dimensionTags.includes(dimension)
    );
  }

  private biomeMatches(tag: string, biome: BiomeType): boolean {
    const biomeStr = biome.toString();
    return biomeStr.includes(tag) || tag === biomeStr;
  }

  private shouldGenerateStructure(template: StructureTemplate, worldX: number, worldZ: number): boolean {
    const noise = this.structureNoise.noise2D(worldX * 0.001, worldZ * 0.001);
    const threshold = 1 / (template.weight * 100);
    return Math.abs(noise) < threshold;
  }

  private getStructurePosition(template: StructureTemplate, worldX: number, worldZ: number): THREE.Vector3 {
    const offsetX = (this.structureNoise.noise2D(worldX * 0.01, worldZ * 0.01) + 1) * 0.5 * CHUNK_SIZE_X;
    const offsetZ = (this.structureNoise.noise2D(worldX * 0.01 + 500, worldZ * 0.01 + 500) + 1) * 0.5 * CHUNK_SIZE_Z;
    
    return new THREE.Vector3(
      worldX + offsetX - template.size.x / 2,
      0,
      worldZ + offsetZ - template.size.z / 2
    );
  }

  private placeStructure(chunk: Chunk, template: StructureTemplate, position: THREE.Vector3): void {
    const minX = Math.floor(position.x);
    const minZ = Math.floor(position.z);
    const maxX = minX + template.size.x;
    const maxZ = minZ + template.size.z;

    if (minX < chunk.x * CHUNK_SIZE_X || maxX > (chunk.x + 1) * CHUNK_SIZE_X ||
        minZ < chunk.z * CHUNK_SIZE_Z || maxZ > (chunk.z + 1) * CHUNK_SIZE_Z) {
      return;
    }

    for (const block of template.blocks) {
      const blockX = minX + block.x;
      const blockY = block.y;
      const blockZ = minZ + block.z;

      if (blockX < 0 || blockX >= CHUNK_SIZE_X || 
          blockY < 0 || blockY >= CHUNK_SIZE_Y ||
          blockZ < 0 || blockZ >= CHUNK_SIZE_Z) {
        continue;
      }

      chunk.setBlock(blockX, blockY, blockZ, block.blockType);
    }

    const placed: PlacedStructure = {
      template,
      position: position.clone(),
      rotation: 0,
      mirror: false,
      boundingBox: new THREE.Box3(
        new THREE.Vector3(minX, 0, minZ),
        new THREE.Vector3(maxX, template.size.y, maxZ)
      ),
      blocks: [...template.blocks],
    };

    this.placedStructures.get(`${chunk.x},${chunk.z}`)!.push(placed);
  }

  getPlacedStructuresInChunk(chunkX: number, chunkZ: number): PlacedStructure[] {
    return this.placedStructures.get(`${chunkX},${chunkZ}`) || [];
  }

  getTemplate(id: string): StructureTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): StructureTemplate[] {
    return Array.from(this.templates.values());
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
}

export function createStructureGenerator(seed: number): StructureGenerator {
  return new StructureGenerator(seed);
}