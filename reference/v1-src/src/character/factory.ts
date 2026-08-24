/**
 * Character Factory - FORGE OMNIVERSE
 * Creates character runtimes from definitions
 */

import {
  CharacterDefinition,
  CharacterRole,
  CharacterStats,
  Equipment,
  ItemInstance,
  Vector3,
  AnimationState,
  AIState,
  StatusEffect,
  CharacterFaction,
} from './types';

export interface CharacterRuntime {
  definition: CharacterDefinition;
  stats: CharacterStats;
  currentStats: CharacterStats;
  equipment: Equipment;
  inventory: ItemInstance[];
  statusEffects: Map<string, StatusEffect>;
  aiState: AIState;
  aiTarget: AIEntity | null;
  animationState: AnimationState;
  position: Vector3;
  rotation: Vector3;
  velocity: Vector3;
  isAlive: boolean;
  factionReputation: Map<string, number>;
  uniqueState: Map<string, unknown>;
  lastUpdate: number;
}

export interface AIEntity {
  id: string;
  position: Vector3;
  isAlive: boolean;
  faction: CharacterFaction;
}

export class BaseCharacterFactory {
  create(definition: CharacterDefinition): CharacterRuntime {
    return {
      definition,
      stats: { ...definition.stats },
      currentStats: { ...definition.stats },
      equipment: { ...definition.equipment },
      inventory: [...definition.inventory],
      statusEffects: new Map(),
      aiState: AIState.IDLE,
      aiTarget: null,
      animationState: AnimationState.IDLE,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      isAlive: true,
      factionReputation: new Map(),
      uniqueState: new Map(),
      lastUpdate: Date.now(),
    };
  }

  getDefaultEquipment(role: CharacterRole): Equipment {
    const base: Equipment = {};
    switch (role) {
      case CharacterRole.PLAYER:
        base.mainHand = 'iron_sword';
        break;
      case CharacterRole.GUARD:
        base.mainHand = 'iron_sword';
        base.chest = 'iron_chestplate';
        base.head = 'iron_helmet';
        break;
      case CharacterRole.MERCHANT:
        base.mainHand = 'merchant_scales';
        break;
      case CharacterRole.FACTION_LEADER:
        base.mainHand = 'legendary_weapon';
        base.chest = 'legendary_armor';
        break;
      default:
        break;
    }
    return base;
  }

  getDefaultInventory(role: CharacterRole): ItemInstance[] {
    const base: ItemInstance[] = [];
    switch (role) {
      case CharacterRole.PLAYER:
        base.push(
          { id: 'health_potion_1', templateId: 'health_potion', quantity: 3 },
          { id: 'stamina_potion_1', templateId: 'stamina_potion', quantity: 2 },
          { id: 'bread_1', templateId: 'bread', quantity: 5 }
        );
        break;
      case CharacterRole.MERCHANT:
        base.push(
          { id: 'emerald_1', templateId: 'emerald', quantity: 10 },
          { id: 'diamond_1', templateId: 'diamond', quantity: 2 }
        );
        break;
      case CharacterRole.QUEST_GIVER:
        base.push(
          { id: 'quest_item_1', templateId: 'quest_token', quantity: 1 }
        );
        break;
      default:
        break;
    }
    return base;
  }
}

export class CharacterFactoryRegistry {
  private factories: Map<CharacterRole, BaseCharacterFactory> = new Map();

  register(role: CharacterRole, factory: BaseCharacterFactory): void {
    this.factories.set(role, factory);
  }

  getFactory(role: CharacterRole): BaseCharacterFactory | undefined {
    return this.factories.get(role);
  }

  create(definition: CharacterDefinition): CharacterRuntime {
    const factory = this.factories.get(definition.role) || new BaseCharacterFactory();
    return factory.create(definition);
  }
}

export const characterFactoryRegistry = new CharacterFactoryRegistry();

characterFactoryRegistry.register(CharacterRole.PLAYER, new BaseCharacterFactory());
characterFactoryRegistry.register(CharacterRole.NPC, new BaseCharacterFactory());
characterFactoryRegistry.register(CharacterRole.CREATURE, new BaseCharacterFactory());
characterFactoryRegistry.register(CharacterRole.BOSS, new BaseCharacterFactory());
characterFactoryRegistry.register(CharacterRole.VILLAGER, new BaseCharacterFactory());
characterFactoryRegistry.register(CharacterRole.GUARD, new BaseCharacterFactory());
characterFactoryRegistry.register(CharacterRole.MERCHANT, new BaseCharacterFactory());
characterFactoryRegistry.register(CharacterRole.QUEST_GIVER, new BaseCharacterFactory());
characterFactoryRegistry.register(CharacterRole.FACTION_LEADER, new BaseCharacterFactory());
characterFactoryRegistry.register(CharacterRole.LEGENDARY, new BaseCharacterFactory());