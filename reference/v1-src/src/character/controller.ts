import * as THREE from 'three';
import { gameEvents } from '../core/events';
import { PhysicsWorld, PhysicsEntity, createPhysicsEntity, createPhysicsWorld, CollisionLayer, CollisionFlags, DEFAULT_MATERIAL } from '../physics/physics';
import { AnimationController, AnimationState, AnimationContext } from '../character/animation';
import { Entity, World, AbilitySystem, Ability, COMMON_ABILITIES, AbilityType, AbilityTargetType, AbilityTarget } from '../character/abilities';
import { AIController, AIManager, AIEntity, AIState, createAIController, createAIManager } from '../character/ai';
import {
  CharacterDefinition,
  CharacterInstance,
  CharacterStats,
  Equipment,
  ItemInstance,
  CharacterFaction,
  CharacterRole,
} from '../character/types';

export interface CharacterControllerConfig {
  id: string;
  definition: CharacterDefinition;
  isPlayer: boolean;
  position: THREE.Vector3;
  physicsWorld: PhysicsWorld;
}

export class CharacterController implements AIEntity {
  public readonly id: string;
  public readonly definition: CharacterDefinition;
  public readonly isPlayer: boolean;
  public readonly physicsEntity: PhysicsEntity;
  public readonly animationController: AnimationController;
  public readonly abilitySystem: AbilitySystem;
  public readonly aiController: AIController | null;
  
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public stats: CharacterStats;
  public level: number;
  public experience: number;
  public faction: CharacterFaction;
  public role: CharacterRole;
  public isAlive: boolean;
  public equipment: Equipment;
  public inventory: ItemInstance[];
  public abilityLevels: Map<string, number>;
  public world?: any;

  private physicsWorld: PhysicsWorld;
  private stateFlags: Map<string, boolean> = new Map();
  private lastDamageTime = 0;
  private invulnerabilityTime = 0;
  private moveInput = new THREE.Vector3();
  private lookDirection = new THREE.Vector3(0, 0, -1);
  private targetPosition: THREE.Vector3 | null = null;
  private moveSpeed = 0;

  constructor(config: CharacterControllerConfig) {
    this.id = config.id;
    this.definition = config.definition;
    this.isPlayer = config.isPlayer;
    this.physicsWorld = config.physicsWorld;
    this.position = config.position.clone();
    this.velocity = new THREE.Vector3();
    
    this.level = 1;
    this.experience = 0;
    this.faction = config.definition.faction;
    this.role = config.definition.role;
    this.isAlive = true;
    this.equipment = { ...config.definition.equipment };
    this.inventory = [...config.definition.inventory];
    this.abilityLevels = new Map();

    this.stats = this.initializeStats(config.definition.stats);
    
    this.physicsEntity = this.createPhysicsEntity(config.position);
    this.physicsWorld.addEntity(this.physicsEntity);

    this.animationController = new AnimationController();
    this.setupAnimations();

    this.abilitySystem = new AbilitySystem(this);
    this.setupAbilities();

    if (!this.isPlayer) {
      this.aiController = createAIController(this, {
        perceptionRange: config.definition.aiProfile.perceptionRange,
        attackRange: config.definition.aiProfile.patrolRadius > 0 ? 3 : config.definition.stats.attackRange,
        fleeThreshold: 0.3,
        wanderRadius: config.definition.aiProfile.patrolRadius,
      });
      
      if (config.definition.aiProfile.patrolPoints.length > 0) {
        this.aiController.setPatrolPoints(config.definition.aiProfile.patrolPoints.map(p => new THREE.Vector3(p.x, p.y, p.z)));
      }
      this.aiController.setHomePosition(config.position);
    } else {
      this.aiController = null;
    }

    gameEvents.emit('character-created', { characterId: this.id, isPlayer: this.isPlayer });
  }

