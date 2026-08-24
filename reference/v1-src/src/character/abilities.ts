import * as THREE from 'three';
import { gameEvents } from '../core/events';

export enum AbilityType {
  PASSIVE = 'passive',
  ACTIVE = 'active',
  DEFENSIVE = 'defensive',
  MOVEMENT = 'movement',
  UTILITY = 'utility',
  ULTIMATE = 'ultimate',
  TRIGGERED = 'triggered',
}

export enum AbilityTargetType {
  SELF = 'self',
  TARGET = 'target',
  AREA = 'area',
  DIRECTION = 'direction',
  GROUND = 'ground',
  CONE = 'cone',
  LINE = 'line',
  GLOBAL = 'global',
}

export enum AbilityResourceType {
  MANA = 'mana',
  STAMINA = 'stamina',
  HEALTH = 'health',
  RAGE = 'rage',
  ENERGY = 'energy',
  COOLDOWN_ONLY = 'cooldown_only',
}

export interface AbilityEffect {
  type: 'damage' | 'heal' | 'shield' | 'buff' | 'debuff' | 'movement' | 'spawn' | 'custom';
  value?: number;
  duration?: number;
  radius?: number;
  statModifiers?: Partial<CharacterStats>;
  statusEffect?: StatusEffectData;
  customHandler?: (context: AbilityExecutionContext) => void;
}

export interface StatusEffectData {
  id: string;
  name: string;
  type: 'buff' | 'debuff';
  duration: number;
  stackable: boolean;
  maxStacks: number;
  modifiers?: Partial<CharacterStats>;
  tickInterval?: number;
  tickEffect?: AbilityEffect;
  onApply?: (target: AbilityTarget) => void;
  onRemove?: (target: AbilityTarget) => void;
  onTick?: (target: AbilityTarget) => void;
  visualEffect?: string;
}

export interface AbilityTarget {
  entity: Entity;
  position: THREE.Vector3;
}

export interface AbilityExecutionContext {
  caster: Entity;
  targets: AbilityTarget[];
  position: THREE.Vector3;
  direction: THREE.Vector3;
  level: number;
  chargeTime: number;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  type: AbilityType;
  targetType: AbilityTargetType;
  resourceType: AbilityResourceType;
  resourceCost: number;
  cooldown: number;
  range: number;
  areaRadius?: number;
  castTime: number;
  channelTime: number;
  maxCharges?: number;
  chargeRechargeTime?: number;
  effects: AbilityEffect[];
  requirements?: AbilityRequirement[];
  tags: string[];
  animationState?: string;
  vfx?: string;
  sfx?: string;
  aiUsageRules?: AIUsageRule[];
  currentCooldown?: number;
}

export interface AbilityRequirement {
  type: 'level' | 'stat' | 'resource' | 'condition' | 'item';
  value: number | string;
  operator: '>=' | '<=' | '==' | '!=' | '>' | '<';
}

export interface AIUsageRule {
  situation: 'combat_start' | 'low_health' | 'enemy_close' | 'enemy_far' | 'multiple_enemies' | 'boss_fight' | 'fleeing' | 'idle';
  priority: number;
  conditions?: ((context: AIAbilityContext) => boolean)[];
}

export interface AIAbilityContext {
  self: Entity;
  target: Entity | null;
  nearbyEnemies: Entity[];
  nearbyAllies: Entity[];
  healthPercent: number;
  resourcePercent: number;
  distanceToTarget: number;
}

export interface CharacterStats {
  maxHealth: number;
  maxStamina: number;
  maxMana: number;
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
  health: number;
  stamina: number;
  mana?: number;
  rage?: number;
  energy?: number;
}

export class Ability {
  public readonly definition: AbilityDefinition;
  public cooldownRemaining = 0;
  public charges = 0;
  public maxCharges = 1;
  public chargeRechargeTime = 0;
  public isChanneling = false;
  public channelTimeRemaining = 0;
  public castTimeRemaining = 0;
  public currentTarget: AbilityTarget | null = null;
  public currentDirection = new THREE.Vector3();
  public currentPosition = new THREE.Vector3();

  constructor(definition: AbilityDefinition, public readonly owner: Entity) {
    this.definition = definition;
    this.maxCharges = definition.maxCharges || 1;
    this.charges = this.maxCharges;
    this.chargeRechargeTime = definition.chargeRechargeTime || definition.cooldown / this.maxCharges;
  }

