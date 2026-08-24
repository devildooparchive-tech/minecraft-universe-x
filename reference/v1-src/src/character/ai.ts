import * as THREE from 'three';
import { gameEvents } from '../core/events';
import { Entity, CharacterStats } from './abilities';

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
}

export enum AIStatePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
  FORCED = 4,
}

export interface AIStateDefinition {
  state: AIState;
  priority: AIStatePriority;
  enter?: (context: AIContext) => void;
  update?: (context: AIContext, deltaTime: number) => AIState | null;
  exit?: (context: AIContext) => void;
  transitions: AITransition[];
}

export interface AITransition {
  to: AIState;
  condition: (context: AIContext) => boolean;
  priority: number;
}

export interface AIContext {
  entity: AIEntity;
  target: Entity | null;
  homePosition: THREE.Vector3;
  patrolPoints: THREE.Vector3[];
  currentPatrolIndex: number;
  lastKnownTargetPosition: THREE.Vector3 | null;
  timeInState: number;
  totalStateTime: number;
  perceptionRange: number;
  attackRange: number;
  fleeThreshold: number;
  wanderRadius: number;
  memory: Map<string, any>;
  blackboard: Map<string, any>;
}

export interface AIEntity extends Entity {
  velocity: THREE.Vector3;
  faction: string;
  isAlive: boolean;
  abilitySystem?: any;
  animationController?: any;
  world?: AIWorld;
  target?: Entity;
  moveTo(target: THREE.Vector3, speed?: number): void;
  stopMovement(): void;
  lookAt(target: THREE.Vector3): void;
}

interface AIWorld {
  getEntitiesInRadius(center: THREE.Vector3, radius: number, filter?: (e: Entity) => boolean): Entity[];
  getEntitiesInCone(origin: THREE.Vector3, direction: THREE.Vector3, range: number, angle: number, filter?: (e: Entity) => boolean): Entity[];
  getEntitiesInLine(origin: THREE.Vector3, direction: THREE.Vector3, range: number): Entity[];
  getAllEntities(): Entity[];
  findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] | null;
  isPositionWalkable(pos: THREE.Vector3): boolean;
  getRandomWalkablePositionNear(center: THREE.Vector3, radius: number): THREE.Vector3 | null;
  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDist: number): { hit: boolean; position: THREE.Vector3; entity?: Entity };
}

export class AIController {
  private currentState: AIState = AIState.IDLE;
  private previousState: AIState = AIState.IDLE;
  private stateDefinitions: Map<AIState, AIStateDefinition> = new Map();
  private context: AIContext;
  private entity: AIEntity;
  private updateBudget = 0;
  private updateInterval = 0.1;
  private lastDecisionTime = 0;
  private decisionInterval = 0.5;

  constructor(entity: AIEntity, config: Partial<AIContext> = {}) {
    this.entity = entity;
    this.context = this.createDefaultContext(config);
    this.setupDefaultStates();
  }

  private createDefaultContext(config: Partial<AIContext>): AIContext {
    return {
      entity: this.entity,
      target: null,
      homePosition: this.entity.position.clone(),
      patrolPoints: [],
      currentPatrolIndex: 0,
      lastKnownTargetPosition: null,
      timeInState: 0,
      totalStateTime: 0,
      perceptionRange: config.perceptionRange ?? 20,
      attackRange: config.attackRange ?? this.entity.stats.attackRange,
      fleeThreshold: config.fleeThreshold ?? 0.3,
      wanderRadius: config.wanderRadius ?? 10,
      memory: new Map(),
      blackboard: new Map(),
    };
  }

  private setupDefaultStates(): void {
    this.registerState(this.createIdleState());
    this.registerState(this.createWanderState());
    this.registerState(this.createPatrolState());
    this.registerState(this.createPerceiveState());
    this.registerState(this.createInvestigateState());
    this.registerState(this.createChaseState());
    this.registerState(this.createAttackState());
    this.registerState(this.createDefendState());
    this.registerState(this.createFleeState());
    this.registerState(this.createSearchState());
    this.registerState(this.createReturnState());
    this.registerState(this.createAssistState());
    this.registerState(this.createDeadState());
  }

