import * as THREE from 'three';
import { GameLoop } from './loop';
import { Renderer } from '../renderer/scene';
import { World } from '../world/world';
import { Player } from '../player/player';
import { InputManager } from '../player/input';
import { PlayerController } from '../player/controller';
import { HUD } from '../ui/hud';
import { gameEvents } from './events';
import { SaveManager } from '../persistence/db';
import { WorldPersistence, PlayerData, ChunkData } from '../persistence/types';
import {
  CharacterDefinition,
  CharacterRole,
  CharacterFaction,
  CharacterRarity,
  CharacterStats,
  AnimationState,
  Ability as TypesAbility,
  AbilityType as TypesAbilityType,
  TargetType,
  AIUsageRule as TypesAIUsageRule,
  AbilityEffect,
  AbilityDefinition,
} from '../character/types';
import { CharacterRegistry } from '../character/registry';
import { CharacterController, CharacterControllerConfig } from '../character/controller';
import { AnimationController } from '../character/animation';
import { AbilitySystem, COMMON_ABILITIES, Entity as AbilityEntity } from '../character/abilities';
import { AIController, AIManager, createAIManager, createAIController, AIEntity } from '../character/ai';
import { PhysicsWorld, createPhysicsWorld } from '../physics/physics';
import { MaterialLibrary, createMaterialLibrary, LightingManager, createLightingManager, ParticleSystem, createParticleSystem } from '../renderer/graphics';

export class Game {
  private renderer: Renderer;
  private world: World;
  private player: Player;
  private input: InputManager;
  private controller: PlayerController;
  private hud: HUD;
  private loop: GameLoop;
  private saveManager: WorldPersistence;
  private autoSaveTimer = 0;
  private needsSave = false;
  private saving = false;
  private worldReady = false;
  private unsubscribeFns: (() => void)[] = [];
  private visibilityHandler = () => { if (document.hidden) void this.saveNow(); };
  private pageHideHandler = () => { void this.saveNow(); };

  // Character System
  private characterRegistry: CharacterRegistry;
  private animationController: AnimationController;
  private abilitySystem: AbilitySystem;
  private aiManager: AIManager;

  // Physics System
  private physicsWorld: PhysicsWorld;

  // Graphics System
  private materialLibrary: MaterialLibrary;
  private lightingManager: LightingManager;
  private particleSystem: ParticleSystem;

  // NPCs and entities
  private npcs: Map<string, CharacterController> = new Map();

  constructor() {
    const container = document.getElementById('game-container')!;
    this.renderer = new Renderer(container);
    this.input = new InputManager(() => this.requestPointerLock());
    this.saveManager = new SaveManager();
    this.world = new World(this.saveManager);
    this.world.setScene(this.renderer.scene);
    this.player = new Player(new THREE.Vector3(0, 0, 0));
    this.hud = new HUD(this.player);
    this.loop = new GameLoop(this.update.bind(this), this.render.bind(this));

    // Initialize Character System
    this.characterRegistry = new CharacterRegistry();
    this.animationController = new AnimationController();
    this.abilitySystem = new AbilitySystem(this.player as unknown as AbilityEntity);
    this.aiManager = createAIManager();

    // Initialize Physics System
    this.physicsWorld = createPhysicsWorld();

    // Initialize Graphics System
    this.materialLibrary = createMaterialLibrary();
    this.lightingManager = createLightingManager(this.renderer.scene);
    this.particleSystem = createParticleSystem(this.renderer.scene);

    // Initialize Character Controller with physics
    this.controller = new PlayerController(
      this.player,
      this.world,
      this.input,
      this.renderer.cameraController
    );

    // Register default character blueprints
    this.registerDefaultCharacters();

    // Set up event listeners
    this.setupEventListeners();

    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('pagehide', this.pageHideHandler);
  }