  private initializeStats(baseStats: CharacterStats): CharacterStats {
    return {
      maxHealth: baseStats.maxHealth,
      health: baseStats.maxHealth,
      maxStamina: baseStats.maxStamina,
      stamina: baseStats.maxStamina,
      maxMana: baseStats.maxMana || baseStats.maxStamina * 0.5,
      mana: baseStats.maxMana || baseStats.maxStamina * 0.5,
      movementSpeed: baseStats.movementSpeed,
      acceleration: baseStats.acceleration,
      jumpForce: baseStats.jumpForce || baseStats.acceleration * 0.5,
      attackDamage: baseStats.attackDamage || baseStats.damage,
      attackSpeed: baseStats.attackSpeed,
      attackRange: baseStats.attackRange,
      defense: baseStats.defense,
      magicResistance: baseStats.magicResistance || 0,
      criticalChance: baseStats.criticalChance || 0,
      criticalMultiplier: baseStats.criticalMultiplier || 1.5,
      healthRegen: baseStats.healthRegen || 1,
      staminaRegen: baseStats.staminaRegen || 10,
      manaRegen: baseStats.manaRegen || 5,
      intelligence: baseStats.intelligence || 0,
      perception: baseStats.perception || 0,
      stealth: baseStats.stealth || 0,
      luck: baseStats.luck || 0,
    };
  }

  private createPhysicsEntity(position: THREE.Vector3): PhysicsEntity {
    const halfExtents = new THREE.Vector3(0.4, 0.9, 0.4);
    return createPhysicsEntity(
      this.id,
      position,
      halfExtents,
      this.isPlayer ? 0 : 70,
      {
        layer: this.isPlayer ? CollisionLayer.PLAYER : CollisionLayer.CREATURE,
        mask: CollisionFlags.ALL,
        material: DEFAULT_MATERIAL,
        useGravity: true,
        gravityScale: 1,
        maxSpeed: this.stats.movementSpeed,
        linearDamping: 0.1,
        userData: { controller: this },
      }
    );
  }

  private setupAnimations(): void {
    const animProfile = this.definition.animationProfile;
    
    for (const [stateName, clip] of Object.entries(animProfile.animations)) {
      const state = stateName as AnimationState;
      this.animationController.registerAnimation(state, clip.id, {
        loop: clip.loop,
        speed: clip.speed,
        priority: clip.events.some(e => e.type === 'hitbox') ? 2 : 1,
      });
    }
  }

  private setupAbilities(): void {
    for (const abilityDef of this.definition.abilities) {
      const ability = this.abilitySystem.addAbility({
        id: abilityDef.id,
        name: abilityDef.name,
        description: abilityDef.description,
        type: abilityDef.type,
        targetType: abilityDef.targetType as any,
        resourceType: abilityDef.resourceType as any,
        resourceCost: abilityDef.resourceCost,
        cooldown: abilityDef.cooldown,
        range: abilityDef.range,
        areaRadius: abilityDef.areaRadius,
        castTime: abilityDef.castTime,
        channelTime: abilityDef.channelTime,
        effects: abilityDef.effects.map(e => ({
          type: e.type as any,
          value: e.value,
          duration: e.duration,
          radius: (e as any).areaRadius,
          statusEffect: e.statusEffect ? {
            id: e.statusEffect.id,
            name: e.statusEffect.name,
            type: e.type === 'buff' ? 'buff' : 'debuff',
            duration: e.duration || 5,
            stackable: false,
            maxStacks: 1,
          } : undefined,
        })),
        tags: abilityDef.tags,
        animationState: abilityDef.animationState,
        vfx: abilityDef.vfx,
        sfx: abilityDef.sfx,
        aiUsageRules: abilityDef.aiUsageRules?.map(r => ({
          situation: r.situation as any,
          priority: r.priority,
        })),
      });
    }
  }