  canUse(context?: Partial<AbilityExecutionContext>): { canUse: boolean; reason?: string } {
    if (this.cooldownRemaining > 0) {
      return { canUse: false, reason: 'On cooldown' };
    }

    if (this.charges <= 0 && this.maxCharges > 0) {
      return { canUse: false, reason: 'No charges' };
    }

    if (this.isChanneling || this.castTimeRemaining > 0) {
      return { canUse: false, reason: 'Already casting' };
    }

    if (this.definition.resourceType !== AbilityResourceType.COOLDOWN_ONLY) {
      const resource = this.getResource(this.definition.resourceType);
      if (resource < this.definition.resourceCost) {
        return { canUse: false, reason: `Insufficient ${this.definition.resourceType}` };
      }
    }

    if (this.definition.requirements) {
      for (const req of this.definition.requirements) {
        if (!this.checkRequirement(req)) {
          return { canUse: false, reason: `Requirement not met: ${req.type}` };
        }
      }
    }

    return { canUse: true };
  }

  private getResource(type: AbilityResourceType): number {
    switch (type) {
      case AbilityResourceType.MANA: return this.owner.stats.mana ?? this.owner.stats.maxMana;
      case AbilityResourceType.STAMINA: return this.owner.stats.stamina ?? this.owner.stats.maxStamina;
      case AbilityResourceType.HEALTH: return this.owner.stats.health ?? this.owner.stats.maxHealth;
      case AbilityResourceType.RAGE: return this.owner.stats.rage ?? 0;
      case AbilityResourceType.ENERGY: return this.owner.stats.energy ?? 0;
      default: return Infinity;
    }
  }

  private checkRequirement(req: AbilityRequirement): boolean {
    let value: number;
    switch (req.type) {
      case 'level': value = this.owner.level; break;
      case 'stat':
        value = this.owner.stats[req.value as keyof CharacterStats] as number ?? 0; break;
      case 'resource':
        value = this.getResource(req.value as AbilityResourceType); break;
      case 'condition':
        return this.owner.checkCondition(req.value as string);
      case 'item':
        return this.owner.hasItem(req.value as string);
      default: return false;
    }

    switch (req.operator) {
      case '>=': return value >= (req.value as number);
      case '<=': return value <= (req.value as number);
      case '==': return value === (req.value as number);
      case '!=': return value !== (req.value as number);
      case '>': return value > (req.value as number);
      case '<': return value < (req.value as number);
      default: return false;
    }
  }

  startCast(target: AbilityTarget | null, direction: THREE.Vector3, position: THREE.Vector3): boolean {
    const check = this.canUse();
    if (!check.canUse) return false;

    this.currentTarget = target;
    this.currentDirection.copy(direction);
    this.currentPosition.copy(position);
    this.castTimeRemaining = this.definition.castTime;
    this.channelTimeRemaining = this.definition.channelTime;

    if (this.definition.castTime > 0) {
      this.owner.setState('casting', true);
    } else {
      this.execute();
    }

    return true;
  }