  private registerDefaultCharacters(): void {
    // Warrior blueprint
    const warriorStats: CharacterStats = {
      maxHealth: 120, health: 120,
      maxStamina: 80, stamina: 80,
      maxMana: 30, mana: 30,
      movementSpeed: 5.0, acceleration: 30, jumpForce: 12.0,
      attackDamage: 15, attackSpeed: 1.0, attackRange: 3,
      defense: 10, magicResistance: 5,
      criticalChance: 0.1, criticalMultiplier: 1.5,
      healthRegen: 1, staminaRegen: 10, manaRegen: 5,
      intelligence: 5, perception: 10, stealth: 5, luck: 5,
    };

    this.characterRegistry.registerCharacter({
      id: 'warrior',
      displayName: 'Warrior',
      sourceAsset: '',
      processedAssets: [],
      role: CharacterRole.PLAYER,
      faction: CharacterFaction.PLAYER_ALLIED,
      rarity: CharacterRarity.COMMON,
      tags: ['melee', 'tank'],
      stats: warriorStats,
      abilities: [
        COMMON_ABILITIES.basic_attack,
        COMMON_ABILITIES.heavy_swing,
        COMMON_ABILITIES.shield_block,
        COMMON_ABILITIES.charge,
      ],
      aiProfile: {
        perceptionRange: 20,
        perceptionAngle: Math.PI,
        memoryDuration: 30,
        aggression: 0.8,
        bravery: 0.7,
        teamwork: 0.5,
        patrolRadius: 15,
        patrolPoints: [],
        preferredTargets: [],
        avoidedEntities: [],
        abilityUsage: [],
        environmentalReactions: [],
        factionRelations: {} as Record<CharacterFaction, number>,
      },
      animationProfile: {
        animations: {} as Record<AnimationState, any>,
        transitions: [],
        parameters: [],
      },
      spawnProfile: {
        conditions: [],
        weight: 1,
        minGroupSize: 1,
        maxGroupSize: 1,
        preferredBiomes: [],
        avoidedBiomes: [],
        timeOfDay: 'any',
        weather: 'any',
        lightLevelMin: 0,
        lightLevelMax: 15,
        structureAffinity: [],
        blockWhitelist: [],
        blockBlacklist: [],
        yLevelMin: 0,
        yLevelMax: 256,
        requiredTags: [],
        forbiddenTags: [],
      },
      lootProfile: {
        tables: [],
        guaranteedDrops: [],
        experienceReward: 50,
        currencyReward: { min: 10, max: 20, currencyId: 'gold' },
      },
      interactionProfile: {
        canTalk: true,
        canTrade: false,
        canQuest: false,
        canFollow: true,
        canGuard: true,
        questIds: [],
        relationshipEffects: {},
        interactionDistance: 3,
      },
      persistenceProfile: {
        saveStats: true,
        saveEquipment: true,
        saveInventory: true,
        savePosition: true,
        saveAIState: false,
        saveStatusEffects: false,
        saveRelationships: false,
        saveProgression: true,
        uniqueStateKeys: [],
      },
      equipment: {},
      inventory: [],
      visualData: {
        silhouette: 'humanoid',
        bodyProportions: { width: 0.6, height: 1.8, depth: 0.4 },
        colorPalette: ['#8B4513', '#C0C0C0', '#FFD700'],
        materialFlags: ['opaque'],
        particleEffects: [],
        scale: 1.0,
        renderLayer: 0,
        billboardMode: false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        author: 'FORGE',
        description: 'A sturdy melee fighter',
        designNotes: '',
        balanceNotes: '',
        sourceReferences: [],
      },
    });

    // Mage blueprint
    const mageStats: CharacterStats = {
      maxHealth: 80, health: 80,
      maxStamina: 60, stamina: 60,
      maxMana: 150, mana: 150,
      movementSpeed: 4.5, acceleration: 25, jumpForce: 11.0,
      attackDamage: 8, attackSpeed: 0.8, attackRange: 20,
      defense: 5, magicResistance: 15,
      criticalChance: 0.15, criticalMultiplier: 2.0,
      healthRegen: 1, staminaRegen: 8, manaRegen: 15,
      intelligence: 20, perception: 15, stealth: 5, luck: 10,
    };

    this.characterRegistry.registerCharacter({
      id: 'mage',
      displayName: 'Mage',
      sourceAsset: '',
      processedAssets: [],
      role: CharacterRole.PLAYER,
      faction: CharacterFaction.PLAYER_ALLIED,
      rarity: CharacterRarity.COMMON,
      tags: ['ranged', 'magic'],
      stats: mageStats,
      abilities: [
        COMMON_ABILITIES.fireball,
        COMMON_ABILITIES.ice_shard,
        COMMON_ABILITIES.teleport,
        COMMON_ABILITIES.mana_shield,
        COMMON_ABILITIES.arcane_explosion,
      ],
      aiProfile: {
        perceptionRange: 25,
        perceptionAngle: Math.PI,
        memoryDuration: 30,
        aggression: 0.6,
        bravery: 0.5,
        teamwork: 0.6,
        patrolRadius: 10,
        patrolPoints: [],
        preferredTargets: [],
        avoidedEntities: [],
        abilityUsage: [],
        environmentalReactions: [],
        factionRelations: {} as Record<CharacterFaction, number>,
      },
      animationProfile: {
        animations: {} as Record<AnimationState, any>,
        transitions: [],
        parameters: [],
      },
      spawnProfile: {
        conditions: [],
        weight: 1,
        minGroupSize: 1,
        maxGroupSize: 1,
        preferredBiomes: [],
        avoidedBiomes: [],
        timeOfDay: 'any',
        weather: 'any',
        lightLevelMin: 0,
        lightLevelMax: 15,
        structureAffinity: [],
        blockWhitelist: [],
        blockBlacklist: [],
        yLevelMin: 0,
        yLevelMax: 256,
        requiredTags: [],
        forbiddenTags: [],
      },
      lootProfile: {
        tables: [],
        guaranteedDrops: [],
        experienceReward: 60,
        currencyReward: { min: 15, max: 30, currencyId: 'gold' },
      },
      interactionProfile: {
        canTalk: true,
        canTrade: false,
        canQuest: true,
        canFollow: true,
        canGuard: false,
        questIds: [],
        relationshipEffects: {},
        interactionDistance: 3,
      },
      persistenceProfile: {
        saveStats: true,
        saveEquipment: true,
        saveInventory: true,
        savePosition: true,
        saveAIState: false,
        saveStatusEffects: false,
        saveRelationships: false,
        saveProgression: true,
        uniqueStateKeys: [],
      },
      equipment: {},
      inventory: [],
      visualData: {
        silhouette: 'humanoid',
        bodyProportions: { width: 0.5, height: 1.7, depth: 0.35 },
        colorPalette: ['#4B0082', '#8A2BE2', '#FFFFFF'],
        materialFlags: ['opaque', 'emissive'],
        particleEffects: ['magic_sparkle'],
        scale: 0.95,
        renderLayer: 0,
        billboardMode: false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        author: 'FORGE',
        description: 'A master of arcane arts',
        designNotes: '',
        balanceNotes: '',
        sourceReferences: [],
      },
    });

    // Rogue blueprint
    const rogueStats: CharacterStats = {
      maxHealth: 90, health: 90,
      maxStamina: 100, stamina: 100,
      maxMana: 50, mana: 50,
      movementSpeed: 6.0, acceleration: 35, jumpForce: 13.0,
      attackDamage: 12, attackSpeed: 1.3, attackRange: 3,
      defense: 6, magicResistance: 5,
      criticalChance: 0.25, criticalMultiplier: 2.2,
      healthRegen: 1, staminaRegen: 12, manaRegen: 8,
      intelligence: 10, perception: 15, stealth: 20, luck: 10,
    };

    this.characterRegistry.registerCharacter({
      id: 'rogue',
      displayName: 'Rogue',
      sourceAsset: '',
      processedAssets: [],
      role: CharacterRole.PLAYER,
      faction: CharacterFaction.PLAYER_ALLIED,
      rarity: CharacterRarity.COMMON,
      tags: ['melee', 'stealth', 'burst'],
      stats: rogueStats,
      abilities: [
        COMMON_ABILITIES.backstab,
        COMMON_ABILITIES.shadow_step,
        COMMON_ABILITIES.poison_blade,
        COMMON_ABILITIES.evasion,
        COMMON_ABILITIES.smoke_bomb,
      ],
      aiProfile: {
        perceptionRange: 20,
        perceptionAngle: Math.PI,
        memoryDuration: 30,
        aggression: 0.7,
        bravery: 0.6,
        teamwork: 0.4,
        patrolRadius: 15,
        patrolPoints: [],
        preferredTargets: [],
        avoidedEntities: [],
        abilityUsage: [],
        environmentalReactions: [],
        factionRelations: {} as Record<CharacterFaction, number>,
      },
      animationProfile: {
        animations: {} as Record<AnimationState, any>,
        transitions: [],
        parameters: [],
      },
      spawnProfile: {
        conditions: [],
        weight: 1,
        minGroupSize: 1,
        maxGroupSize: 1,
        preferredBiomes: [],
        avoidedBiomes: [],
        timeOfDay: 'any',
        weather: 'any',
        lightLevelMin: 0,
        lightLevelMax: 15,
        structureAffinity: [],
        blockWhitelist: [],
        blockBlacklist: [],
        yLevelMin: 0,
        yLevelMax: 256,
        requiredTags: [],
        forbiddenTags: [],
      },
      lootProfile: {
        tables: [],
        guaranteedDrops: [],
        experienceReward: 55,
        currencyReward: { min: 12, max: 25, currencyId: 'gold' },
      },
      interactionProfile: {
        canTalk: true,
        canTrade: false,
        canQuest: true,
        canFollow: true,
        canGuard: false,
        questIds: [],
        relationshipEffects: {},
        interactionDistance: 3,
      },
      persistenceProfile: {
        saveStats: true,
        saveEquipment: true,
        saveInventory: true,
        savePosition: true,
        saveAIState: false,
        saveStatusEffects: false,
        saveRelationships: false,
        saveProgression: true,
        uniqueStateKeys: [],
      },
      equipment: {},
      inventory: [],
      visualData: {
        silhouette: 'humanoid',
        bodyProportions: { width: 0.5, height: 1.75, depth: 0.35 },
        colorPalette: ['#2F4F4F', '#556B2F', '#C0C0C0'],
        materialFlags: ['opaque'],
        particleEffects: ['smoke'],
        scale: 0.9,
        renderLayer: 0,
        billboardMode: false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        author: 'FORGE',
        description: 'A swift and deadly striker',
        designNotes: '',
        balanceNotes: '',
        sourceReferences: [],
      },
    });

    // Archer blueprint
    const archerStats: CharacterStats = {
      maxHealth: 85, health: 85,
      maxStamina: 85, stamina: 85,
      maxMana: 60, mana: 60,
      movementSpeed: 5.0, acceleration: 28, jumpForce: 11.5,
      attackDamage: 10, attackSpeed: 1.1, attackRange: 30,
      defense: 6, magicResistance: 5,
      criticalChance: 0.2, criticalMultiplier: 1.8,
      healthRegen: 1, staminaRegen: 10, manaRegen: 10,
      intelligence: 10, perception: 20, stealth: 10, luck: 8,
    };

    this.characterRegistry.registerCharacter({
      id: 'archer',
      displayName: 'Archer',
      sourceAsset: '',
      processedAssets: [],
      role: CharacterRole.PLAYER,
      faction: CharacterFaction.PLAYER_ALLIED,
      rarity: CharacterRarity.COMMON,
      tags: ['ranged', 'precision'],
      stats: archerStats,
      abilities: [
        COMMON_ABILITIES.aimed_shot,
        COMMON_ABILITIES.multi_shot,
        COMMON_ABILITIES.explosive_arrow,
        COMMON_ABILITIES.eagle_eye,
        COMMON_ABILITIES.rapid_fire,
      ],
      aiProfile: {
        perceptionRange: 30,
        perceptionAngle: Math.PI * 0.8,
        memoryDuration: 30,
        aggression: 0.5,
        bravery: 0.6,
        teamwork: 0.7,
        patrolRadius: 20,
        patrolPoints: [],
        preferredTargets: [],
        avoidedEntities: [],
        abilityUsage: [],
        environmentalReactions: [],
        factionRelations: {} as Record<CharacterFaction, number>,
      },
      animationProfile: {
        animations: {} as Record<AnimationState, any>,
        transitions: [],
        parameters: [],
      },
      spawnProfile: {
        conditions: [],
        weight: 1,
        minGroupSize: 1,
        maxGroupSize: 1,
        preferredBiomes: [],
        avoidedBiomes: [],
        timeOfDay: 'any',
        weather: 'any',
        lightLevelMin: 0,
        lightLevelMax: 15,
        structureAffinity: [],
        blockWhitelist: [],
        blockBlacklist: [],
        yLevelMin: 0,
        yLevelMax: 256,
        requiredTags: [],
        forbiddenTags: [],
      },
      lootProfile: {
        tables: [],
        guaranteedDrops: [],
        experienceReward: 55,
        currencyReward: { min: 12, max: 25, currencyId: 'gold' },
      },
      interactionProfile: {
        canTalk: true,
        canTrade: false,
        canQuest: true,
        canFollow: true,
        canGuard: false,
        questIds: [],
        relationshipEffects: {},
        interactionDistance: 3,
      },
      persistenceProfile: {
        saveStats: true,
        saveEquipment: true,
        saveInventory: true,
        savePosition: true,
        saveAIState: false,
        saveStatusEffects: false,
        saveRelationships: false,
        saveProgression: true,
        uniqueStateKeys: [],
      },
      equipment: {},
      inventory: [],
      visualData: {
        silhouette: 'humanoid',
        bodyProportions: { width: 0.5, height: 1.75, depth: 0.35 },
        colorPalette: ['#8B7355', '#228B22', '#FFFFFF'],
        materialFlags: ['opaque'],
        particleEffects: [],
        scale: 0.95,
        renderLayer: 0,
        billboardMode: false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        author: 'FORGE',
        description: 'A master of the bow',
        designNotes: '',
        balanceNotes: '',
        sourceReferences: [],
      },
    });

    // Villager NPC
    const villagerStats: CharacterStats = {
      maxHealth: 50, health: 50,
      maxStamina: 40, stamina: 40,
      maxMana: 10, mana: 10,
      movementSpeed: 3.0, acceleration: 15, jumpForce: 8.0,
      attackDamage: 3, attackSpeed: 0.8, attackRange: 2,
      defense: 2, magicResistance: 2,
      criticalChance: 0.05, criticalMultiplier: 1.2,
      healthRegen: 0.5, staminaRegen: 5, manaRegen: 2,
      intelligence: 10, perception: 10, stealth: 5, luck: 5,
    };

    this.characterRegistry.registerCharacter({
      id: 'villager',
      displayName: 'Villager',
      sourceAsset: '',
      processedAssets: [],
      role: CharacterRole.VILLAGER,
      faction: CharacterFaction.NEUTRAL,
      rarity: CharacterRarity.COMMON,
      tags: ['npc', 'trade'],
      stats: villagerStats,
      abilities: [
        COMMON_ABILITIES.trade,
        COMMON_ABILITIES.flee,
      ],
      aiProfile: {
        perceptionRange: 15,
        perceptionAngle: Math.PI * 2,
        memoryDuration: 60,
        aggression: 0.1,
        bravery: 0.2,
        teamwork: 0.8,
        patrolRadius: 5,
        patrolPoints: [],
        preferredTargets: [],
        avoidedEntities: ['hostile'],
        abilityUsage: [],
        environmentalReactions: [],
        factionRelations: {} as Record<CharacterFaction, number>,
      },
      animationProfile: {
        animations: {} as Record<AnimationState, any>,
        transitions: [],
        parameters: [],
      },
      spawnProfile: {
        conditions: [],
        weight: 10,
        minGroupSize: 1,
        maxGroupSize: 3,
        preferredBiomes: ['plains', 'village'],
        avoidedBiomes: ['desert', 'nether', 'end'],
        timeOfDay: 'day',
        weather: 'clear',
        lightLevelMin: 8,
        lightLevelMax: 15,
        structureAffinity: ['village'],
        blockWhitelist: [],
        blockBlacklist: [],
        yLevelMin: 60,
        yLevelMax: 80,
        requiredTags: [],
        forbiddenTags: [],
      },
      lootProfile: {
        tables: [],
        guaranteedDrops: [],
        experienceReward: 10,
        currencyReward: { min: 1, max: 5, currencyId: 'gold' },
      },
      interactionProfile: {
        canTalk: true,
        canTrade: true,
        canQuest: true,
        canFollow: false,
        canGuard: false,
        questIds: [],
        relationshipEffects: {},
        interactionDistance: 3,
      },
      persistenceProfile: {
        saveStats: true,
        saveEquipment: true,
        saveInventory: true,
        savePosition: true,
        saveAIState: true,
        saveStatusEffects: true,
        saveRelationships: true,
        saveProgression: false,
        uniqueStateKeys: [],
      },
      equipment: {},
      inventory: [],
      visualData: {
        silhouette: 'humanoid',
        bodyProportions: { width: 0.5, height: 1.7, depth: 0.35 },
        colorPalette: ['#D2B48C', '#8B4513', '#FFFFFF'],
        materialFlags: ['opaque'],
        particleEffects: [],
        scale: 0.9,
        renderLayer: 0,
        billboardMode: false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        author: 'FORGE',
        description: 'A peaceful villager',
        designNotes: '',
        balanceNotes: '',
        sourceReferences: [],
      },
    });

    // Zombie NPC
    const zombieStats: CharacterStats = {
      maxHealth: 60, health: 60,
      maxStamina: 30, stamina: 30,
      maxMana: 0, mana: 0,
      movementSpeed: 3.5, acceleration: 20, jumpForce: 8.0,
      attackDamage: 8, attackSpeed: 0.9, attackRange: 2.5,
      defense: 4, magicResistance: 0,
      criticalChance: 0.05, criticalMultiplier: 1.3,
      healthRegen: 0.2, staminaRegen: 2, manaRegen: 0,
      intelligence: 2, perception: 15, stealth: 2, luck: 0,
    };

    this.characterRegistry.registerCharacter({
      id: 'zombie',
      displayName: 'Zombie',
      sourceAsset: '',
      processedAssets: [],
      role: CharacterRole.CREATURE,
      faction: CharacterFaction.HOSTILE,
      rarity: CharacterRarity.COMMON,
      tags: ['undead', 'melee'],
      stats: zombieStats,
      abilities: [
        COMMON_ABILITIES.basic_attack,
        COMMON_ABILITIES.infect,
      ],
      aiProfile: {
        perceptionRange: 20,
        perceptionAngle: Math.PI,
        memoryDuration: 10,
        aggression: 0.9,
        bravery: 0.8,
        teamwork: 0.3,
        patrolRadius: 10,
        patrolPoints: [],
        preferredTargets: ['player'],
        avoidedEntities: [],
        abilityUsage: [],
        environmentalReactions: [],
        factionRelations: {} as Record<CharacterFaction, number>,
      },
      animationProfile: {
        animations: {} as Record<AnimationState, any>,
        transitions: [],
        parameters: [],
      },
      spawnProfile: {
        conditions: [],
        weight: 5,
        minGroupSize: 1,
        maxGroupSize: 4,
        preferredBiomes: ['plains', 'forest', 'desert'],
        avoidedBiomes: ['mushroom_island'],
        timeOfDay: 'night',
        weather: 'any',
        lightLevelMin: 0,
        lightLevelMax: 7,
        structureAffinity: [],
        blockWhitelist: [],
        blockBlacklist: [],
        yLevelMin: 0,
        yLevelMax: 256,
        requiredTags: [],
        forbiddenTags: [],
      },
      lootProfile: {
        tables: [],
        guaranteedDrops: [],
        experienceReward: 20,
        currencyReward: { min: 0, max: 2, currencyId: 'gold' },
      },
      interactionProfile: {
        canTalk: false,
        canTrade: false,
        canQuest: false,
        canFollow: false,
        canGuard: false,
        questIds: [],
        relationshipEffects: {},
        interactionDistance: 2,
      },
      persistenceProfile: {
        saveStats: true,
        saveEquipment: false,
        saveInventory: false,
        savePosition: false,
        saveAIState: false,
        saveStatusEffects: false,
        saveRelationships: false,
        saveProgression: false,
        uniqueStateKeys: [],
      },
      equipment: {},
      inventory: [],
      visualData: {
        silhouette: 'humanoid',
        bodyProportions: { width: 0.6, height: 1.9, depth: 0.4 },
        colorPalette: ['#2E8B57', '#556B2F', '#8B4513'],
        materialFlags: ['opaque'],
        particleEffects: [],
        scale: 1.0,
        renderLayer: 0,
        billboardMode: false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        author: 'FORGE',
        description: 'A shambling undead',
        designNotes: '',
        balanceNotes: '',
        sourceReferences: [],
      },
    });

    // Skeleton NPC
    const skeletonStats: CharacterStats = {
      maxHealth: 45, health: 45,
      maxStamina: 25, stamina: 25,
      maxMana: 0, mana: 0,
      movementSpeed: 4.0, acceleration: 22, jumpForce: 9.0,
      attackDamage: 6, attackSpeed: 1.0, attackRange: 20,
      defense: 3, magicResistance: 0,
      criticalChance: 0.1, criticalMultiplier: 1.5,
      healthRegen: 0, staminaRegen: 3, manaRegen: 0,
      intelligence: 5, perception: 18, stealth: 5, luck: 2,
    };

    this.characterRegistry.registerCharacter({
      id: 'skeleton',
      displayName: 'Skeleton',
      sourceAsset: '',
      processedAssets: [],
      role: CharacterRole.CREATURE,
      faction: CharacterFaction.HOSTILE,
      rarity: CharacterRarity.COMMON,
      tags: ['undead', 'ranged'],
      stats: skeletonStats,
      abilities: [
        COMMON_ABILITIES.arrow_shot,
        COMMON_ABILITIES.strafe,
      ],
      aiProfile: {
        perceptionRange: 25,
        perceptionAngle: Math.PI * 0.8,
        memoryDuration: 10,
        aggression: 0.8,
        bravery: 0.6,
        teamwork: 0.4,
        patrolRadius: 15,
        patrolPoints: [],
        preferredTargets: ['player'],
        avoidedEntities: [],
        abilityUsage: [],
        environmentalReactions: [],
        factionRelations: {} as Record<CharacterFaction, number>,
      },
      animationProfile: {
        animations: {} as Record<AnimationState, any>,
        transitions: [],
        parameters: [],
      },
      spawnProfile: {
        conditions: [],
        weight: 5,
        minGroupSize: 1,
        maxGroupSize: 3,
        preferredBiomes: ['plains', 'forest', 'desert', 'nether'],
        avoidedBiomes: ['mushroom_island'],
        timeOfDay: 'night',
        weather: 'any',
        lightLevelMin: 0,
        lightLevelMax: 7,
        structureAffinity: ['dungeon'],
        blockWhitelist: [],
        blockBlacklist: [],
        yLevelMin: 0,
        yLevelMax: 256,
        requiredTags: [],
        forbiddenTags: [],
      },
      lootProfile: {
        tables: [],
        guaranteedDrops: [],
        experienceReward: 20,
        currencyReward: { min: 0, max: 3, currencyId: 'gold' },
      },
      interactionProfile: {
        canTalk: false,
        canTrade: false,
        canQuest: false,
        canFollow: false,
        canGuard: false,
        questIds: [],
        relationshipEffects: {},
        interactionDistance: 2,
      },
      persistenceProfile: {
        saveStats: true,
        saveEquipment: false,
        saveInventory: false,
        savePosition: false,
        saveAIState: false,
        saveStatusEffects: false,
        saveRelationships: false,
        saveProgression: false,
        uniqueStateKeys: [],
      },
      equipment: {},
      inventory: [],
      visualData: {
        silhouette: 'humanoid',
        bodyProportions: { width: 0.5, height: 1.85, depth: 0.35 },
        colorPalette: ['#D3D3D3', '#A9A9A9', '#696969'],
        materialFlags: ['opaque'],
        particleEffects: [],
        scale: 0.95,
        renderLayer: 0,
        billboardMode: false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        author: 'FORGE',
        description: 'An animated skeleton archer',
        designNotes: '',
        balanceNotes: '',
        sourceReferences: [],
      },
    });

    // Creeper NPC
    const creeperStats: CharacterStats = {
      maxHealth: 50, health: 50,
      maxStamina: 40, stamina: 40,
      maxMana: 0, mana: 0,
      movementSpeed: 3.0, acceleration: 18, jumpForce: 7.0,
      attackDamage: 20, attackSpeed: 0.5, attackRange: 3,
      defense: 2, magicResistance: 0,
      criticalChance: 0, criticalMultiplier: 1.0,
      healthRegen: 0, staminaRegen: 5, manaRegen: 0,
      intelligence: 3, perception: 12, stealth: 10, luck: 0,
    };

    this.characterRegistry.registerCharacter({
      id: 'creeper',
      displayName: 'Creeper',
      sourceAsset: '',
      processedAssets: [],
      role: CharacterRole.CREATURE,
      faction: CharacterFaction.HOSTILE,
      rarity: CharacterRarity.COMMON,
      tags: ['monster', 'explosive'],
      stats: creeperStats,
      abilities: [
        COMMON_ABILITIES.explode,
        COMMON_ABILITIES.charge_creeper,
      ],
      aiProfile: {
        perceptionRange: 16,
        perceptionAngle: Math.PI,
        memoryDuration: 5,
        aggression: 1.0,
        bravery: 0.3,
        teamwork: 0.1,
        patrolRadius: 8,
        patrolPoints: [],
        preferredTargets: ['player'],
        avoidedEntities: [],
        abilityUsage: [],
        environmentalReactions: [],
        factionRelations: {} as Record<CharacterFaction, number>,
      },
      animationProfile: {
        animations: {} as Record<AnimationState, any>,
        transitions: [],
        parameters: [],
      },
      spawnProfile: {
        conditions: [],
        weight: 3,
        minGroupSize: 1,
        maxGroupSize: 1,
        preferredBiomes: ['plains', 'forest', 'desert', 'taiga'],
        avoidedBiomes: ['mushroom_island', 'ocean'],
        timeOfDay: 'any',
        weather: 'any',
        lightLevelMin: 0,
        lightLevelMax: 7,
        structureAffinity: [],
        blockWhitelist: [],
        blockBlacklist: [],
        yLevelMin: 0,
        yLevelMax: 256,
        requiredTags: [],
        forbiddenTags: [],
      },
      lootProfile: {
        tables: [],
        guaranteedDrops: [],
        experienceReward: 25,
        currencyReward: { min: 0, max: 1, currencyId: 'gold' },
      },
      interactionProfile: {
        canTalk: false,
        canTrade: false,
        canQuest: false,
        canFollow: false,
        canGuard: false,
        questIds: [],
        relationshipEffects: {},
        interactionDistance: 2,
      },
      persistenceProfile: {
        saveStats: true,
        saveEquipment: false,
        saveInventory: false,
        savePosition: false,
        saveAIState: false,
        saveStatusEffects: false,
        saveRelationships: false,
        saveProgression: false,
        uniqueStateKeys: [],
      },
      equipment: {},
      inventory: [],
      visualData: {
        silhouette: 'creeper',
        bodyProportions: { width: 0.6, height: 1.7, depth: 0.4 },
        colorPalette: ['#006400', '#228B22', '#000000'],
        materialFlags: ['opaque'],
        particleEffects: ['smoke'],
        scale: 0.9,
        renderLayer: 0,
        billboardMode: false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        author: 'FORGE',
        description: 'An explosive ambush predator',
        designNotes: '',
        balanceNotes: '',
        sourceReferences: [],
      },
    });

    // Enderman NPC
    const endermanStats: CharacterStats = {
      maxHealth: 80, health: 80,
      maxStamina: 60, stamina: 60,
      maxMana: 50, mana: 50,
      movementSpeed: 4.5, acceleration: 25, jumpForce: 10.0,
      attackDamage: 12, attackSpeed: 0.8, attackRange: 3,
      defense: 5, magicResistance: 10,
      criticalChance: 0.1, criticalMultiplier: 1.8,
      healthRegen: 0.5, staminaRegen: 8, manaRegen: 5,
      intelligence: 15, perception: 20, stealth: 15, luck: 5,
    };

    this.characterRegistry.registerCharacter({
      id: 'enderman',
      displayName: 'Enderman',
      sourceAsset: '',
      processedAssets: [],
      role: CharacterRole.CREATURE,
      faction: CharacterFaction.HOSTILE,
      rarity: CharacterRarity.RARE,
      tags: ['enderman', 'teleport', 'neutral_aggressive'],
      stats: endermanStats,
      abilities: [
        COMMON_ABILITIES.teleport_attack,
        COMMON_ABILITIES.block_pickup,
        COMMON_ABILITIES.scream,
      ],
      aiProfile: {
        perceptionRange: 30,
        perceptionAngle: Math.PI * 2,
        memoryDuration: 60,
        aggression: 0.3,
        bravery: 0.9,
        teamwork: 0.2,
        patrolRadius: 20,
        patrolPoints: [],
        preferredTargets: ['player'],
        avoidedEntities: [],
        abilityUsage: [],
        environmentalReactions: [],
        factionRelations: {} as Record<CharacterFaction, number>,
      },
      animationProfile: {
        animations: {} as Record<AnimationState, any>,
        transitions: [],
        parameters: [],
      },
      spawnProfile: {
        conditions: [],
        weight: 1,
        minGroupSize: 1,
        maxGroupSize: 2,
        preferredBiomes: ['end', 'warped_forest', 'desert'],
        avoidedBiomes: ['ocean', 'mushroom_island'],
        timeOfDay: 'any',
        weather: 'any',
        lightLevelMin: 0,
        lightLevelMax: 7,
        structureAffinity: ['end_city'],
        blockWhitelist: [],
        blockBlacklist: [],
        yLevelMin: 0,
        yLevelMax: 256,
        requiredTags: [],
        forbiddenTags: [],
      },
      lootProfile: {
        tables: [],
        guaranteedDrops: [],
        experienceReward: 50,
        currencyReward: { min: 5, max: 10, currencyId: 'gold' },
      },
      interactionProfile: {
        canTalk: false,
        canTrade: false,
        canQuest: false,
        canFollow: false,
        canGuard: false,
        questIds: [],
        relationshipEffects: {},
        interactionDistance: 2,
      },
      persistenceProfile: {
        saveStats: true,
        saveEquipment: false,
        saveInventory: false,
        savePosition: false,
        saveAIState: false,
        saveStatusEffects: false,
        saveRelationships: false,
        saveProgression: false,
        uniqueStateKeys: [],
      },
      equipment: {},
      inventory: [],
      visualData: {
        silhouette: 'enderman',
        bodyProportions: { width: 0.7, height: 2.5, depth: 0.5 },
        colorPalette: ['#1A1A2E', '#4B0082', '#E0E0E0'],
        materialFlags: ['opaque', 'emissive'],
        particleEffects: ['portal_particle'],
        scale: 1.3,
        renderLayer: 0,
        billboardMode: false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        author: 'FORGE',
        description: 'A tall teleporting entity from the End',
        designNotes: '',
        balanceNotes: '',
        sourceReferences: [],
      },
    });
  }