  private createIdleState(): AIStateDefinition {
    return {
      state: AIState.IDLE,
      priority: AIStatePriority.LOW,
      enter: (ctx) => {
        ctx.entity.stopMovement();
        ctx.entity.setState('idle', true);
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        const target = this.acquireTarget(ctx);
        if (target) {
          ctx.target = target;
          ctx.lastKnownTargetPosition = target.position.clone();
          return AIState.PERCEIVE;
        }

        if (ctx.patrolPoints.length > 0) {
          return AIState.PATROL;
        }

        if (ctx.timeInState > 3 + Math.random() * 5) {
          return AIState.WANDER;
        }

        return null;
      },
      exit: (ctx) => {
        ctx.entity.setState('idle', false);
      },
      transitions: [
        { to: AIState.PERCEIVE, condition: (ctx) => !!this.acquireTarget(ctx), priority: 10 },
        { to: AIState.PATROL, condition: (ctx) => ctx.patrolPoints.length > 0, priority: 5 },
        { to: AIState.WANDER, condition: (ctx) => ctx.timeInState > 3, priority: 3 },
      ],
    };
  }

  private createWanderState(): AIStateDefinition {
    return {
      state: AIState.WANDER,
      priority: AIStatePriority.LOW,
      enter: (ctx) => {
        const targetPos = ctx.entity.world?.getRandomWalkablePositionNear(ctx.homePosition, ctx.wanderRadius);
        if (targetPos) {
          ctx.entity.moveTo(targetPos, ctx.entity.stats.movementSpeed * 0.5);
        }
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        const target = this.acquireTarget(ctx);
        if (target) {
          ctx.target = target;
          ctx.lastKnownTargetPosition = target.position.clone();
          return AIState.PERCEIVE;
        }

        const distToTarget = ctx.entity.getDistanceToPosition(
          ctx.entity.world?.getRandomWalkablePositionNear(ctx.homePosition, ctx.wanderRadius) || ctx.homePosition
        );

        if (distToTarget < 1 || ctx.timeInState > 10) {
          return AIState.IDLE;
        }

        return null;
      },
      exit: (ctx) => {
        ctx.entity.stopMovement();
      },
      transitions: [
        { to: AIState.PERCEIVE, condition: (ctx) => !!this.acquireTarget(ctx), priority: 10 },
        { to: AIState.IDLE, condition: (ctx) => ctx.timeInState > 10, priority: 3 },
      ],
    };
  }

  private createPatrolState(): AIStateDefinition {
    return {
      state: AIState.PATROL,
      priority: AIStatePriority.NORMAL,
      enter: (ctx) => {
        if (ctx.patrolPoints.length > 0) {
          ctx.currentPatrolIndex = 0;
          ctx.entity.moveTo(ctx.patrolPoints[0], ctx.entity.stats.movementSpeed * 0.7);
        }
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        const target = this.acquireTarget(ctx);
        if (target) {
          ctx.target = target;
          ctx.lastKnownTargetPosition = target.position.clone();
          return AIState.PERCEIVE;
        }

        if (ctx.patrolPoints.length === 0) return AIState.IDLE;

        const currentPoint = ctx.patrolPoints[ctx.currentPatrolIndex];
        const dist = ctx.entity.getDistanceToPosition(currentPoint);

        if (dist < 1.5) {
          ctx.currentPatrolIndex = (ctx.currentPatrolIndex + 1) % ctx.patrolPoints.length;
          const nextPoint = ctx.patrolPoints[ctx.currentPatrolIndex];
          ctx.entity.moveTo(nextPoint, ctx.entity.stats.movementSpeed * 0.7);
        }

        return null;
      },
      exit: (ctx) => {
        ctx.entity.stopMovement();
      },
      transitions: [
        { to: AIState.PERCEIVE, condition: (ctx) => !!this.acquireTarget(ctx), priority: 10 },
        { to: AIState.IDLE, condition: (ctx) => ctx.patrolPoints.length === 0, priority: 3 },
      ],
    };
  }

