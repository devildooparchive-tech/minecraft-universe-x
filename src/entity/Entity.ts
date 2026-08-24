/**
 * Entity — core entity model with persistent memory.
 *
 * Superiority over Minecraft: entities REMEMBER. Vanilla mobs forget the
 * instant their target leaves range; our entities keep lastAttacker, ally
 * sets, threat levels, last-seen-player positions, and an interaction
 * history that survives save/load cycles.
 */

import type { Vec3 } from '../physics/physics';

export type EntityType = 'player' | 'hostile' | 'passive' | 'npc' | 'boss';
export type EntityRole = 'warrior' | 'support' | 'ranged' | 'tank' | 'assassin';
export type GoalState =
  | 'idle'
  | 'patrol'
  | 'chase'
  | 'attack'
  | 'flee'
  | 'help'
  | 'trade'
  | 'follow';

export interface EntityMemory {
  /** id of whoever hit us last (retaliation source) */
  lastAttacker?: string;
  /** ids we trust */
  allies: Set<string>;
  /** id → threat score 0..100 (decays over time) */
  threats: Map<string, number>;
  /** where we last saw the player, even after they vanish */
  lastSeenPlayer?: { x: number; y: number; z: number; time: number };
  /** rolling log of notable interactions (capped) */
  interactionHistory: Array<{
    type: 'attack' | 'help' | 'flee';
    target: string;
    time: number;
  }>;
}

export interface EntityStats {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  speed: number;
  attackDamage: number;
  defense: number;
}

export const INTERACTION_HISTORY_CAP = 20;

export class EntityMemoryStore implements EntityMemory {
  lastAttacker?: string;
  allies = new Set<string>();
  threats = new Map<string, number>();
  lastSeenPlayer?: { x: number; y: number; z: number; time: number };
  interactionHistory: EntityMemory['interactionHistory'] = [];

  recordInteraction(
    type: EntityMemory['interactionHistory'][number]['type'],
    target: string,
    time: number,
  ): void {
    this.interactionHistory.unshift({ type, target, time });
    if (this.interactionHistory.length > INTERACTION_HISTORY_CAP) {
      this.interactionHistory.length = INTERACTION_HISTORY_CAP;
    }
    if (type === 'attack') this.lastAttacker = target;
  }

  addThreat(id: string, amount: number): void {
    const cur = this.threats.get(id) ?? 0;
    this.threats.set(id, Math.max(0, Math.min(100, cur + amount)));
  }

  decayThreats(amountPerTick = 0.5): void {
    for (const [id, v] of this.threats) {
      const next = v - amountPerTick;
      if (next <= 0) this.threats.delete(id);
      else this.threats.set(id, next);
    }
  }

  topThreat(): { id: string; level: number } | null {
    let best: { id: string; level: number } | null = null;
    for (const [id, level] of this.threats) {
      if (!best || level > best.level) best = { id, level };
    }
    return best;
  }

  isAlly(id: string): boolean {
    return this.allies.has(id);
  }

  // --- serialization (Sets/Maps are not JSON-native) ---
  export(): SerializedMemory {
    return {
      lastAttacker: this.lastAttacker,
      allies: [...this.allies],
      threats: [...this.threats.entries()],
      lastSeenPlayer: this.lastSeenPlayer ? { ...this.lastSeenPlayer } : undefined,
      interactionHistory: this.interactionHistory.map((h) => ({ ...h })),
    };
  }

  static from(data: SerializedMemory | undefined): EntityMemoryStore {
    const m = new EntityMemoryStore();
    if (!data) return m;
    m.lastAttacker = data.lastAttacker;
    m.allies = new Set(data.allies ?? []);
    m.threats = new Map(data.threats ?? []);
    m.lastSeenPlayer = data.lastSeenPlayer ? { ...data.lastSeenPlayer } : undefined;
    m.interactionHistory = (data.interactionHistory ?? []).map((h) => ({ ...h }));
    return m;
  }
}

