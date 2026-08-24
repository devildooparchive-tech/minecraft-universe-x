/**
 * Character Definition Registry - FORGE OMNIVERSE
 * Central registry for all character definitions
 */

import {
  CharacterDefinition,
  CharacterRole,
  CharacterFaction,
  CharacterRarity,
  CharacterStats,
  AIProfile,
  AnimationProfile,
  SpawnProfile,
  LootProfile,
  InteractionProfile,
  PersistenceProfile,
  Equipment,
  ItemInstance,
  VisualData,
  CharacterMetadata,
  ProcessedAsset,
  AnimationState,
  AbilityType,
  TargetType,
  AnimationClip,
  AnimationTransition,
  AnimationParameter,
  Vector3,
  AIState,
} from './types';
import { AbilityDefinition, AbilityEffect } from './abilities';

export interface CharacterFactory {
  create(definition: CharacterDefinition): CharacterRuntime;
  getDefaultEquipment(role: CharacterRole): Equipment;
  getDefaultInventory(role: CharacterRole): ItemInstance[];
}

export interface CharacterRuntime {
  definition: CharacterDefinition;
  stats: CharacterStats;
  currentStats: CharacterStats;
  equipment: Equipment;
  inventory: ItemInstance[];
  statusEffects: Map<string, StatusEffect>;
  aiState: AIState;
  aiTarget: string | null;
  animationState: AnimationState;
  position: Vector3;
  rotation: Vector3;
  velocity: Vector3;
  isAlive: boolean;
  factionReputation: Map<CharacterFaction, number>;
  uniqueState: Map<string, unknown>;
  lastUpdate: number;
}

export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  duration: number;
  remainingTime: number;
  stacks: number;
  maxStacks: number;
  effects: AbilityEffect[];
  icon?: string;
  isBeneficial: boolean;
  isDispellable: boolean;
  tickInterval?: number;
}

export class CharacterRegistry {
  private definitions: Map<string, CharacterDefinition> = new Map();
  private factories: Map<string, CharacterFactory> = new Map();

