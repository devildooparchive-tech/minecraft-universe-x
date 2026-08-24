/**
 * Character System Types - FORGE OMNIVERSE
 * Core type definitions for the character universe
 */

import type { AbilityEffect, AbilityDefinition, AbilityRequirement, AbilityTargetType, AbilityResourceType } from './abilities';

export type { AbilityEffect, AbilityDefinition, AbilityRequirement, AbilityTargetType, AbilityResourceType };

export enum CharacterRole {
  PLAYER = 'player',
  NPC = 'npc',
  CREATURE = 'creature',
  BOSS = 'boss',
  VILLAGER = 'villager',
  GUARD = 'guard',
  MERCHANT = 'merchant',
  QUEST_GIVER = 'quest_giver',
  FACTION_LEADER = 'faction_leader',
  LEGENDARY = 'legendary',
}

export enum CharacterFaction {
  NEUTRAL = 'neutral',
  PLAYER_ALLIED = 'player_allied',
  HOSTILE = 'hostile',
  WILDERNESS = 'wilderness',
  CIVILIZATION = 'civilization',
  CORRUPTED = 'corrupted',
  ANCIENT = 'ancient',
  VOID = 'void',
  CUSTOM_1 = 'custom_1',
  CUSTOM_2 = 'custom_2',
  CUSTOM_3 = 'custom_3',
}

export enum CharacterRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
  MYTHIC = 'mythic',
  UNIQUE = 'unique',
}

export enum AnimationState {
  IDLE = 'idle',
  WALK = 'walk',
  RUN = 'run',
  SPRINT = 'sprint',
  JUMP = 'jump',
  FALL = 'fall',
  LAND = 'land',
  ATTACK = 'attack',
  HEAVY_ATTACK = 'heavy_attack',
  BLOCK = 'block',
  PARRY = 'parry',
  DODGE = 'dodge',
  HIT = 'hit',
  STUN = 'stun',
  CAST = 'cast',
  INTERACT = 'interact',
  USE_ITEM = 'use_item',
  SPECIAL = 'special',
  DEATH = 'death',
  RESPAWN = 'respawn',
  CUSTOM = 'custom',
}

export enum AbilityType {
  PASSIVE = 'passive',
  ACTIVE = 'active',
  DEFENSIVE = 'defensive',
  MOVEMENT = 'movement',
  UTILITY = 'utility',
  ULTIMATE = 'ultimate',
  TRIGGERED = 'triggered',
}

export enum TargetType {
  SELF = 'self',
  TARGET_ENTITY = 'target_entity',
  TARGET_POSITION = 'target_position',
  AREA = 'area',
  CONE = 'cone',
  LINE = 'line',
  GLOBAL = 'global',
}