  private setupEventListeners(): void {
    this.unsubscribeFns.push(gameEvents.on('character-created', (data: any) => {
      console.log('Character created:', data.id);
    }));

    this.unsubscribeFns.push(gameEvents.on('ability-used', (data: any) => {
      this.particleSystem.emit('magic_sparkle', data.position);
    }));

    this.unsubscribeFns.push(gameEvents.on('ability-effect', (data: any) => {
      if (data.effect.type === 'damage' && data.isCritical) {
        this.particleSystem.emit('critical_hit', data.position);
      } else if (data.effect.type === 'damage') {
        this.particleSystem.emit('blood_splatter', data.position);
      }
    }));

    this.unsubscribeFns.push(gameEvents.on('character-death', (data: any) => {
      this.particleSystem.emit('level_up', data.position);
      if (data.characterId === 'player') {
        this.hud.showPrompt('You died! Respawning...');
      }
    }));

    this.unsubscribeFns.push(gameEvents.on('character-levelup', (data: any) => {
      this.particleSystem.emit('level_up', data.position);
      this.hud.showPrompt(`Level Up! New level: ${data.level}`);
    }));

    this.unsubscribeFns.push(gameEvents.on('block-break', (data: { type: number }) => {
      this.hud.showPrompt(`Mined block type ${data.type}`);
      this.needsSave = true;
    }));
  }

