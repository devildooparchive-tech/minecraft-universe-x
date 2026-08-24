import * as THREE from 'three';
import { Chunk, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './chunk';
import { generateChunk } from './generation';
import { BlockType } from './block';
import { gameEvents } from '../core/events';
import { WorldPersistence, ChunkData } from '../persistence/types';

const LOAD_RADIUS = 3;
const UNLOAD_RADIUS = LOAD_RADIUS + 1;
const MAX_GENERATION_PER_FRAME = 3;
const MAX_BUILDS_PER_FRAME = 3;
const MODIFIED_CACHE_MAX = 64;
const RETRY_MS = 2000;

export class World {
  private loadedChunks: Map<string, Chunk> = new Map();
  private chunkMeshes: Map<string, THREE.Mesh> = new Map();

  private modifiedChunkKeys: Set<string> = new Set();
  private modifiedChunkCache: Map<string, ChunkData> = new Map();
  private pendingSaveKeys: Set<string> = new Set();
  private pendingSaveData: Map<string, ChunkData> = new Map();

  private seed = 12345;
  private scene!: THREE.Scene;
  private material: THREE.MeshLambertMaterial;
  private revision = 0;
  private disposed = false;

  private pendingGenerationQueue: string[] = [];
  private pendingGenerationSet: Set<string> = new Set();
  private pendingBuildsQueue: string[] = [];
  private pendingBuildsSet: Set<string> = new Set();
  private pendingChunkLoads: Map<string, Promise<void>> = new Map();
  private failedChunkRetryAt: Map<string, number> = new Map();

  constructor(private persistence: WorldPersistence) {
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  }

  setScene(scene: THREE.Scene) { this.scene = scene; }
  setSeed(seed: number) { this.seed = seed; }
  getSeed(): number { return this.seed; }
  getRevision(): number { return this.revision; }
  hasPendingPersistence(): boolean {
    return this.pendingSaveKeys.size > 0 || this.pendingSaveData.size > 0;
  }

  async initialize(seed: number, metadataKeys: string[]) {
    this.seed = seed;
    this.modifiedChunkKeys.clear();
    for (const key of metadataKeys) this.modifiedChunkKeys.add(key);

    try {
      const storedKeys = await this.persistence.loadAllModifiedChunkKeys();
      for (const key of storedKeys) this.modifiedChunkKeys.add(key);
    } catch (err) {
      console.warn('Could not load modified chunk keys from store, using metadata only.', err);
    }
  }

  getChunk(x: number, z: number): Chunk | undefined {
    return this.loadedChunks.get(`${x},${z}`);
  }

  getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
    const chunkX = Math.floor(worldX / CHUNK_SIZE_X);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE_Z);
    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk || !chunk.generated) return BlockType.Air;
    const localX = ((worldX % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const localZ = ((worldZ % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    return chunk.getBlock(localX, worldY, localZ);
  }

  getSurfaceHeight(worldX: number, worldZ: number): number {
    const chunkX = Math.floor(worldX / CHUNK_SIZE_X);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE_Z);
    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk || !chunk.generated) return 0;
    const localX = ((worldX % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const localZ = ((worldZ % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    for (let y = CHUNK_SIZE_Y - 1; y >= 0; y--) {
      const b = chunk.getBlock(localX, y, localZ);
      if (b !== BlockType.Air && b !== BlockType.Water) return y + 1;
    }
    return 0;
  }

  setBlock(worldX: number, worldY: number, worldZ: number, type: BlockType) {
    if (this.disposed) return;
    const chunkX = Math.floor(worldX / CHUNK_SIZE_X);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE_Z);
    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk) return;
    const localX = ((worldX % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const localZ = ((worldZ % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    if (chunk.getBlock(localX, worldY, localZ) === type) return;

    chunk.setBlock(localX, worldY, localZ, type);
    chunk.dirty = true;
    this.revision++;

    const key = `${chunk.x},${chunk.z}`;
    this.modifiedChunkKeys.add(key);
    this.pendingSaveKeys.add(key);

    // فقط إبطال الكاش، لا تسلسل فوري
    this.modifiedChunkCache.delete(key);
    this.pendingSaveData.delete(key);

    this.requestMeshRebuild(chunk);
    for (const neighbor of this.getAdjacentChunks(chunk)) {
      if (neighbor) this.requestMeshRebuild(neighbor);
    }
    gameEvents.emit('block-changed', { worldX, worldY, worldZ, type });
  }

  private cacheModifiedData(data: ChunkData) {
    const key = `${data.x},${data.z}`;
    this.modifiedChunkCache.delete(key);
    this.modifiedChunkCache.set(key, data);
    while (this.modifiedChunkCache.size > MODIFIED_CACHE_MAX) {
      const oldestKey = this.modifiedChunkCache.keys().next().value;
      if (oldestKey) this.modifiedChunkCache.delete(oldestKey);
    }
  }

  /**
   * Clears dirty flags for all loaded chunks.
   * Safety net only; flushPendingChunks already clears dirty with dirtyRevision.
   */
  clearDirtyFlags() {
    for (const chunk of this.loadedChunks.values()) {
      chunk.dirty = false;
    }
  }

  /**
   * Load chunk data from persistence (for save loading).
   * Public method for Game to call during save restoration.
   */
  loadChunkFromSave(key: string, chunkData: ChunkData): void {
    const chunk = Chunk.deserialize(chunkData.x, chunkData.z, chunkData.data);
    this.instantiateChunk(chunk);
  }

  async flushPendingChunks(): Promise<void> {
    if (this.disposed) return;
    const keysToFlush = Array.from(this.pendingSaveKeys);
    if (keysToFlush.length === 0) return;

    const batch: ChunkData[] = [];
    const savedFromPendingData = new Map<string, ChunkData>();
    const dirtySnapshot = new Map<string, number>();

    for (const key of keysToFlush) {
      const chunk = this.loadedChunks.get(key);
      if (chunk && chunk.dirty) {
        dirtySnapshot.set(key, chunk.dirtyRevision);
        const data: ChunkData = { x: chunk.x, z: chunk.z, data: chunk.serialize() };
        batch.push(data);
        this.cacheModifiedData(data);
        this.pendingSaveData.delete(key);
      } else if (this.pendingSaveData.has(key)) {
        const data = this.pendingSaveData.get(key)!;
        batch.push(data);
        this.cacheModifiedData(data);
        savedFromPendingData.set(key, data);
      } else {
        console.warn(`No data for pending chunk ${key}`);
      }
    }

    if (batch.length > 0) {
      await this.persistence.saveChunks(batch);
    }

    for (const key of keysToFlush) {
      const chunk = this.loadedChunks.get(key);

      const snapshotRev = dirtySnapshot.get(key);
      if (chunk && snapshotRev !== undefined) {
        if (chunk.dirtyRevision === snapshotRev) {
          chunk.dirty = false;
        } else {
          continue; // تعديل جديد أثناء الحفظ
        }
      }

      const savedData = savedFromPendingData.get(key);
      if (savedData && this.pendingSaveData.get(key) === savedData) {
        this.pendingSaveData.delete(key);
      }

      if (!this.pendingSaveData.has(key)) {
        this.pendingSaveKeys.delete(key);
      }
    }
  }

  getModifiedChunkKeys(): string[] {
    return Array.from(this.modifiedChunkKeys);
  }

  isSpawnChunkReady(worldX: number, worldZ: number): boolean {
    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);
    const required = [
      [cx, cz],
      [cx - 1, cz],
      [cx + 1, cz],
      [cx, cz - 1],
      [cx, cz + 1],
    ];
    for (const [x, z] of required) {
      const key = `${x},${z}`;
      const chunk = this.loadedChunks.get(key);
      if (!chunk || !chunk.generated) return false;
    }
    return true;
  }

  update(playerPos: THREE.Vector3) {
    if (this.disposed) return;
    const playerChunkX = Math.floor(playerPos.x / CHUNK_SIZE_X);
    const playerChunkZ = Math.floor(playerPos.z / CHUNK_SIZE_Z);

    const now = performance.now();
    for (const [key, retryAt] of this.failedChunkRetryAt) {
      if (now >= retryAt) {
        this.failedChunkRetryAt.delete(key);
        const [cx, cz] = key.split(',').map(Number);
        const dx = cx - playerChunkX;
        const dz = cz - playerChunkZ;
        if (dx * dx + dz * dz <= LOAD_RADIUS * LOAD_RADIUS) {
          this.pendingGenerationSet.add(key);
          this.pendingGenerationQueue.push(key);
        }
      }
    }

    const requested: { cx: number; cz: number; dist: number }[] = [];
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
      for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
        const cx = playerChunkX + dx;
        const cz = playerChunkZ + dz;
        requested.push({ cx, cz, dist: dx * dx + dz * dz });
      }
    }
    requested.sort((a, b) => a.dist - b.dist);

    for (const { cx, cz } of requested) {
      const key = `${cx},${cz}`;
      if (!this.loadedChunks.has(key) && !this.pendingGenerationSet.has(key) && !this.failedChunkRetryAt.has(key)) {
        this.pendingGenerationSet.add(key);
        this.pendingGenerationQueue.push(key);
      }
    }

    let genCount = 0;
    while (this.pendingGenerationQueue.length > 0 && genCount < MAX_GENERATION_PER_FRAME) {
      const key = this.pendingGenerationQueue.shift()!;
      this.pendingGenerationSet.delete(key);
      const [cx, cz] = key.split(',').map(Number);
      this.loadChunkData(cx, cz);
      genCount++;
    }

    const keysToRemove: string[] = [];
    for (const key of this.loadedChunks.keys()) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - playerChunkX;
      const dz = cz - playerChunkZ;
      if (dx * dx + dz * dz > UNLOAD_RADIUS * UNLOAD_RADIUS) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) this.unloadChunk(key);

    let buildCount = 0;
    while (this.pendingBuildsQueue.length > 0 && buildCount < MAX_BUILDS_PER_FRAME) {
      const key = this.pendingBuildsQueue.shift()!;
      this.pendingBuildsSet.delete(key);
      const [cx, cz] = key.split(',').map(Number);
      const chunk = this.getChunk(cx, cz);
      if (chunk && chunk.generated && !this.chunkMeshes.has(key)) {
        this.buildChunkMesh(chunk);
        buildCount++;
      }
    }
  }

  private loadChunkData(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    if (this.loadedChunks.has(key) || this.pendingChunkLoads.has(key)) return;

    if (this.modifiedChunkKeys.has(key)) {
      const cached = this.modifiedChunkCache.get(key);
      if (cached) {
        this.cacheModifiedData(cached);
        const chunk = Chunk.deserialize(cached.x, cached.z, cached.data);
        if (this.pendingSaveData.has(key)) {
          chunk.dirty = true;
        }
        this.instantiateChunk(chunk);
        return;
      }

      if (this.pendingSaveData.has(key)) {
        const data = this.pendingSaveData.get(key)!;
        const chunk = Chunk.deserialize(data.x, data.z, data.data);
        chunk.dirty = true;
        this.pendingSaveData.delete(key);
        this.cacheModifiedData(data);
        this.instantiateChunk(chunk);
        return;
      }

      const promise = this.persistence.loadChunk(cx, cz)
        .then((data) => {
          this.pendingChunkLoads.delete(key);
          if (this.disposed) return;
          if (data) {
            this.cacheModifiedData(data);
            this.failedChunkRetryAt.delete(key);
            this.instantiateChunk(Chunk.deserialize(data.x, data.z, data.data));
          } else {
            console.error(`Corruption: chunk ${key} marked modified but data missing.`);
            this.failedChunkRetryAt.set(key, performance.now() + RETRY_MS);
          }
        })
        .catch((err) => {
          console.error(`Failed to load modified chunk ${key}`, err);
          this.pendingChunkLoads.delete(key);
          if (this.disposed) return;
          this.failedChunkRetryAt.set(key, performance.now() + RETRY_MS);
        });

      this.pendingChunkLoads.set(key, promise);
    } else {
      this.generateAndInstantiate(cx, cz);
    }
  }

  private generateAndInstantiate(cx: number, cz: number) {
    const chunk = new Chunk(cx, cz);
    generateChunk(chunk, this.seed);
    this.instantiateChunk(chunk);
  }

  private instantiateChunk(chunk: Chunk) {
    if (this.disposed) return;
    const key = `${chunk.x},${chunk.z}`;
    if (this.loadedChunks.has(key)) return;
    this.loadedChunks.set(key, chunk);

    for (const neighbor of this.getAdjacentChunks(chunk)) {
      if (neighbor) this.requestMeshRebuild(neighbor);
    }

    if (!this.pendingBuildsSet.has(key)) {
      this.pendingBuildsQueue.push(key);
      this.pendingBuildsSet.add(key);
    }
  }

  private unloadChunk(key: string) {
    const chunk = this.loadedChunks.get(key);
    if (chunk) {
      if (chunk.dirty) {
        const data: ChunkData = { x: chunk.x, z: chunk.z, data: chunk.serialize() };
        this.pendingSaveData.set(key, data);
        this.cacheModifiedData(data);
        this.pendingSaveKeys.add(key);
      }
      this.loadedChunks.delete(key);
    }

    const mesh = this.chunkMeshes.get(key);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.chunkMeshes.delete(key);
    }

    const [cx, cz] = key.split(',').map(Number);
    const neighbors = [
      this.getChunk(cx - 1, cz),
      this.getChunk(cx + 1, cz),
      this.getChunk(cx, cz - 1),
      this.getChunk(cx, cz + 1),
    ];
    for (const neighbor of neighbors) {
      if (neighbor) this.requestMeshRebuild(neighbor);
    }
  }

  private requestMeshRebuild(chunk: Chunk) {
    const key = `${chunk.x},${chunk.z}`;
    const oldMesh = this.chunkMeshes.get(key);
    if (oldMesh) {
      this.scene.remove(oldMesh);
      oldMesh.geometry.dispose();
      this.chunkMeshes.delete(key);
    }
    if (!this.pendingBuildsSet.has(key)) {
      this.pendingBuildsQueue.push(key);
      this.pendingBuildsSet.add(key);
    }
  }

  private getAdjacentChunks(chunk: Chunk): (Chunk | undefined)[] {
    return [
      this.getChunk(chunk.x - 1, chunk.z),
      this.getChunk(chunk.x + 1, chunk.z),
      this.getChunk(chunk.x, chunk.z - 1),
      this.getChunk(chunk.x, chunk.z + 1),
    ];
  }

  private buildChunkMesh(chunk: Chunk) {
    const geometry = this.createChunkGeometry(chunk);
    if (geometry.attributes.position.count === 0) return;
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(chunk.x * CHUNK_SIZE_X, 0, chunk.z * CHUNK_SIZE_Z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.chunkMeshes.set(`${chunk.x},${chunk.z}`, mesh);
  }

  private createChunkGeometry(chunk: Chunk): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const colorMap: Record<number, number> = {
      [BlockType.Air]: 0x000000,
      [BlockType.Grass]: 0x7c9c6e,
      [BlockType.Dirt]: 0x8b5a2b,
      [BlockType.Stone]: 0x888888,
      [BlockType.Sand]: 0xe6d9a8,
      [BlockType.Wood]: 0x6b4226,
      [BlockType.Leaves]: 0x2e8b57,
      [BlockType.Water]: 0x3b6fd4,
      [BlockType.Bedrock]: 0x1a1a1a,
      [BlockType.CoalOre]: 0x3a3a3a,
      [BlockType.IronOre]: 0x8b6b4a,
      [BlockType.GoldOre]: 0xccaa44,
      [BlockType.DiamondOre]: 0x44cccc,
      [BlockType.RedstoneOre]: 0xcc4444,
      [BlockType.LapisOre]: 0x4444cc,
      [BlockType.EmeraldOre]: 0x44cc44,
      [BlockType.QuartzOre]: 0xaaaaaa,
      [BlockType.Cobblestone]: 0x666666,
      [BlockType.StoneBricks]: 0x7a7a7a,
      [BlockType.Deepslate]: 0x4a4a4a,
      [BlockType.Netherrack]: 0x8b3a3a,
      [BlockType.SoulSand]: 0x9c7a5a,
      [BlockType.SoulSoil]: 0x7a5a4a,
      [BlockType.Basalt]: 0x2a2a2a,
      [BlockType.Blackstone]: 0x1a1a2a,
      [BlockType.CrimsonNylium]: 0xaa3a3a,
      [BlockType.WarpedNylium]: 0x3aaa8a,
      [BlockType.NetherGoldOre]: 0xccaa44,
      [BlockType.NetherQuartzOre]: 0xaaaaaa,
      [BlockType.AncientDebris]: 0x4a3a2a,
      [BlockType.EndStone]: 0xeeeecc,
      [BlockType.EndStoneBricks]: 0xccccaa,
      [BlockType.PurpurBlock]: 0xaa8acc,
      [BlockType.ChorusPlant]: 0x8a6a8a,
      [BlockType.ChorusFlower]: 0xaa8acc,
      [BlockType.Glass]: 0xaacccc,
      [BlockType.TNT]: 0xcc2222,
      [BlockType.Bookshelf]: 0x8b6b4a,
      [BlockType.CraftingTable]: 0x6b4226,
      [BlockType.Furnace]: 0x5a5a5a,
      [BlockType.Chest]: 0x8b5a2b,
      [BlockType.TallGrass]: 0x4a8a3a,
      [BlockType.Fern]: 0x3a7a3a,
      [BlockType.DeadBush]: 0x8a7a4a,
      [BlockType.Cactus]: 0x3a8a3a,
      [BlockType.SugarCane]: 0x4a8a3a,
      [BlockType.Kelp]: 0x2a6a2a,
      [BlockType.Seagrass]: 0x3a7a3a,
      [BlockType.Dandelion]: 0xcccc22,
      [BlockType.Poppy]: 0xcc2222,
      [BlockType.BlueOrchid]: 0x4488cc,
      [BlockType.Allium]: 0xaa44cc,
      [BlockType.AzureBluet]: 0x88aacc,
      [BlockType.RedTulip]: 0xcc4444,
      [BlockType.OrangeTulip]: 0xcc8822,
      [BlockType.WhiteTulip]: 0xeeeeee,
      [BlockType.PinkTulip]: 0xcc88aa,
      [BlockType.OxeyeDaisy]: 0xeeee22,
      [BlockType.Cornflower]: 0x4466cc,
      [BlockType.LilyOfTheValley]: 0xeeeeee,
      [BlockType.WitherRose]: 0x221111,
      [BlockType.Wheat]: 0xaaaa44,
      [BlockType.Carrots]: 0xcc6622,
      [BlockType.Potatoes]: 0xccaa66,
      [BlockType.Beetroots]: 0xaa2222,
      [BlockType.BrownMushroom]: 0x8a7a5a,
      [BlockType.RedMushroom]: 0xaa3a3a,
      [BlockType.Vine]: 0x2a7a2a,
      [BlockType.Ladder]: 0x6b4226,
      [BlockType.Rail]: 0x5a5a5a,
      [BlockType.PoweredRail]: 0xaa8822,
      [BlockType.DetectorRail]: 0xaa6622,
      [BlockType.ActivatorRail]: 0xaa4422,
      [BlockType.RedstoneWire]: 0xcc2222,
      [BlockType.RedstoneTorch]: 0xcc2222,
      [BlockType.RedstoneBlock]: 0xcc2222,
      [BlockType.RedstoneRepeater]: 0xaa4422,
      [BlockType.RedstoneComparator]: 0xaa4422,
      [BlockType.Piston]: 0x8b6b4a,
      [BlockType.StickyPiston]: 0x4a7a4a,
      [BlockType.OakDoor]: 0x6b4226,
      [BlockType.IronDoor]: 0x888888,
      [BlockType.StonePressurePlate]: 0x888888,
      [BlockType.WoodenPressurePlate]: 0x6b4226,
      [BlockType.StoneButton]: 0x888888,
      [BlockType.WoodenButton]: 0x6b4226,
      [BlockType.OakTrapdoor]: 0x6b4226,
      [BlockType.IronTrapdoor]: 0x888888,
      [BlockType.OakFence]: 0x6b4226,
      [BlockType.OakFenceGate]: 0x6b4226,
      [BlockType.CobblestoneWall]: 0x666666,
      [BlockType.StoneStairs]: 0x888888,
      [BlockType.StoneSlab]: 0x888888,
      [BlockType.Lantern]: 0xccaa44,
      [BlockType.SoulLantern]: 0x66aacc,
      [BlockType.Glowstone]: 0xeeee66,
      [BlockType.Shroomlight]: 0xcc8844,
      [BlockType.SeaLantern]: 0x88eeee,
      [BlockType.Conduit]: 0x44aacc,
      [BlockType.Beacon]: 0x88eeee,
      [BlockType.EnchantingTable]: 0x4444aa,
      [BlockType.Anvil]: 0x5a5a5a,
      [BlockType.Grindstone]: 0x6b4226,
      [BlockType.SmithingTable]: 0x6b4226,
      [BlockType.Stonecutter]: 0x888888,
      [BlockType.Loom]: 0x6b4226,
      [BlockType.CartographyTable]: 0x6b4226,
      [BlockType.Composter]: 0x6b4226,
      [BlockType.Barrel]: 0x6b4226,
      [BlockType.BlastFurnace]: 0x5a5a5a,
      [BlockType.Smoker]: 0x5a5a5a,
      [BlockType.Campfire]: 0xaa6622,
      [BlockType.SoulCampfire]: 0x66aacc,
      [BlockType.Target]: 0xcc6622,
      [BlockType.LightningRod]: 0xcc8844,
      [BlockType.CopperBlock]: 0xcc8844,
      [BlockType.ExposedCopper]: 0x88aacc,
      [BlockType.WeatheredCopper]: 0x6699aa,
      [BlockType.OxidizedCopper]: 0x4488aa,
      [BlockType.WaxedCopperBlock]: 0xcc8844,
      [BlockType.WaxedExposedCopper]: 0x88aacc,
      [BlockType.WaxedWeatheredCopper]: 0x6699aa,
      [BlockType.WaxedOxidizedCopper]: 0x4488aa,
      [BlockType.AmethystBlock]: 0xaa66cc,
      [BlockType.BuddingAmethyst]: 0xaa66cc,
      [BlockType.AmethystCluster]: 0xcc88ee,
      [BlockType.Calcite]: 0xeeeecc,
      [BlockType.Tuff]: 0x6a6a6a,
      [BlockType.DripstoneBlock]: 0xaa9988,
      [BlockType.PointedDripstone]: 0xaa9988,
      [BlockType.Sculk]: 0x1a1a2a,
      [BlockType.SculkVein]: 0x2a2a4a,
      [BlockType.SculkCatalyst]: 0x1a1a3a,
      [BlockType.SculkShrieker]: 0x1a1a2a,
      [BlockType.SculkSensor]: 0x2a2a4a,
      [BlockType.Mud]: 0x6a5a4a,
      [BlockType.PackedMud]: 0x5a4a3a,
      [BlockType.MudBricks]: 0x7a6a5a,
      [BlockType.MangroveRoots]: 0x4a3a2a,
      [BlockType.MuddyMangroveRoots]: 0x3a2a2a,
      [BlockType.ReinforcedDeepslate]: 0x2a2a2a,
    };

    const faces = [
      { dir: [0,1,0], corners: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], normal: [0,1,0] },
      { dir: [0,-1,0], corners: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]], normal: [0,-1,0] },
      { dir: [0,0,1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], normal: [0,0,1] },
      { dir: [0,0,-1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], normal: [0,0,-1] },
      { dir: [-1,0,0], corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], normal: [-1,0,0] },
      { dir: [1,0,0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], normal: [1,0,0] },
    ];

    let vertexCount = 0;
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
          const block = chunk.getBlock(lx, ly, lz);
          if (block === BlockType.Air) continue;
          const worldX = chunk.x * CHUNK_SIZE_X + lx;
          const worldY = ly;
          const worldZ = chunk.z * CHUNK_SIZE_Z + lz;

          for (const face of faces) {
            const nx = worldX + face.dir[0];
            const ny = worldY + face.dir[1];
            const nz = worldZ + face.dir[2];
            const neighbor = this.getBlock(nx, ny, nz);
            if (neighbor === BlockType.Air || neighbor === BlockType.Water) {
              const color = colorMap[block];
              const r = (color >> 16) & 0xff;
              const g = (color >> 8) & 0xff;
              const b = color & 0xff;
              const baseIndex = vertexCount;
              for (const corner of face.corners) {
                positions.push(lx + corner[0], ly + corner[1], lz + corner[2]);
                normals.push(...face.normal);
                colors.push(r/255, g/255, b/255);
                vertexCount++;
              }
              indices.push(baseIndex, baseIndex+1, baseIndex+2, baseIndex, baseIndex+2, baseIndex+3);
            }
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  raycastBlock(origin: THREE.Vector3, direction: THREE.Vector3, maxDist = 10): { worldX: number, worldY: number, worldZ: number, face: number[] } | null {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = direction.x > 0 ? 1 : -1;
    const stepY = direction.y > 0 ? 1 : -1;
    const stepZ = direction.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / direction.x);
    const tDeltaY = Math.abs(1 / direction.y);
    const tDeltaZ = Math.abs(1 / direction.z);
    let tMaxX = direction.x !== 0 ? ((stepX > 0 ? (x+1-origin.x) : (origin.x-x)) * tDeltaX) : Infinity;
    let tMaxY = direction.y !== 0 ? ((stepY > 0 ? (y+1-origin.y) : (origin.y-y)) * tDeltaY) : Infinity;
    let tMaxZ = direction.z !== 0 ? ((stepZ > 0 ? (z+1-origin.z) : (origin.z-z)) * tDeltaZ) : Infinity;

    let face = [0,0,0];
    let t = 0;
    while (t <= maxDist) {
      const block = this.getBlock(x, y, z);
      if (block !== BlockType.Air && block !== BlockType.Water) {
        return { worldX: x, worldY: y, worldZ: z, face };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0];
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ];
      }
    }
    return null;
  }

  dispose() {
    this.disposed = true;
    for (const mesh of this.chunkMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunkMeshes.clear();
    this.material.dispose();
    this.loadedChunks.clear();
    this.modifiedChunkCache.clear();
    this.modifiedChunkKeys.clear();
    this.pendingSaveKeys.clear();
    this.pendingSaveData.clear();
    this.pendingGenerationQueue.length = 0;
    this.pendingGenerationSet.clear();
    this.pendingBuildsQueue.length = 0;
    this.pendingBuildsSet.clear();
    this.pendingChunkLoads.clear();
    this.failedChunkRetryAt.clear();
  }
}