  private createPerceiveState(): AIStateDefinition {
    return {
      state: AIState.PERCEIVE,
      priority: AIStatePriority.HIGH,
      enter: (ctx) => {
        ctx.timeInState = 0;
        if (ctx.target) {
          ctx.entity.lookAt(ctx.target!.position);
        }
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        if (!ctx.target || !ctx.target.isAlive) {
          ctx.target = null;
          return AIState.SEARCH;
        }

        const dist = ctx.entity.getDistanceTo(ctx.target);

        if (dist <= ctx.attackRange) {
          return AIState.ATTACK;
        }

        if (dist > ctx.perceptionRange * 1.5) {
          ctx.target = null;
          return AIState.SEARCH;
        }

        if (ctx.entity.stats.health / ctx.entity.stats.maxHealth < ctx.fleeThreshold) {
          return AIState.FLEE;
        }

        return AIState.CHASE;
      },
      transitions: [
        { to: AIState.ATTACK, condition: (ctx) => ctx.target !== null && ctx.entity.getDistanceTo(ctx.target) <= ctx.attackRange, priority: 10 },
        { to: AIState.CHASE, condition: (ctx) => ctx.target !== null && ctx.entity.getDistanceTo(ctx.target) > ctx.attackRange, priority: 8 },
        { to: AIState.FLEE, condition: (ctx) => ctx.entity.stats.health / ctx.entity.stats.maxHealth < ctx.fleeThreshold, priority: 9 },
        { to: AIState.SEARCH, condition: (ctx) => ctx.target === null || !ctx.target.isAlive, priority: 7 },
      ],
    };
  }

  private createInvestigateState(): AIStateDefinition {
    return {
      state: AIState.INVESTIGATE,
      priority: AIStatePriority.NORMAL,
      enter: (ctx) => {
        if (ctx.lastKnownTargetPosition) {
          ctx.entity.moveTo(ctx.lastKnownTargetPosition, ctx.entity.stats.movementSpeed * 0.8);
        }
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        const target = this.acquireTarget(ctx);
        if (target) {
          ctx.target = target;
          ctx.lastKnownTargetPosition = target.position.clone();
          return AIState.PERCEIVE;
        }

        const dist = ctx.entity.getDistanceToPosition(ctx.lastKnownTargetPosition || ctx.entity.position);
        if (dist < 2 || ctx.timeInState > 5) {
          ctx.lastKnownTargetPosition = null;
          return AIState.IDLE;
        }

        return null;
      },
      exit: (ctx) => {
        ctx.entity.stopMovement();
      },
      transitions: [
        { to: AIState.PERCEIVE, condition: (ctx) => !!this.acquireTarget(ctx), priority: 10 },
        { to: AIState.IDLE, condition: (ctx) => ctx.timeInState > 5, priority: 3 },
      ],
    };
  }