  private async saveNow(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    try {
      const modifiedKeys = this.world.getModifiedChunkKeys();
      const playerData: PlayerData = {
        position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        inventory: this.player.inventory,
        selectedSlot: this.player.selectedSlot,
      };
      await this.saveManager.saveGame(this.world.getSeed(), playerData, modifiedKeys);
      this.needsSave = false;
    } finally {
      this.saving = false;
    }
  }

  private update = (dt: number): void => {
    this.controller.update(dt);
    this.world.update(this.player.position);
    this.hud.update();

    // Update physics
    this.physicsWorld.step(dt);

    // Update NPCs
    for (const npc of this.npcs.values()) {
      npc.update(dt);
    }

    // Update AI
    this.aiManager.update(dt);

    // Update graphics
    this.particleSystem.update(dt);
    this.lightingManager.update(dt, this.player.position);

    // Auto-save
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 30 && this.needsSave) {
      this.autoSaveTimer = 0;
      void this.saveNow();
    }
  };

  private render = (): void => {
    this.renderer.render(this.world, this.player);
  };

  async start(): Promise<void> {
    const save = await this.saveManager.loadGame();
    if (save) {
      this.player.position.set(save.player.position.x, save.player.position.y, save.player.position.z);
      this.player.inventory = save.player.inventory;
      this.player.selectedSlot = save.player.selectedSlot;
      await this.world.initialize(save.world.seed, save.world.modifiedChunkKeys);
      for (const key of save.world.modifiedChunkKeys) {
        const chunkData = await this.saveManager.loadChunk(
          parseInt(key.split(',')[0]),
          parseInt(key.split(',')[1])
        );
        if (chunkData) {
          this.world.loadChunkFromSave(key, chunkData);
        }
      }
    } else {
      const seed = Math.floor(Math.random() * 1000000);
      this.world.setSeed(seed);
      await this.world.initialize(seed, []);
    }
    this.worldReady = true;
    this.loop.start();
  }

  public requestPointerLock(): void {
    const canvas = this.renderer.getCanvas();
    canvas.requestPointerLock().catch(() => {});
  }

  dispose(): void {
    this.unsubscribeFns.forEach(fn => fn());
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    window.removeEventListener('pagehide', this.pageHideHandler);
    this.loop.stop();
    this.hud.dispose();
    this.input.dispose();
    this.controller.dispose();
    for (const npc of this.npcs.values()) {
      npc.dispose();
    }
    this.npcs.clear();
    this.world.dispose();
    this.renderer.dispose();
    this.physicsWorld.dispose();
    this.materialLibrary.dispose();
    this.particleSystem.dispose();
    this.aiManager.dispose();
    this.abilitySystem.interruptAll();
    this.animationController.dispose();
    this.characterRegistry.clear();
    void this.saveNow();
  }
}