export enum AIState {
  IDLE = 'idle',
  WANDER = 'wander',
  PATROL = 'patrol',
  PERCEIVE = 'perceive',
  INVESTIGATE = 'investigate',
  CHASE = 'chase',
  ATTACK = 'attack',
  DEFEND = 'defend',
  FLEE = 'flee',
  SEARCH = 'search',
  RETURN = 'return',
  ASSIST = 'assist',
  DEAD = 'dead',
  FOLLOW = 'follow',
  GUARD = 'guard',
  FLEE_HOME = 'flee_home',
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface CharacterStats {
  maxHealth: number;
  health: number;
  maxStamina: number;
  stamina: number;
  maxMana: number;
  mana: number;
  movementSpeed: number;
  acceleration: number;
  jumpForce: number;
  attackDamage: number;
  attackSpeed: number;
  attackRange: number;
  defense: number;
  magicResistance: number;
  criticalChance: number;
  criticalMultiplier: number;
  healthRegen: number;
  staminaRegen: number;
  manaRegen: number;
  intelligence: number;
  perception: number;
  stealth: number;
  luck: number;
  [key: string]: number;
}

export interface ResistanceProfile {
  physical: number;
  fire: number;
  ice: number;
  lightning: number;
  poison: number;
  magic: number;
  holy: number;
  void: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  type: AbilityType;
  cooldown: number;
  currentCooldown: number;
  resourceCost: { type: string; amount: number }[];
  range: number;
  targetType: TargetType;
  areaRadius?: number;
  coneAngle?: number;
  effects: AbilityEffect[];
  animationTrigger?: string;
  vfxKey?: string;
  sfxKey?: string;
  aiUsageRules?: AIUsageRule[];
  tags: string[];
}

export interface AIUsageRule {
  condition: string;
  priority: number;
  minHealthPercent?: number;
  maxHealthPercent?: number;
  minDistance?: number;
  maxDistance?: number;
  requiredTargets?: number;
  blacklistTags?: string[];
  whitelistTags?: string[];
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

export interface EquipmentSlot {
  id: string;
  name: string;
  allowedTypes: string[];
  itemId?: string;
}

export interface Equipment {
  head?: string;
  chest?: string;
  legs?: string;
  feet?: string;
  mainHand?: string;
  offHand?: string;
  ring1?: string;
  ring2?: string;
  amulet?: string;
  cloak?: string;
  [key: string]: string | undefined;
}

export interface ItemInstance {
  id: string;
  templateId: string;
  quantity: number;
  durability?: number;
  maxDurability?: number;
  enchantments?: Enchantment[];
  customData?: Record<string, unknown>;
}

export interface Enchantment {
  id: string;
  level: number;
}

export interface AnimationProfile {
  animations: Record<AnimationState, AnimationClip>;
  transitions: AnimationTransition[];
  parameters: AnimationParameter[];
}

export interface AnimationClip {
  id: string;
  name: string;
  duration: number;
  loop: boolean;
  speed: number;
  events: AnimationEvent[];
  spriteSheet?: string;
  frameCount?: number;
  frameWidth?: number;
  frameHeight?: number;
}

export interface AnimationEvent {
  time: number;
  type: 'sound' | 'effect' | 'hitbox' | 'custom';
  data: Record<string, unknown>;
}

export interface AnimationTransition {
  from: AnimationState;
  to: AnimationState;
  condition: string;
  duration: number;
  priority: number;
}

export interface AnimationParameter {
  name: string;
  type: 'float' | 'int' | 'bool' | 'trigger';
  defaultValue: number | boolean;
}

export interface AIProfile {
  perceptionRange: number;
  perceptionAngle: number;
  memoryDuration: number;
  aggression: number;
  bravery: number;
  teamwork: number;
  patrolRadius: number;
  patrolPoints: Vector3[];
  preferredTargets: string[];
  avoidedEntities: string[];
  abilityUsage: AIUsageRule[];
  environmentalReactions: EnvironmentalReaction[];
  factionRelations: Record<CharacterFaction, number>;
}

export interface EnvironmentalReaction {
  trigger: 'weather' | 'time' | 'block' | 'entity' | 'damage' | 'sound' | 'light';
  condition: string;
  response: AIState;
  priority: number;
  cooldown: number;
}

export interface SpawnProfile {
  conditions: SpawnCondition[];
  weight: number;
  minGroupSize: number;
  maxGroupSize: number;
  preferredBiomes: string[];
  avoidedBiomes: string[];
  timeOfDay: 'any' | 'day' | 'night' | 'dawn' | 'dusk';
  weather: 'any' | 'clear' | 'rain' | 'storm' | 'snow' | 'fog';
  lightLevelMin: number;
  lightLevelMax: number;
  structureAffinity: string[];
  blockWhitelist: number[];
  blockBlacklist: number[];
  yLevelMin: number;
  yLevelMax: number;
  requiredTags: string[];
  forbiddenTags: string[];
}

export interface SpawnCondition {
  type: 'block' | 'light' | 'biome' | 'structure' | 'entity_count' | 'time' | 'weather' | 'custom';
  check: string;
  value: number | string | boolean;
}

export interface LootProfile {
  tables: LootTable[];
  guaranteedDrops: GuaranteedDrop[];
  experienceReward: number;
  currencyReward: { min: number; max: number; currencyId: string };
}

export interface LootTable {
  id: string;
  weight: number;
  rolls: { min: number; max: number };
  entries: LootEntry[];
  conditions?: string[];
}

export interface LootEntry {
  itemId: string;
  weight: number;
  quantity: { min: number; max: number };
  quality?: 'normal' | 'magic' | 'rare' | 'epic' | 'legendary';
  enchantmentChance?: number;
  conditions?: string[];
}

export interface GuaranteedDrop {
  itemId: string;
  quantity: { min: number; max: number };
  condition?: string;
}

export interface InteractionProfile {
  canTalk: boolean;
  canTrade: boolean;
  canQuest: boolean;
  canFollow: boolean;
  canGuard: boolean;
  dialogueId?: string;
  tradeTableId?: string;
  questIds: string[];
  relationshipEffects: Record<string, number>;
  interactionDistance: number;
  requiredItems?: string[];
  forbiddenItems?: string[];
}

export interface PersistenceProfile {
  saveStats: boolean;
  saveEquipment: boolean;
  saveInventory: boolean;
  savePosition: boolean;
  saveAIState: boolean;
  saveStatusEffects: boolean;
  saveRelationships: boolean;
  saveProgression: boolean;
  uniqueStateKeys: string[];
}

export interface CharacterDefinition {
  id: string;
  displayName: string;
  sourceAsset: string;
  processedAssets: ProcessedAsset[];
  role: CharacterRole;
  faction: CharacterFaction;
  rarity: CharacterRarity;
  tags: string[];
  stats: CharacterStats;
  abilities: AbilityDefinition[];
  aiProfile: AIProfile;
  animationProfile: AnimationProfile;
  spawnProfile: SpawnProfile;
  lootProfile: LootProfile;
  interactionProfile: InteractionProfile;
  persistenceProfile: PersistenceProfile;
  equipment: Equipment;
  inventory: ItemInstance[];
  visualData: VisualData;
  metadata: CharacterMetadata;
}

export interface ProcessedAsset {
  type: 'sprite' | 'model' | 'texture' | 'animation' | 'sound';
  path: string;
  originalSource: string;
  processingMethod: string;
  metadata: Record<string, unknown>;
}

export interface VisualData {
  silhouette: string;
  bodyProportions: { width: number; height: number; depth: number };
  colorPalette: string[];
  materialFlags: string[];
  particleEffects: string[];
  scale: number;
  renderLayer: number;
  billboardMode: boolean;
  customShader?: string;
}

export interface CharacterMetadata {
  createdAt: number;
  updatedAt: number;
  version: number;
  author: string;
  description: string;
  designNotes: string;
  balanceNotes: string;
  sourceReferences: string[];
}

export interface CharacterInstance {
  id: string;
  definitionId: string;
  position: Vector3;
  stats: CharacterStats;
  level: number;
  experience: number;
  faction: CharacterFaction;
  role: CharacterRole;
  isAlive: boolean;
  equipment: Equipment;
  inventory: ItemInstance[];
  abilityLevels: Map<string, number>;
  aiState: AIState;
  statusEffects: StatusEffect[];
  relationships: Record<string, number>;
  quests: string[];
  customData: Record<string, unknown>;
}