  private createChaseState(): AIStateDefinition {
    return {
      state: AIState.CHASE,
      priority: AIStatePriority.HIGH,
      enter: (ctx) => {
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        if (!ctx.target || !ctx.target.isAlive) {
          ctx.target = null;
          return AIState.SEARCH;
        }

        const dist = ctx.entity.getDistanceTo(ctx.target);

        if (dist <= ctx.attackRange) {
          return AIState.ATTACK;
        }

        if (dist > ctx.perceptionRange * 2) {
          ctx.lastKnownTargetPosition = ctx.target.position.clone();
          ctx.target = null;
          return AIState.INVESTIGATE;
        }

        if (ctx.entity.stats.health / ctx.entity.stats.maxHealth < ctx.fleeThreshold) {
          return AIState.FLEE;
        }

        ctx.entity.moveTo(ctx.target.position, ctx.entity.stats.movementSpeed);
        ctx.entity.lookAt(ctx.target!.position);

        return null;
      },
      exit: (ctx) => {
        ctx.entity.stopMovement();
      },
      transitions: [
        { to: AIState.ATTACK, condition: (ctx) => ctx.target !== null && ctx.entity.getDistanceTo(ctx.target) <= ctx.attackRange, priority: 10 },
        { to: AIState.INVESTIGATE, condition: (ctx) => ctx.target !== null && ctx.entity.getDistanceTo(ctx.target) > ctx.perceptionRange * 2, priority: 6 },
        { to: AIState.FLEE, condition: (ctx) => ctx.entity.stats.health / ctx.entity.stats.maxHealth < ctx.fleeThreshold, priority: 9 },
        { to: AIState.SEARCH, condition: (ctx) => ctx.target === null || !ctx.target.isAlive, priority: 7 },
      ],
    };
  }

  private createAttackState(): AIStateDefinition {
    return {
      state: AIState.ATTACK,
      priority: AIStatePriority.CRITICAL,
      enter: (ctx) => {
        ctx.entity.setState('attacking', true);
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        if (!ctx.target || !ctx.target.isAlive) {
          ctx.target = null;
          return AIState.SEARCH;
        }

        const dist = ctx.entity.getDistanceTo(ctx.target);

        if (dist > ctx.attackRange * 1.2) {
          return AIState.CHASE;
        }

        if (ctx.entity.stats.health / ctx.entity.stats.maxHealth < ctx.fleeThreshold) {
          return AIState.FLEE;
        }

        ctx.entity.lookAt(ctx.target!.position);

        const attackCooldown = 1 / ctx.entity.stats.attackSpeed;
        if (ctx.timeInState >= attackCooldown) {
          ctx.entity.attack(ctx.target);
          ctx.timeInState = 0;

          if (ctx.entity.abilitySystem) {
            const abilities = ctx.entity.abilitySystem.getAvailableAbilities();
            const offensiveAbilities = abilities.filter((a: any) => a.definition.type === 'active' || a.definition.type === 'ultimate');
            if (offensiveAbilities.length > 0 && Math.random() < 0.3 && ctx.target) {
              const ability = offensiveAbilities[Math.floor(Math.random() * offensiveAbilities.length)];
              ctx.entity.useAbility(ability.definition.id, ctx.target);
            }
          }
        }

        return null;
      },
      exit: (ctx) => {
        ctx.entity.setState('attacking', false);
        ctx.entity.stopMovement();
      },
      transitions: [
        { to: AIState.CHASE, condition: (ctx) => ctx.target !== null && ctx.entity.getDistanceTo(ctx.target) > ctx.attackRange * 1.2, priority: 8 },
        { to: AIState.FLEE, condition: (ctx) => ctx.entity.stats.health / ctx.entity.stats.maxHealth < ctx.fleeThreshold, priority: 9 },
        { to: AIState.SEARCH, condition: (ctx) => ctx.target === null || !ctx.target.isAlive, priority: 7 },
        { to: AIState.DEFEND, condition: (ctx) => ctx.entity.getState('blocking'), priority: 6 },
      ],
    };
  }

  private createDefendState(): AIStateDefinition {
    return {
      state: AIState.DEFEND,
      priority: AIStatePriority.HIGH,
      enter: (ctx) => {
        ctx.entity.setState('blocking', true);
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        if (!ctx.target || !ctx.target.isAlive) {
          return AIState.IDLE;
        }

        if (!ctx.entity.getState('blocking') || ctx.timeInState > 3) {
          return AIState.ATTACK;
        }

        return null;
      },
      exit: (ctx) => {
        ctx.entity.setState('blocking', false);
      },
      transitions: [
        { to: AIState.ATTACK, condition: (ctx) => !ctx.entity.getState('blocking') || ctx.timeInState > 3, priority: 8 },
        { to: AIState.FLEE, condition: (ctx) => ctx.entity.stats.health / ctx.entity.stats.maxHealth < ctx.fleeThreshold, priority: 9 },
        { to: AIState.IDLE, condition: (ctx) => !ctx.target || !ctx.target.isAlive, priority: 5 },
      ],
    };
  }