export interface SerializedMemory {
  lastAttacker?: string;
  allies: string[];
  threats: Array<[string, number]>;
  lastSeenPlayer?: { x: number; y: number; z: number; time: number };
  interactionHistory: EntityMemory['interactionHistory'];
}

export interface EntityInit {
  id: string;
  type: EntityType;
  faction: string;
  role: EntityRole;
  position: Vec3;
  nameAr?: string;
  stats?: Partial<EntityStats>;
}

const DEFAULT_STATS: EntityStats = {
  health: 20,
  maxHealth: 20,
  energy: 100,
  maxEnergy: 100,
  speed: 3.5,
  attackDamage: 3,
  defense: 0,
};

export class Entity {
  readonly id: string;
  readonly type: EntityType;
  readonly faction: string;
  readonly role: EntityRole;
  readonly nameAr: string;

  position: Vec3;
  prevPosition: Vec3; // for render interpolation
  velocity: Vec3;
  yaw = 0;

  stats: EntityStats;
  memory: EntityMemoryStore;
  currentGoal: GoalState = 'idle';
  targetId?: string;
  /** extensible component bag (shields, buffs, mounts...) */
  readonly components = new Map<string, unknown>();

  /** render interpolation helper — call before physics step */
  snapshotPrev(): void {
    this.prevPosition = { ...this.position };
  }

  /** interpolated position for rendering */
  renderPos(alpha: number): Vec3 {
    return {
      x: this.prevPosition.x + (this.position.x - this.prevPosition.x) * alpha,
      y: this.prevPosition.y + (this.position.y - this.prevPosition.y) * alpha,
      z: this.prevPosition.z + (this.position.z - this.prevPosition.z) * alpha,
    };
  }

  get dead(): boolean {
    return this.stats.health <= 0;
  }

  constructor(init: EntityInit, memoryData?: SerializedMemory) {
    this.id = init.id;
    this.type = init.type;
    this.faction = init.faction;
    this.role = init.role;
    this.nameAr = init.nameAr ?? init.id;
    this.position = { ...init.position };
    this.prevPosition = { ...init.position };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.stats = {
      ...DEFAULT_STATS,
      maxHealth: init.stats?.maxHealth ?? DEFAULT_STATS.maxHealth,
      health: init.stats?.health ?? init.stats?.maxHealth ?? DEFAULT_STATS.health,
      maxEnergy: init.stats?.maxEnergy ?? DEFAULT_STATS.maxEnergy,
      energy: init.stats?.energy ?? DEFAULT_STATS.energy,
      speed: init.stats?.speed ?? DEFAULT_STATS.speed,
      attackDamage: init.stats?.attackDamage ?? DEFAULT_STATS.attackDamage,
      defense: init.stats?.defense ?? DEFAULT_STATS.defense,
    };
    this.memory = EntityMemoryStore.from(memoryData);
  }

  export(): SerializedEntity {
    return {
      id: this.id,
      type: this.type,
      faction: this.faction,
      role: this.role,
      nameAr: this.nameAr,
      position: { ...this.position },
      velocity: { ...this.velocity },
      yaw: this.yaw,
      stats: { ...this.stats },
      currentGoal: this.currentGoal,
      memory: this.memory.export(),
    };
  }

  static from(data: SerializedEntity): Entity {
    const e = new Entity(
      {
        id: data.id,
        type: data.type,
        faction: data.faction,
        role: data.role,
        nameAr: data.nameAr,
        position: data.position,
        stats: data.stats,
      },
      data.memory,
    );
    e.velocity = { ...data.velocity };
    e.yaw = data.yaw;
    e.currentGoal = data.currentGoal;
    return e;
  }
}

export interface SerializedEntity {
  id: string;
  type: EntityType;
  faction: string;
  role: EntityRole;
  nameAr: string;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  stats: EntityStats;
  currentGoal: GoalState;
  memory: SerializedMemory;
}