  update(deltaTime: number): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaTime);
    }

    if (this.chargeRechargeTime > 0 && this.charges < this.maxCharges) {
      this.chargeRechargeTime -= deltaTime;
      if (this.chargeRechargeTime <= 0) {
        this.charges = Math.min(this.maxCharges, this.charges + 1);
        if (this.charges < this.maxCharges) {
          this.chargeRechargeTime = this.definition.cooldown / this.maxCharges;
        }
      }
    }

    if (this.castTimeRemaining > 0) {
      this.castTimeRemaining -= deltaTime;
      if (this.castTimeRemaining <= 0) {
        this.execute();
      }
    }

    if (this.isChanneling) {
      this.channelTimeRemaining -= deltaTime;
      if (this.channelTimeRemaining <= 0) {
        this.isChanneling = false;
        this.owner.setState('casting', false);
      }
    }
  }

  private execute(): void {
    const context: AbilityExecutionContext = {
      caster: this.owner,
      targets: this.currentTarget ? [this.currentTarget] : [],
      position: this.currentPosition.clone(),
      direction: this.currentDirection.clone(),
      level: this.getAbilityLevel(),
      chargeTime: this.definition.castTime - this.castTimeRemaining,
    };

    if (this.definition.resourceType !== AbilityResourceType.COOLDOWN_ONLY) {
      this.consumeResource(this.definition.resourceType, this.definition.resourceCost);
    }

    this.cooldownRemaining = this.definition.cooldown;
    if (this.maxCharges > 0) {
      this.charges--;
      if (this.charges === 0) {
        this.chargeRechargeTime = this.definition.cooldown / this.maxCharges;
      }
    }

    if (this.definition.channelTime > 0) {
      this.isChanneling = true;
      this.channelTimeRemaining = this.definition.channelTime;
    } else {
      this.applyEffects(context);
      this.owner.setState('casting', false);
    }

    gameEvents.emit('ability-used', { abilityId: this.definition.id, caster: this.owner.id });
  }

  private applyEffects(context: AbilityExecutionContext): void {
    for (const effect of this.definition.effects) {
      this.applyEffect(effect, context);
    }
  }

  private applyEffect(effect: AbilityEffect, context: AbilityExecutionContext): void {
    const targets = this.getTargetsForEffect(effect, context);

    for (const target of targets) {
      switch (effect.type) {
        case 'damage':
          this.applyDamage(target, effect, context);
          break;
        case 'heal':
          this.applyHeal(target, effect);
          break;
        case 'shield':
          this.applyShield(target, effect);
          break;
        case 'buff':
        case 'debuff':
          this.applyStatusEffect(target, effect);
          break;
        case 'movement':
          this.applyMovement(target, effect);
          break;
        case 'spawn':
          this.applySpawn(target, effect);
          break;
        case 'custom':
          if (effect.customHandler) effect.customHandler(context);
          break;
      }
    }

    gameEvents.emit('ability-effect', { abilityId: this.definition.id, effect, targets: targets.map(t => t.entity.id) });
  }

  private getTargetsForEffect(effect: AbilityEffect, context: AbilityExecutionContext): AbilityTarget[] {
    switch (this.definition.targetType) {
      case AbilityTargetType.SELF:
        return [{ entity: this.owner, position: this.owner.position.clone() }];
      case AbilityTargetType.TARGET:
        return context.targets.length > 0 ? context.targets : [{ entity: this.owner, position: this.owner.position.clone() }];
      case AbilityTargetType.AREA:
        return this.getAreaTargets(context.position, effect.radius || this.definition.areaRadius || 3);
      case AbilityTargetType.DIRECTION:
        return this.getDirectionTargets(context.position, context.direction, this.definition.range);
      case AbilityTargetType.GROUND:
        return [{ entity: this.owner, position: context.position.clone() }];
      case AbilityTargetType.CONE:
        return this.getConeTargets(context.position, context.direction, this.definition.range, Math.PI / 3);
      case AbilityTargetType.LINE:
        return this.getLineTargets(context.position, context.direction, this.definition.range);
      case AbilityTargetType.GLOBAL:
        return this.owner.world?.getAllEntities().map(e => ({ entity: e, position: e.position.clone() })) || [];
      default:
        return context.targets;
    }
  }

  private getAreaTargets(center: THREE.Vector3, radius: number): AbilityTarget[] {
    const targets: AbilityTarget[] = [];
    const entities = this.owner.world?.getEntitiesInRadius(center, radius) || [];
    for (const entity of entities) {
      targets.push({ entity, position: entity.position.clone() });
    }
    return targets;
  }

  private getConeTargets(origin: THREE.Vector3, direction: THREE.Vector3, range: number, angle: number): AbilityTarget[] {
    const targets: AbilityTarget[] = [];
    const entities = this.owner.world?.getEntitiesInCone(origin, direction, range, angle) || [];
    for (const entity of entities) {
      targets.push({ entity, position: entity.position.clone() });
    }
    return targets;
  }

  private getLineTargets(origin: THREE.Vector3, direction: THREE.Vector3, range: number): AbilityTarget[] {
    const targets: AbilityTarget[] = [];
    const entities = this.owner.world?.getEntitiesInLine(origin, direction, range) || [];
    for (const entity of entities) {
      targets.push({ entity, position: entity.position.clone() });
    }
    return targets;
  }

  private getDirectionTargets(origin: THREE.Vector3, direction: THREE.Vector3, range: number): AbilityTarget[] {
    return this.getLineTargets(origin, direction, range);
  }

  private applyDamage(target: AbilityTarget, effect: AbilityEffect, context: AbilityExecutionContext): void {
    if (!effect.value) return;
    let damage = effect.value * (1 + (context.level - 1) * 0.1);
    if (Math.random() < this.owner.stats.criticalChance) {
      damage *= this.owner.stats.criticalMultiplier;
    }
    damage = Math.max(1, damage - target.entity.stats.defense);
    target.entity.takeDamage(damage, this.owner, 'ability');
  }

  private applyHeal(target: AbilityTarget, effect: AbilityEffect): void {
    if (!effect.value) return;
    target.entity.heal(effect.value);
  }

  private applyShield(target: AbilityTarget, effect: AbilityEffect): void {
    if (!effect.value) return;
    target.entity.addShield(effect.value, effect.duration);
  }

  private applyStatusEffect(target: AbilityTarget, effect: AbilityEffect): void {
    if (!effect.statusEffect) return;
    target.entity.addStatusEffect({
      ...effect.statusEffect,
      source: this.owner,
      abilityId: this.definition.id,
    });
  }

  private applyMovement(target: AbilityTarget, effect: AbilityEffect): void {
    if (!effect.value) return;
    target.entity.applyKnockback(this.currentDirection.clone().multiplyScalar(effect.value));
  }

  private applySpawn(target: AbilityTarget, effect: AbilityEffect): void {
    if (effect.customHandler) {
      effect.customHandler({ ...target, effect } as any);
    }
  }

  private consumeResource(type: AbilityResourceType, amount: number): void {
    switch (type) {
      case AbilityResourceType.MANA:
        this.owner.stats.mana = Math.max(0, (this.owner.stats.mana ?? this.owner.stats.maxMana) - amount);
        break;
      case AbilityResourceType.STAMINA:
        this.owner.stats.stamina = Math.max(0, (this.owner.stats.stamina ?? this.owner.stats.maxStamina) - amount);
        break;
      case AbilityResourceType.HEALTH:
        this.owner.takeDamage(amount, this.owner, 'ability_cost');
        break;
    }
  }

  getAbilityLevel(): number {
    return this.owner.abilityLevels.get(this.definition.id) || 1;
  }

  setLevel(level: number): void {
    this.owner.abilityLevels.set(this.definition.id, Math.max(1, level));
  }

  getCooldownPercent(): number {
    return this.definition.cooldown > 0 ? this.cooldownRemaining / this.definition.cooldown : 0;
  }

  interrupt(): void {
    this.castTimeRemaining = 0;
    this.channelTimeRemaining = 0;
    this.isChanneling = false;
    this.currentTarget = null;
    this.owner.setState('casting', false);
  }

  toJSON(): object {
    return {
      id: this.definition.id,
      cooldownRemaining: this.cooldownRemaining,
      charges: this.charges,
      chargeRechargeTime: this.chargeRechargeTime,
      level: this.getAbilityLevel(),
    };
  }

  static fromJSON(data: any, definition: AbilityDefinition, owner: Entity): Ability {
    const ability = new Ability(definition, owner);
    ability.cooldownRemaining = data.cooldownRemaining || 0;
    ability.charges = data.charges ?? ability.maxCharges;
    ability.chargeRechargeTime = data.chargeRechargeTime || 0;
    if (data.level) ability.setLevel(data.level);
    return ability;
  }
}