  private createFleeState(): AIStateDefinition {
    return {
      state: AIState.FLEE,
      priority: AIStatePriority.CRITICAL,
      enter: (ctx) => {
        const fleeDirection = new THREE.Vector3()
          .subVectors(ctx.entity.position, ctx.target?.position || ctx.entity.position)
          .normalize();
        const fleeTarget = ctx.entity.position.clone().add(fleeDirection.multiplyScalar(20));
        ctx.entity.moveTo(fleeTarget, ctx.entity.stats.movementSpeed * 1.5);
        ctx.entity.setState('fleeing', true);
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        const healthPercent = ctx.entity.stats.health / ctx.entity.stats.maxHealth;
        if (healthPercent > ctx.fleeThreshold + 0.2 && ctx.timeInState > 5) {
          return AIState.RETURN;
        }

        if (ctx.timeInState > 15) {
          return AIState.RETURN;
        }

        return null;
      },
      exit: (ctx) => {
        ctx.entity.setState('fleeing', false);
        ctx.entity.stopMovement();
      },
      transitions: [
        { to: AIState.RETURN, condition: (ctx) => ctx.timeInState > 5 && ctx.entity.stats.health / ctx.entity.stats.maxHealth > ctx.fleeThreshold + 0.2, priority: 7 },
        { to: AIState.RETURN, condition: (ctx) => ctx.timeInState > 15, priority: 5 },
      ],
    };
  }

  private createSearchState(): AIStateDefinition {
    return {
      state: AIState.SEARCH,
      priority: AIStatePriority.NORMAL,
      enter: (ctx) => {
        ctx.timeInState = 0;
        if (ctx.lastKnownTargetPosition) {
          ctx.entity.moveTo(ctx.lastKnownTargetPosition, ctx.entity.stats.movementSpeed * 0.6);
        }
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        const target = this.acquireTarget(ctx);
        if (target) {
          ctx.target = target;
          ctx.lastKnownTargetPosition = target.position.clone();
          return AIState.PERCEIVE;
        }

        if (ctx.lastKnownTargetPosition) {
          const dist = ctx.entity.getDistanceToPosition(ctx.lastKnownTargetPosition);
          if (dist < 2) {
            ctx.lastKnownTargetPosition = null;
          }
        }

        if (ctx.timeInState > 8) {
          ctx.lastKnownTargetPosition = null;
          return AIState.IDLE;
        }

        return null;
      },
      exit: (ctx) => {
        ctx.entity.stopMovement();
      },
      transitions: [
        { to: AIState.PERCEIVE, condition: (ctx) => !!this.acquireTarget(ctx), priority: 10 },
        { to: AIState.IDLE, condition: (ctx) => ctx.timeInState > 8, priority: 3 },
      ],
    };
  }

  private createReturnState(): AIStateDefinition {
    return {
      state: AIState.RETURN,
      priority: AIStatePriority.NORMAL,
      enter: (ctx) => {
        ctx.entity.moveTo(ctx.homePosition, ctx.entity.stats.movementSpeed);
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        const target = this.acquireTarget(ctx);
        if (target) {
          ctx.target = target;
          ctx.lastKnownTargetPosition = target.position.clone();
          return AIState.PERCEIVE;
        }

        const dist = ctx.entity.getDistanceToPosition(ctx.homePosition);
        if (dist < 2) {
          return AIState.IDLE;
        }

        return null;
      },
      exit: (ctx) => {
        ctx.entity.stopMovement();
      },
      transitions: [
        { to: AIState.PERCEIVE, condition: (ctx) => !!this.acquireTarget(ctx), priority: 10 },
        { to: AIState.IDLE, condition: (ctx) => ctx.entity.getDistanceToPosition(ctx.homePosition) < 2, priority: 5 },
      ],
    };
  }