  registerCharacter(definition: CharacterDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  getCharacter(id: string): CharacterDefinition | undefined {
    return this.definitions.get(id);
  }

  getAllCharacters(): CharacterDefinition[] {
    return Array.from(this.definitions.values());
  }

  getByRole(role: CharacterRole): CharacterDefinition[] {
    return this.getAllCharacters().filter(d => d.role === role);
  }

  getByFaction(faction: CharacterFaction): CharacterDefinition[] {
    return this.getAllCharacters().filter(d => d.faction === faction);
  }

  getByRarity(rarity: CharacterRarity): CharacterDefinition[] {
    return this.getAllCharacters().filter(d => d.rarity === rarity);
  }

  getByTag(tag: string): CharacterDefinition[] {
    return this.getAllCharacters().filter(d => d.tags.includes(tag));
  }

  clear(): void {
    this.definitions.clear();
    this.factories.clear();
  }

  registerFactory(role: CharacterRole, factory: CharacterFactory): void {
    this.factories.set(role, factory);
  }

  getFactory(role: CharacterRole): CharacterFactory | undefined {
    return this.factories.get(role);
  }

  createRuntime(id: string, overrides?: Partial<CharacterDefinition>): CharacterRuntime | null {
    const definition = this.getCharacter(id);
    if (!definition) return null;

    const factory = this.getFactory(definition.role);
    if (!factory) return null;

    const merged = this.mergeDefinition(definition, overrides);
    return factory.create(merged);
  }

  private mergeDefinition(
    base: CharacterDefinition,
    overrides?: Partial<CharacterDefinition>
  ): CharacterDefinition {
    if (!overrides) return base;
    return {
      ...base,
      ...overrides,
      stats: { ...base.stats, ...overrides.stats },
      aiProfile: { ...base.aiProfile, ...overrides.aiProfile },
      spawnProfile: { ...base.spawnProfile, ...overrides.spawnProfile },
      lootProfile: { ...base.lootProfile, ...overrides.lootProfile },
      interactionProfile: { ...base.interactionProfile, ...overrides.interactionProfile },
      persistenceProfile: { ...base.persistenceProfile, ...overrides.persistenceProfile },
      equipment: { ...base.equipment, ...overrides.equipment },
      inventory: overrides.inventory ?? base.inventory,
      visualData: { ...base.visualData, ...overrides.visualData },
      metadata: { ...base.metadata, ...overrides.metadata, updatedAt: Date.now() },
    };
  }
}

export const characterRegistry = new CharacterRegistry();

export function createBaseStats(overrides?: Partial<CharacterStats>): CharacterStats {
  return {
    maxHealth: 100,
    health: 100,
    maxStamina: 100,
    stamina: 100,
    maxMana: 50,
    mana: 50,
    movementSpeed: 5,
    acceleration: 10,
    jumpForce: 10,
    attackDamage: 10,
    attackSpeed: 1,
    attackRange: 2,
    defense: 0,
    magicResistance: 0,
    criticalChance: 0,
    criticalMultiplier: 1.5,
    healthRegen: 1,
    staminaRegen: 10,
    manaRegen: 5,
    intelligence: 10,
    perception: 10,
    stealth: 5,
    luck: 0,
    ...overrides,
  };
}

export function createBaseAIProfile(overrides?: Partial<AIProfile>): AIProfile {
  return {
    perceptionRange: 20,
    perceptionAngle: Math.PI,
    memoryDuration: 30,
    aggression: 0.5,
    bravery: 0.5,
    teamwork: 0.5,
    patrolRadius: 10,
    patrolPoints: [],
    preferredTargets: [],
    avoidedEntities: [],
    abilityUsage: [],
    environmentalReactions: [],
    factionRelations: {
      [CharacterFaction.NEUTRAL]: 0,
      [CharacterFaction.PLAYER_ALLIED]: 0,
      [CharacterFaction.HOSTILE]: -50,
      [CharacterFaction.WILDERNESS]: 0,
      [CharacterFaction.CIVILIZATION]: 0,
      [CharacterFaction.CORRUPTED]: -25,
      [CharacterFaction.ANCIENT]: 0,
      [CharacterFaction.VOID]: -75,
      [CharacterFaction.CUSTOM_1]: 0,
      [CharacterFaction.CUSTOM_2]: 0,
      [CharacterFaction.CUSTOM_3]: 0,
    },
    ...overrides,
  };
}

export function createBaseAnimationProfile(overrides?: Partial<AnimationProfile>): AnimationProfile {
  const states = Object.values(AnimationState);
  const animations: Record<AnimationState, AnimationClip> = {} as Record<AnimationState, AnimationClip>;

  for (const state of states) {
    animations[state] = {
      id: `anim_${state}`,
      name: state,
      duration: 1,
      loop: state !== AnimationState.ATTACK && state !== AnimationState.DEATH,
      speed: 1,
      events: [],
    };
  }

  return {
    animations,
    transitions: [],
    parameters: [
      { name: 'speed', type: 'float', defaultValue: 1 },
      { name: 'isMoving', type: 'bool', defaultValue: false },
      { name: 'isAttacking', type: 'trigger', defaultValue: false },
      { name: 'isHit', type: 'trigger', defaultValue: false },
    ],
    ...overrides,
  };
}

export function createBaseSpawnProfile(overrides?: Partial<SpawnProfile>): SpawnProfile {
  return {
    conditions: [],
    weight: 100,
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
    yLevelMax: 255,
    requiredTags: [],
    forbiddenTags: [],
    ...overrides,
  };
}

export function createBaseLootProfile(overrides?: Partial<LootProfile>): LootProfile {
  return {
    tables: [],
    guaranteedDrops: [],
    experienceReward: 10,
    currencyReward: { min: 0, max: 0, currencyId: 'coin' },
    ...overrides,
  };
}

export function createBaseInteractionProfile(overrides?: Partial<InteractionProfile>): InteractionProfile {
  return {
    canTalk: false,
    canTrade: false,
    canQuest: false,
    canFollow: false,
    canGuard: false,
    questIds: [],
    relationshipEffects: {},
    interactionDistance: 3,
    ...overrides,
  };
}

export function createBasePersistenceProfile(overrides?: Partial<PersistenceProfile>): PersistenceProfile {
  return {
    saveStats: true,
    saveEquipment: true,
    saveInventory: true,
    savePosition: true,
    saveAIState: false,
    saveStatusEffects: true,
    saveRelationships: false,
    saveProgression: true,
    uniqueStateKeys: [],
    ...overrides,
  };
}

export function createBaseVisualData(overrides?: Partial<VisualData>): VisualData {
  return {
    silhouette: 'humanoid',
    bodyProportions: { width: 0.6, height: 1.8, depth: 0.6 },
    colorPalette: ['#8B7355', '#4A4A4A', '#FFFFFF'],
    materialFlags: ['opaque'],
    particleEffects: [],
    scale: 1,
    renderLayer: 0,
    billboardMode: false,
    ...overrides,
  };
}

export function createBaseMetadata(overrides?: Partial<CharacterMetadata>): CharacterMetadata {
  return {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    author: 'FORGE OMNIVERSE',
    description: '',
    designNotes: '',
    balanceNotes: '',
    sourceReferences: [],
    ...overrides,
  };
}

export function createProcessedAsset(
  type: ProcessedAsset['type'],
  path: string,
  originalSource: string,
  processingMethod: string,
  metadata: Record<string, unknown> = {}
): ProcessedAsset {
  return { type, path, originalSource, processingMethod, metadata };
}