export class AbilitySystem {
  private abilities: Map<string, Ability> = new Map();
  private globalCooldown = 0;
  private globalCooldownDuration = 0.5;

  constructor(private owner: Entity) {}

  addAbility(definition: AbilityDefinition): Ability {
    const ability = new Ability(definition, this.owner);
    this.abilities.set(definition.id, ability);
    return ability;
  }

  removeAbility(id: string): boolean {
    return this.abilities.delete(id);
  }

  getAbility(id: string): Ability | undefined {
    return this.abilities.get(id);
  }

  getAllAbilities(): Ability[] {
    return Array.from(this.abilities.values());
  }

  useAbility(id: string, target: AbilityTarget | null, direction: THREE.Vector3, position: THREE.Vector3): boolean {
    if (this.globalCooldown > 0) return false;

    const ability = this.abilities.get(id);
    if (!ability) return false;

    const result = ability.startCast(target, direction, position);
    if (result) {
      this.globalCooldown = this.globalCooldownDuration;
    }
    return result;
  }

  update(deltaTime: number): void {
    if (this.globalCooldown > 0) {
      this.globalCooldown = Math.max(0, this.globalCooldown - deltaTime);
    }

    for (const ability of this.abilities.values()) {
      ability.update(deltaTime);
    }
  }

  getAvailableAbilities(): Ability[] {
    return this.getAllAbilities().filter(a => a.canUse().canUse);
  }

  getAbilitiesByType(type: AbilityType): Ability[] {
    return this.getAllAbilities().filter(a => a.definition.type === type);
  }

  interruptAll(): void {
    for (const ability of this.abilities.values()) {
      ability.interrupt();
    }
  }

  toJSON(): object {
    return {
      globalCooldown: this.globalCooldown,
      abilities: Array.from(this.abilities.entries()).map(([id, ability]) => [id, ability.toJSON()]),
    };
  }