  update(deltaTime: number): void {
    if (!this.isAlive) return;

    this.physicsEntity.position.copy(this.position);
    this.physicsEntity.velocity.copy(this.velocity);

    if (this.isPlayer) {
      this.updatePlayerMovement(deltaTime);
    } else if (this.aiController) {
      this.aiController.update(deltaTime);
      this.updateAIMovement(deltaTime);
    }

    this.updateAnimation(deltaTime);
    this.abilitySystem.update(deltaTime);
    this.regenerateResources(deltaTime);
    this.updateInvulnerability(deltaTime);
  }

  private updatePlayerMovement(deltaTime: number): void {
    const accel = this.stats.acceleration;
    const maxSpeed = this.stats.movementSpeed;
    
    const inputDir = this.moveInput.clone().normalize();
    if (inputDir.lengthSq() > 0) {
      const targetVel = inputDir.multiplyScalar(maxSpeed);
      const diff = new THREE.Vector3().subVectors(targetVel, this.velocity);
      const accelForce = diff.clampLength(0, accel * deltaTime);
      this.velocity.add(accelForce);
    } else {
      this.velocity.x *= Math.pow(0.1, deltaTime);
      this.velocity.z *= Math.pow(0.1, deltaTime);
    }

    this.velocity.y += -30 * deltaTime;
    this.velocity.y = Math.max(this.velocity.y, -50);

    this.position.addScaledVector(this.velocity, deltaTime);
    this.physicsEntity.position.copy(this.position);
    this.physicsEntity.velocity.copy(this.velocity);
    this.physicsWorld.updateEntity(this.physicsEntity);
  }

  private updateAIMovement(deltaTime: number): void {
    if (!this.aiController) return;
    
    const context = this.aiController.getContext();
    if (context.target) {
      const dir = new THREE.Vector3().subVectors(context.target.position, this.position);
      dir.y = 0;
      if (dir.lengthSq() > 0) {
        dir.normalize();
        this.lookDirection.copy(dir);
      }
    }
  }

  private updateAnimation(deltaTime: number): void {
    const animContext: Partial<AnimationContext> = {
      velocity: this.velocity.clone(),
      onGround: this.physicsEntity.onGround,
      health: this.stats.health,
      maxHealth: this.stats.maxHealth,
      stamina: this.stats.stamina,
      maxStamina: this.stats.maxStamina,
      isAttacking: this.getState('attacking'),
      isBlocking: this.getState('blocking'),
      isDodging: this.getState('dodging'),
      isCasting: this.getState('casting'),
      isInteracting: this.getState('interacting'),
      lastDamageTime: this.lastDamageTime,
      isSprinting: this.getState('sprinting'),
    };

    this.animationController.updateContext(animContext);
    this.animationController.update(deltaTime);
  }