  private createAssistState(): AIStateDefinition {
    return {
      state: AIState.ASSIST,
      priority: AIStatePriority.HIGH,
      enter: (ctx) => {
        ctx.timeInState = 0;
      },
      update: (ctx, dt) => {
        ctx.timeInState += dt;

        const ally = ctx.blackboard.get('assistTarget') as AIEntity | null;
        if (!ally || !ally.isAlive) {
          return AIState.RETURN;
        }

        const target = ally.getState('attacking') ? ally.target : null;
        if (target && target.isAlive) {
          ctx.target = target;
          return AIState.PERCEIVE;
        }

        const dist = ctx.entity.getDistanceTo(ally);
        if (dist > 10) {
          ctx.entity.moveTo(ally.position, ctx.entity.stats.movementSpeed);
        }

        return null;
      },
      transitions: [
        { to: AIState.PERCEIVE, condition: (ctx) => !!ctx.target, priority: 10 },
        { to: AIState.RETURN, condition: (ctx) => !ctx.blackboard.get('assistTarget'), priority: 5 },
      ],
    };
  }

  private createDeadState(): AIStateDefinition {
    return {
      state: AIState.DEAD,
      priority: AIStatePriority.FORCED,
      enter: (ctx) => {
        ctx.entity.stopMovement();
        ctx.entity.setState('dead', true);
        gameEvents.emit('entity-death', { entityId: ctx.entity.id });
      },
      update: () => null,
      transitions: [],
    };
  }

  private acquireTarget(ctx: AIContext): Entity | null {
    if (!ctx.entity.world) return null;

    const entities = ctx.entity.world.getEntitiesInRadius(
      ctx.entity.position,
      ctx.perceptionRange,
      (e) => e.isAlive && (e as AIEntity).faction !== ctx.entity.faction && e.id !== ctx.entity.id
    );

    if (entities.length === 0) return null;

    entities.sort((a, b) => ctx.entity.getDistanceTo(a) - ctx.entity.getDistanceTo(b));
    return entities[0];
  }

  registerState(definition: AIStateDefinition): void {
    this.stateDefinitions.set(definition.state, definition);
  }

  getStateDefinition(state: AIState): AIStateDefinition | undefined {
    return this.stateDefinitions.get(state);
  }

  forceState(state: AIState): void {
    const currentDef = this.stateDefinitions.get(this.currentState);
    if (currentDef?.exit) {
      currentDef.exit(this.context);
    }

    this.previousState = this.currentState;
    this.currentState = state;

    const newDef = this.stateDefinitions.get(state);
    if (newDef?.enter) {
      newDef.enter(this.context);
    }
  }

  update(deltaTime: number): void {
    if (!this.entity.isAlive) {
      if (this.currentState !== AIState.DEAD) {
        this.forceState(AIState.DEAD);
      }
      return;
    }

    this.updateBudget += deltaTime;
    if (this.updateBudget < this.updateInterval) return;
    this.updateBudget = 0;

    const currentDef = this.stateDefinitions.get(this.currentState);
    if (!currentDef) return;

    this.context.timeInState += deltaTime;
    this.context.totalStateTime += deltaTime;

    if (currentDef.update) {
      const nextState = currentDef.update(this.context, deltaTime);
      if (nextState && nextState !== this.currentState) {
        this.transitionTo(nextState);
      }
    }

    this.checkTransitions();
  }