  static fromJSON(data: any, owner: Entity, definitions: Map<string, AbilityDefinition>): AbilitySystem {
    const system = new AbilitySystem(owner);
    for (const [id, abilityData] of data.abilities || []) {
      const definition = definitions.get(id);
      if (definition) {
        const ability = Ability.fromJSON(abilityData, definition, owner);
        system.abilities.set(id, ability);
      }
    }
    system.globalCooldown = data.globalCooldown || 0;
    return system;
  }
}

export interface Entity {
  id: string;
  position: THREE.Vector3;
  stats: CharacterStats;
  level: number;
  abilityLevels: Map<string, number>;
  world?: World;
  isAlive: boolean;
  faction: string;
  takeDamage(amount: number, source: Entity, type: string): void;
  heal(amount: number): void;
  addShield(amount: number, duration?: number): void;
  addStatusEffect(effect: any): void;
  applyKnockback(force: THREE.Vector3): void;
  setState(state: string, value: boolean): void;
  checkCondition(condition: string): boolean;
  hasItem(itemId: string): boolean;
  getDistanceTo(entity: Entity): number;
  getDistanceToPosition(pos: THREE.Vector3): number;
  attack(target: Entity): void;
  useAbility(abilityId: string, target: Entity | null): boolean;
  getState(state: string): boolean;
}

export interface World {
  getEntitiesInRadius(center: THREE.Vector3, radius: number): Entity[];
  getEntitiesInCone(origin: THREE.Vector3, direction: THREE.Vector3, range: number, angle: number): Entity[];
  getEntitiesInLine(origin: THREE.Vector3, direction: THREE.Vector3, range: number): Entity[];
  getAllEntities(): Entity[];
}

export const createAbilitySystem = (owner: Entity): AbilitySystem => {
  return new AbilitySystem(owner);
};

export const createAbility = (definition: AbilityDefinition, owner: Entity): Ability => {
  return new Ability(definition, owner);
};