  private regenerateResources(deltaTime: number): void {
    this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + 10 * deltaTime);
    this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana + 5 * deltaTime);
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + 1 * deltaTime);
    this.stats.rage = Math.max(0, this.stats.rage - 5 * deltaTime);
    this.stats.energy = Math.min(this.stats.maxStamina, this.stats.energy + 8 * deltaTime);
  }

  private updateInvulnerability(deltaTime: number): void {
    if (this.invulnerabilityTime > 0) {
      this.invulnerabilityTime -= deltaTime;
    }
  }

  setMoveInput(input: THREE.Vector3): void {
    this.moveInput.copy(input);
  }

  setLookDirection(dir: THREE.Vector3): void {
    this.lookDirection.copy(dir);
  }

  jump(): boolean {
    if (this.physicsEntity.onGround && this.stats.stamina >= 10) {
      this.velocity.y = this.stats.acceleration * 0.5;
      this.stats.stamina -= 10;
      this.animationController.setState(AnimationState.JUMP);
      return true;
    }
    return false;
  }

  attack(target?: Entity): void {
    const abilities = this.abilitySystem.getAbilitiesByType(AbilityType.ACTIVE);
    if (abilities.length > 0) {
      const ability = abilities[0];
      const abilityTarget: AbilityTarget | null = target ? { entity: target, position: target.position.clone() } : null;
      this.abilitySystem.useAbility(ability.definition.id, abilityTarget, this.lookDirection.clone(), this.position.clone());
    }
  }

  useAbility(abilityId: string, target: Entity | null): boolean {
    const abilityTarget: AbilityTarget | null = target ? { entity: target, position: target.position.clone() } : null;
    return this.abilitySystem.useAbility(abilityId, abilityTarget, this.lookDirection.clone(), this.position.clone());
  }

  moveTo(target: THREE.Vector3, speed?: number): void {
    this.targetPosition = target.clone();
    this.moveSpeed = speed || this.stats.movementSpeed;
    
    const dir = new THREE.Vector3().subVectors(target, this.position);
    dir.y = 0;
    if (dir.lengthSq() > 0) {
      dir.normalize();
      this.moveInput.copy(dir);
      this.lookDirection.copy(dir);
    }
  }

  stopMovement(): void {
    this.moveInput.set(0, 0, 0);
    this.targetPosition = null;
  }

  lookAt(target: THREE.Vector3): void {
    const dir = new THREE.Vector3().subVectors(target, this.position);
    dir.y = 0;
    if (dir.lengthSq() > 0) {
      dir.normalize();
      this.lookDirection.copy(dir);
    }
  }

  takeDamage(amount: number, source: Entity, type: string): void {
    if (!this.isAlive || this.invulnerabilityTime > 0) return;

    const actualDamage = Math.max(1, amount - this.stats.defense * 0.5);
    this.stats.health = Math.max(0, this.stats.health - actualDamage);
    this.lastDamageTime = Date.now();
    this.invulnerabilityTime = 0.3;

    this.animationController.setState(AnimationState.HIT);
    
    if (this.stats.health <= 0) {
      this.die();
    } else if (this.aiController && this.stats.health / this.stats.maxHealth < 0.3) {
      this.aiController.getContext().blackboard.set('lowHealth', true);
    }

    gameEvents.emit('character-damaged', { 
      characterId: this.id, 
      damage: actualDamage, 
      sourceId: source.id, 
      type,
      remainingHealth: this.stats.health 
    });
  }

  heal(amount: number): void {
    if (!this.isAlive) return;
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
    gameEvents.emit('character-healed', { characterId: this.id, amount, health: this.stats.health });
  }

  addShield(amount: number, duration?: number): void {
    // Shield implementation would go here
  }

  addStatusEffect(effect: any): void {
    // Status effect implementation would go here
  }

  applyKnockback(force: THREE.Vector3): void {
    this.velocity.add(force);
    this.physicsEntity.isSleeping = false;
  }

  die(): void {
      this.isAlive = false;
      this.stopMovement();
      this.velocity.set(0, 0, 0);
      this.animationController.setState(AnimationState.DEATH, true);

      if (this.aiController) {
        this.aiController.forceState(AIState.DEAD);
      }

      gameEvents.emit('character-death', { characterId: this.id, killerId: this.aiController?.getContext().target?.id });
    }

    respawn(position: THREE.Vector3): void {
      this.position.copy(position);
      this.velocity.set(0, 0, 0);
      this.stats.health = this.stats.maxHealth;
      this.stats.stamina = this.stats.maxStamina;
      this.stats.mana = this.stats.maxMana;
      this.isAlive = true;
      this.invulnerabilityTime = 2;
      this.animationController.setState(AnimationState.RESPAWN, true);
    
    this.physicsWorld.setPosition(this.id, position);
    
    gameEvents.emit('character-respawn', { characterId: this.id, position });
  }

  getDistanceTo(entity: Entity): number {
    return this.position.distanceTo(entity.position);
  }

  getDistanceToPosition(pos: THREE.Vector3): number {
    return this.position.distanceTo(pos);
  }

  setState(state: string, value: boolean): void {
    this.stateFlags.set(state, value);
  }

  getState(state: string): boolean {
    return this.stateFlags.get(state) ?? false;
  }

  checkCondition(condition: string): boolean {
    switch (condition) {
      case 'low_health': return this.stats.health / this.stats.maxHealth < 0.3;
      case 'has_target': return !!this.aiController?.getContext().target;
      case 'on_ground': return this.physicsEntity.onGround;
      default: return false;
    }
  }

  hasItem(itemId: string): boolean {
    return this.inventory.some(item => item.templateId === itemId);
  }

  addExperience(amount: number): void {
    this.experience += amount;
    const nextLevelExp = this.level * 100;
    if (this.experience >= nextLevelExp) {
      this.levelUp();
    }
  }

  private levelUp(): void {
    this.level++;
    this.experience = 0;
    this.stats.maxHealth += 10;
    this.stats.health = this.stats.maxHealth;
    this.stats.maxStamina += 5;
    this.stats.stamina = this.stats.maxStamina;
    this.stats.damage += 2;
    this.stats.defense += 1;
    
    gameEvents.emit('character-levelup', { characterId: this.id, level: this.level });
  }

  getAnimationController(): AnimationController {
    return this.animationController;
  }

  getAbilitySystem(): AbilitySystem {
    return this.abilitySystem;
  }

  getAIController(): AIController | null {
    return this.aiController;
  }

  dispose(): void {
    this.physicsWorld.removeEntity(this.id);
    this.animationController.dispose();
    if (this.aiController) {
      this.aiController.dispose();
    }
    gameEvents.emit('character-disposed', { characterId: this.id });
  }
}