  private checkTransitions(): void {
    const currentDef = this.stateDefinitions.get(this.currentState);
    if (!currentDef) return;

    let bestTransition: AITransition | null = null;
    let bestPriority = -1;

    for (const transition of currentDef.transitions) {
      if (transition.condition(this.context) && transition.priority > bestPriority) {
        bestTransition = transition;
        bestPriority = transition.priority;
      }
    }

    if (bestTransition) {
      this.transitionTo(bestTransition.to);
    }
  }

  private transitionTo(newState: AIState): void {
    const currentDef = this.stateDefinitions.get(this.currentState);
    if (currentDef?.exit) {
      currentDef.exit(this.context);
    }

    this.previousState = this.currentState;
    this.currentState = newState;
    this.context.timeInState = 0;

    const newDef = this.stateDefinitions.get(newState);
    if (newDef?.enter) {
      newDef.enter(this.context);
    }
  }

  getCurrentState(): AIState {
    return this.currentState;
  }

  getPreviousState(): AIState {
    return this.previousState;
  }

  getContext(): AIContext {
    return { ...this.context };
  }

  setTarget(target: AIEntity | null): void {
    this.context.target = target;
    if (target) {
      this.context.lastKnownTargetPosition = target.position.clone();
    }
  }

  setHomePosition(pos: THREE.Vector3): void {
    this.context.homePosition = pos.clone();
  }

  setPatrolPoints(points: THREE.Vector3[]): void {
    this.context.patrolPoints = points.map(p => p.clone());
    this.context.currentPatrolIndex = 0;
  }

  setPerceptionRange(range: number): void {
    this.context.perceptionRange = range;
  }

  setAttackRange(range: number): void {
    this.context.attackRange = range;
  }

  setFleeThreshold(threshold: number): void {
    this.context.fleeThreshold = threshold;
  }

  setWanderRadius(radius: number): void {
    this.context.wanderRadius = radius;
  }

  setMemory(key: string, value: any): void {
    this.context.memory.set(key, value);
  }

  getMemory(key: string): any {
    return this.context.memory.get(key);
  }

  setBlackboard(key: string, value: any): void {
    this.context.blackboard.set(key, value);
  }

  getBlackboard(key: string): any {
    return this.context.blackboard.get(key);
  }

  setUpdateInterval(interval: number): void {
    this.updateInterval = interval;
  }

  dispose(): void {
    this.stateDefinitions.clear();
    this.context.memory.clear();
    this.context.blackboard.clear();
  }
}

export class AIManager {
  private controllers: Map<string, AIController> = new Map();
  private updateBudget = 0;
  private maxUpdatesPerFrame = 50;
  private updateCount = 0;

  register(entity: AIEntity, config?: Partial<AIContext>): AIController {
    const controller = new AIController(entity, config);
    this.controllers.set(entity.id, controller);
    return controller;
  }

  unregister(entityId: string): boolean {
    const controller = this.controllers.get(entityId);
    if (controller) {
      controller.dispose();
      this.controllers.delete(entityId);
      return true;
    }
    return false;
  }

  getController(entityId: string): AIController | undefined {
    return this.controllers.get(entityId);
  }

  update(deltaTime: number): void {
    this.updateCount = 0;
    for (const controller of this.controllers.values()) {
      if (this.updateCount >= this.maxUpdatesPerFrame) break;
      controller.update(deltaTime);
      this.updateCount++;
    }
  }

  getAllControllers(): AIController[] {
    return Array.from(this.controllers.values());
  }

  getActiveCount(): number {
    return this.controllers.size;
  }

  dispose(): void {
    for (const controller of this.controllers.values()) {
      controller.dispose();
    }
    this.controllers.clear();
  }
}

export const createAIController = (entity: AIEntity, config?: Partial<AIContext>): AIController => {
  return new AIController(entity, config);
};

export const createAIManager = (): AIManager => {
  return new AIManager();
};

export const createDefaultAIConfig = (): Partial<AIContext> => ({
  perceptionRange: 20,
  attackRange: 3,
  fleeThreshold: 0.3,
  wanderRadius: 10,
});