export const COMMON_ABILITIES: Record<string, AbilityDefinition> = {
  basic_attack: {
    id: 'basic_attack',
    name: 'Basic Attack',
    description: 'A simple melee attack',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 10,
    cooldown: 1.0,
    range: 3,
    castTime: 0.2,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 15 }],
    tags: ['melee', 'basic'],
    animationState: 'attack',
  },
  heavy_swing: {
    id: 'heavy_swing',
    name: 'Heavy Swing',
    description: 'A powerful but slow attack',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 25,
    cooldown: 3.0,
    range: 3.5,
    castTime: 0.5,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 35 }, { type: 'movement', value: 5 }],
    tags: ['melee', 'heavy', 'knockback'],
    animationState: 'heavy_attack',
  },
  shield_block: {
    id: 'shield_block',
    name: 'Shield Block',
    description: 'Block incoming damage with a shield',
    type: AbilityType.DEFENSIVE,
    targetType: AbilityTargetType.SELF,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 15,
    cooldown: 8.0,
    range: 0,
    castTime: 0,
    channelTime: 2.0,
    maxCharges: 1,
    effects: [{ type: 'shield', value: 50, duration: 2 }],
    tags: ['defensive', 'shield'],
    animationState: 'block',
  },
  charge: {
    id: 'charge',
    name: 'Charge',
    description: 'Dash forward, damaging enemies in path',
    type: AbilityType.MOVEMENT,
    targetType: AbilityTargetType.DIRECTION,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 20,
    cooldown: 10.0,
    range: 15,
    castTime: 0.3,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 20 }, { type: 'movement', value: 20 }],
    tags: ['movement', 'charge', 'gap_closer'],
    animationState: 'sprint',
  },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    description: 'Launch a ball of fire',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.MANA,
    resourceCost: 30,
    cooldown: 5.0,
    range: 20,
    castTime: 0.8,
    channelTime: 0,
    maxCharges: 1,
    areaRadius: 3,
    effects: [
      { type: 'damage', value: 25 },
      { type: 'debuff', statusEffect: { id: 'burn', name: 'Burn', type: 'debuff', duration: 5, stackable: true, maxStacks: 3, tickInterval: 1, tickEffect: { type: 'damage', value: 5 } } },
    ],
    tags: ['ranged', 'fire', 'aoe', 'dot'],
    animationState: 'cast',
  },
  ice_shard: {
    id: 'ice_shard',
    name: 'Ice Shard',
    description: 'Fire a piercing shard of ice',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.LINE,
    resourceType: AbilityResourceType.MANA,
    resourceCost: 20,
    cooldown: 4.0,
    range: 18,
    castTime: 0.5,
    channelTime: 0,
    maxCharges: 1,
    effects: [
      { type: 'damage', value: 20 },
      { type: 'debuff', statusEffect: { id: 'slow', name: 'Slow', type: 'debuff', duration: 3, stackable: false, maxStacks: 1, modifiers: { movementSpeed: -0.5 } } },
    ],
    tags: ['ranged', 'ice', 'piercing', 'slow'],
    animationState: 'cast',
  },
  teleport: {
    id: 'teleport',
    name: 'Teleport',
    description: 'Instantly teleport to target location',
    type: AbilityType.MOVEMENT,
    targetType: AbilityTargetType.GROUND,
    resourceType: AbilityResourceType.MANA,
    resourceCost: 40,
    cooldown: 12.0,
    range: 25,
    castTime: 0.3,
    channelTime: 0,
    maxCharges: 2,
    chargeRechargeTime: 6.0,
    effects: [{ type: 'movement', value: 25 }],
    tags: ['movement', 'teleport', 'utility'],
    animationState: 'dodge',
  },
  mana_shield: {
    id: 'mana_shield',
    name: 'Mana Shield',
    description: 'Absorb damage using mana instead of health',
    type: AbilityType.DEFENSIVE,
    targetType: AbilityTargetType.SELF,
    resourceType: AbilityResourceType.MANA,
    resourceCost: 20,
    cooldown: 15.0,
    range: 0,
    castTime: 0.2,
    channelTime: 10.0,
    maxCharges: 1,
    effects: [{ type: 'shield', value: 100, duration: 10 }],
    tags: ['defensive', 'shield', 'mana'],
    animationState: 'cast',
  },
  arcane_explosion: {
    id: 'arcane_explosion',
    name: 'Arcane Explosion',
    description: 'Explode with arcane energy around you',
    type: AbilityType.ULTIMATE,
    targetType: AbilityTargetType.AREA,
    resourceType: AbilityResourceType.MANA,
    resourceCost: 80,
    cooldown: 30.0,
    range: 0,
    areaRadius: 6,
    castTime: 1.0,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 50 }, { type: 'movement', value: 10 }],
    tags: ['ultimate', 'arcane', 'aoe', 'burst'],
    animationState: 'special',
  },
  backstab: {
    id: 'backstab',
    name: 'Backstab',
    description: 'Deal massive damage when attacking from behind',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 15,
    cooldown: 6.0,
    range: 3,
    castTime: 0.1,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 50 }],
    requirements: [{ type: 'condition', value: 'behind_target', operator: '==' }],
    tags: ['melee', 'stealth', 'burst', 'positional'],
    animationState: 'attack',
  },
  shadow_step: {
    id: 'shadow_step',
    name: 'Shadow Step',
    description: 'Teleport behind target',
    type: AbilityType.MOVEMENT,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 25,
    cooldown: 8.0,
    range: 12,
    castTime: 0.2,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'movement', value: 12 }],
    tags: ['movement', 'stealth', 'teleport', 'positional'],
    animationState: 'dodge',
  },
  poison_blade: {
    id: 'poison_blade',
    name: 'Poison Blade',
    description: 'Apply poison to weapon',
    type: AbilityType.UTILITY,
    targetType: AbilityTargetType.SELF,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 20,
    cooldown: 15.0,
    range: 0,
    castTime: 0.5,
    channelTime: 15.0,
    maxCharges: 1,
    effects: [{ type: 'buff', statusEffect: { id: 'poison_weapon', name: 'Poison Weapon', type: 'buff', duration: 15, stackable: false, maxStacks: 1, tickInterval: 1, tickEffect: { type: 'damage', value: 8 } } }],
    tags: ['buff', 'poison', 'weapon'],
    animationState: 'cast',
  },
  evasion: {
    id: 'evasion',
    name: 'Evasion',
    description: 'Gain temporary dodge chance',
    type: AbilityType.DEFENSIVE,
    targetType: AbilityTargetType.SELF,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 30,
    cooldown: 20.0,
    range: 0,
    castTime: 0.1,
    channelTime: 3.0,
    maxCharges: 1,
    effects: [{ type: 'buff', statusEffect: { id: 'evasion', name: 'Evasion', type: 'buff', duration: 3, stackable: false, maxStacks: 1, modifiers: { criticalChance: 50 } } }],
    tags: ['defensive', 'dodge', 'stealth'],
    animationState: 'dodge',
  },
  smoke_bomb: {
    id: 'smoke_bomb',
    name: 'Smoke Bomb',
    description: 'Create a cloud of smoke to escape',
    type: AbilityType.UTILITY,
    targetType: AbilityTargetType.GROUND,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 35,
    cooldown: 25.0,
    range: 5,
    areaRadius: 4,
    castTime: 0.3,
    channelTime: 0,
    maxCharges: 1,
    effects: [
      { type: 'debuff', statusEffect: { id: 'blind', name: 'Blind', type: 'debuff', duration: 4, stackable: false, maxStacks: 1, modifiers: { criticalChance: -100 } } },
      { type: 'buff', statusEffect: { id: 'concealment', name: 'Concealment', type: 'buff', duration: 4, stackable: false, maxStacks: 1, modifiers: { criticalChance: 30 } } },
    ],
    tags: ['utility', 'escape', 'aoe', 'stealth'],
    animationState: 'special',
  },
  aimed_shot: {
    id: 'aimed_shot',
    name: 'Aimed Shot',
    description: 'A precise shot with increased damage and range',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 20,
    cooldown: 8.0,
    range: 30,
    castTime: 1.0,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 40 }],
    tags: ['ranged', 'precision', 'snipe'],
    animationState: 'attack',
  },
  multi_shot: {
    id: 'multi_shot',
    name: 'Multi Shot',
    description: 'Fire multiple arrows in a cone',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.CONE,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 30,
    cooldown: 12.0,
    range: 20,
    castTime: 0.5,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 15 }],
    tags: ['ranged', 'aoe', 'cone'],
    animationState: 'attack',
  },
  explosive_arrow: {
    id: 'explosive_arrow',
    name: 'Explosive Arrow',
    description: 'Fire an arrow that explodes on impact',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 35,
    cooldown: 15.0,
    range: 25,
    castTime: 0.6,
    channelTime: 0,
    maxCharges: 1,
    areaRadius: 4,
    effects: [{ type: 'damage', value: 30 }, { type: 'movement', value: 8 }],
    tags: ['ranged', 'explosion', 'aoe', 'knockback'],
    animationState: 'attack',
  },
  eagle_eye: {
    id: 'eagle_eye',
    name: 'Eagle Eye',
    description: 'Increase vision range and reveal hidden enemies',
    type: AbilityType.UTILITY,
    targetType: AbilityTargetType.SELF,
    resourceType: AbilityResourceType.MANA,
    resourceCost: 20,
    cooldown: 20.0,
    range: 0,
    castTime: 0.3,
    channelTime: 30.0,
    maxCharges: 1,
    effects: [{ type: 'buff', statusEffect: { id: 'eagle_eye', name: 'Eagle Eye', type: 'buff', duration: 30, stackable: false, maxStacks: 1, modifiers: { attackRange: 10, criticalChance: 25 } } }],
    tags: ['utility', 'vision', 'buff'],
    animationState: 'cast',
  },
  rapid_fire: {
    id: 'rapid_fire',
    name: 'Rapid Fire',
    description: 'Fire arrows rapidly for a short duration',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.DIRECTION,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 40,
    cooldown: 20.0,
    range: 25,
    castTime: 0.2,
    channelTime: 3.0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 10 }],
    tags: ['ranged', 'channel', 'burst'],
    animationState: 'attack',
  },
  trade: {
    id: 'trade',
    name: 'Trade',
    description: 'Open trading interface',
    type: AbilityType.UTILITY,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.COOLDOWN_ONLY,
    resourceCost: 0,
    cooldown: 1.0,
    range: 3,
    castTime: 0.2,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'custom', customHandler: (ctx) => { gameEvents.emit('trade-opened', { merchant: ctx.caster.id, customer: ctx.targets[0]?.entity.id }); } }],
    tags: ['npc', 'trade', 'interaction'],
    animationState: 'interact',
  },
  flee: {
    id: 'flee',
    name: 'Flee',
    description: 'Run away from danger',
    type: AbilityType.MOVEMENT,
    targetType: AbilityTargetType.DIRECTION,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 20,
    cooldown: 10.0,
    range: 15,
    castTime: 0.2,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'movement', value: 15 }, { type: 'buff', statusEffect: { id: 'flee_speed', name: 'Flee Speed', type: 'buff', duration: 5, stackable: false, maxStacks: 1, modifiers: { movementSpeed: 2.0 } } }],
    tags: ['movement', 'escape', 'ai'],
    animationState: 'sprint',
  },
  infect: {
    id: 'infect',
    name: 'Infect',
    description: 'Apply disease on hit',
    type: AbilityType.TRIGGERED,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.COOLDOWN_ONLY,
    resourceCost: 0,
    cooldown: 5.0,
    range: 3,
    castTime: 0,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'debuff', statusEffect: { id: 'disease', name: 'Disease', type: 'debuff', duration: 30, stackable: true, maxStacks: 5, tickInterval: 5, tickEffect: { type: 'damage', value: 3 } } }],
    tags: ['passive', 'disease', 'dot'],
    animationState: 'attack',
  },
  arrow_shot: {
    id: 'arrow_shot',
    name: 'Arrow Shot',
    description: 'Fire an arrow at target',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 10,
    cooldown: 2.0,
    range: 20,
    castTime: 0.4,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 12 }],
    tags: ['ranged', 'basic'],
    animationState: 'shoot',
  },
  strafe: {
    id: 'strafe',
    name: 'Strafe',
    description: 'Move sideways while shooting',
    type: AbilityType.MOVEMENT,
    targetType: AbilityTargetType.DIRECTION,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 15,
    cooldown: 5.0,
    range: 8,
    castTime: 0.2,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'movement', value: 8 }],
    tags: ['movement', 'ranged', 'kiting'],
    animationState: 'walk',
  },
  explode: {
    id: 'explode',
    name: 'Explode',
    description: 'Self-destruct with massive damage',
    type: AbilityType.ULTIMATE,
    targetType: AbilityTargetType.AREA,
    resourceType: AbilityResourceType.HEALTH,
    resourceCost: 100,
    cooldown: 0,
    range: 0,
    areaRadius: 6,
    castTime: 1.5,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 100 }, { type: 'movement', value: 15 }],
    requirements: [{ type: 'condition', value: 'near_player', operator: '==' }],
    tags: ['ultimate', 'explosion', 'suicide', 'aoe'],
    animationState: 'special',
  },
  charge_creeper: {
    id: 'charge_creeper',
    name: 'Charge',
    description: 'Move faster towards target',
    type: AbilityType.MOVEMENT,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.STAMINA,
    resourceCost: 10,
    cooldown: 3.0,
    range: 10,
    castTime: 0.3,
    channelTime: 2.0,
    maxCharges: 1,
    effects: [{ type: 'movement', value: 10 }, { type: 'buff', statusEffect: { id: 'charging', name: 'Charging', type: 'buff', duration: 2, stackable: false, maxStacks: 1, modifiers: { movementSpeed: 1.5 } } }],
    tags: ['movement', 'charge', 'ai'],
    animationState: 'run',
  },
  teleport_attack: {
    id: 'teleport_attack',
    name: 'Teleport Attack',
    description: 'Teleport behind target and attack',
    type: AbilityType.ACTIVE,
    targetType: AbilityTargetType.TARGET,
    resourceType: AbilityResourceType.MANA,
    resourceCost: 25,
    cooldown: 8.0,
    range: 20,
    castTime: 0.2,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'damage', value: 25 }, { type: 'movement', value: 20 }],
    tags: ['teleport', 'melee', 'burst', 'positional'],
    animationState: 'attack',
  },
  block_pickup: {
    id: 'block_pickup',
    name: 'Block Pickup',
    description: 'Pick up and carry a block',
    type: AbilityType.UTILITY,
    targetType: AbilityTargetType.GROUND,
    resourceType: AbilityResourceType.COOLDOWN_ONLY,
    resourceCost: 0,
    cooldown: 2.0,
    range: 5,
    castTime: 0.5,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'custom', customHandler: (ctx) => { gameEvents.emit('block-picked-up', { entity: ctx.caster.id, position: ctx.position }); } }],
    tags: ['utility', 'block', 'enderman'],
    animationState: 'interact',
  },
  scream: {
    id: 'scream',
    name: 'Scream',
    description: 'Terrify nearby enemies',
    type: AbilityType.ULTIMATE,
    targetType: AbilityTargetType.AREA,
    resourceType: AbilityResourceType.MANA,
    resourceCost: 40,
    cooldown: 20.0,
    range: 0,
    areaRadius: 10,
    castTime: 0.5,
    channelTime: 0,
    maxCharges: 1,
    effects: [{ type: 'debuff', statusEffect: { id: 'fear', name: 'Fear', type: 'debuff', duration: 3, stackable: false, maxStacks: 1, modifiers: { movementSpeed: -0.5 } } }],
    tags: ['ultimate', 'fear', 'aoe', 'cc'],
    animationState: 'special',
  },
};