export class CharacterManager {
  private characters: Map<string, CharacterController> = new Map();
  private physicsWorld: PhysicsWorld;
  private aiManager: AIManager;
  private playerCharacter: CharacterController | null = null;

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld;
    this.aiManager = createAIManager();
  }

  createCharacter(config: CharacterControllerConfig): CharacterController {
    const character = new CharacterController(config);
    this.characters.set(character.id, character);

    if (character.isPlayer) {
      this.playerCharacter = character;
    } else if (character.aiController) {
      this.aiManager.register(character, {
        perceptionRange: character.definition.aiProfile.perceptionRange,
        attackRange: character.stats.attackRange,
        fleeThreshold: 0.3,
        wanderRadius: character.definition.aiProfile.patrolRadius,
      });
    }

    return character;
  }

  removeCharacter(id: string): boolean {
    const character = this.characters.get(id);
    if (!character) return false;

    if (character.aiController) {
      this.aiManager.unregister(id);
    }
    if (this.playerCharacter?.id === id) {
      this.playerCharacter = null;
    }

    character.dispose();
    this.characters.delete(id);
    return true;
  }

  getCharacter(id: string): CharacterController | undefined {
    return this.characters.get(id);
  }

  getPlayer(): CharacterController | null {
    return this.playerCharacter;
  }

  getAllCharacters(): CharacterController[] {
    return Array.from(this.characters.values());
  }

  getAliveCharacters(): CharacterController[] {
    return this.getAllCharacters().filter(c => c.isAlive);
  }

  getCharactersByFaction(faction: CharacterFaction): CharacterController[] {
    return this.getAllCharacters().filter(c => c.faction === faction && c.isAlive);
  }

  getCharactersInRadius(position: THREE.Vector3, radius: number): CharacterController[] {
    return this.getAliveCharacters().filter(c => c.position.distanceTo(position) <= radius);
  }

  update(deltaTime: number): void {
    for (const character of this.characters.values()) {
      character.update(deltaTime);
    }
    this.aiManager.update(deltaTime);
  }

  getPhysicsWorld(): PhysicsWorld {
    return this.physicsWorld;
  }

  getAIManager(): AIManager {
    return this.aiManager;
  }

  dispose(): void {
    for (const character of this.characters.values()) {
      character.dispose();
    }
    this.characters.clear();
    this.aiManager.dispose();
    this.playerCharacter = null;
  }
}

export function createCharacterManager(physicsWorld: PhysicsWorld): CharacterManager {
  return new CharacterManager(physicsWorld);
}

export function createCharacterController(config: CharacterControllerConfig): CharacterController {
  return new CharacterController(config);
}