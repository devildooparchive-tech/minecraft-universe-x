import * as THREE from 'three';
import { gameEvents } from '../core/events';

export enum CollisionLayer {
  DEFAULT = 1 << 0,
  PLAYER = 1 << 1,
  NPC = 1 << 2,
  CREATURE = 1 << 3,
  PROJECTILE = 1 << 4,
  ENVIRONMENT = 1 << 5,
  TRIGGER = 1 << 6,
  WATER = 1 << 7,
  CLIMBABLE = 1 << 8,
}

export enum CollisionFlags {
  NONE = 0,
  COLLIDES_WITH_PLAYER = CollisionLayer.PLAYER,
  COLLIDES_WITH_NPC = CollisionLayer.NPC,
  COLLIDES_WITH_CREATURE = CollisionLayer.CREATURE,
  COLLIDES_WITH_PROJECTILE = CollisionLayer.PROJECTILE,
  COLLIDES_WITH_ENVIRONMENT = CollisionLayer.ENVIRONMENT,
  COLLIDES_WITH_WATER = CollisionLayer.WATER,
  COLLIDES_WITH_CLIMBABLE = CollisionLayer.CLIMBABLE,
  ALL = ~0,
}

export interface CollisionFilter {
  layer: CollisionLayer;
  mask: CollisionFlags;
}

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface RaycastHit {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  entity?: PhysicsEntity;
  block?: { x: number; y: number; z: number; type: number };
  face: THREE.Vector3;
}

export interface ContactPoint {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  penetration: number;
  entityA: PhysicsEntity;
  entityB: PhysicsEntity;
}

export interface PhysicsMaterial {
  friction: number;
  restitution: number;
  density: number;
}

export const DEFAULT_MATERIAL: PhysicsMaterial = {
  friction: 0.6,
  restitution: 0.1,
  density: 1.0,
};

export const ICE_MATERIAL: PhysicsMaterial = {
  friction: 0.05,
  restitution: 0.1,
  density: 0.9,
};

export const BOUNCY_MATERIAL: PhysicsMaterial = {
  friction: 0.3,
  restitution: 0.8,
  density: 0.5,
};

export const HEAVY_MATERIAL: PhysicsMaterial = {
  friction: 0.8,
  restitution: 0.0,
  density: 5.0,
};

export interface PhysicsEntity {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  aabb: AABB;
  mass: number;
  invMass: number;
  material: PhysicsMaterial;
  layer: CollisionLayer;
  mask: CollisionFlags;
  isStatic: boolean;
  isKinematic: boolean;
  isSleeping: boolean;
  sleepTimer: number;
  linearDamping: number;
  angularDamping: number;
  useGravity: boolean;
  gravityScale: number;
  maxSpeed: number;
  onGround: boolean;
  onWall: boolean;
  wallNormal: THREE.Vector3;
  groundNormal: THREE.Vector3;
  contacts: ContactPoint[];
  userData: any;
}

export interface PhysicsWorldConfig {
  gravity: THREE.Vector3;
  subSteps: number;
  fixedTimeStep: number;
  maxSubSteps: number;
  broadphaseType: 'grid' | 'sweep_prune' | 'dynamic_aabb_tree';
  gridCellSize: number;
  enableSleep: boolean;
  sleepThreshold: number;
  sleepTimeThreshold: number;
  solverIterations: number;
  positionIterations: number;
  velocityIterations: number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsWorldConfig = {
  gravity: new THREE.Vector3(0, -30, 0),
  subSteps: 1,
  fixedTimeStep: 1 / 60,
  maxSubSteps: 3,
  broadphaseType: 'grid',
  gridCellSize: 8,
  enableSleep: true,
  sleepThreshold: 0.1,
  sleepTimeThreshold: 0.5,
  solverIterations: 10,
  positionIterations: 8,
  velocityIterations: 6,
};

export class Broadphase {
  private grid: Map<string, Set<PhysicsEntity>> = new Map();
  private cellSize: number;
  private entities: Set<PhysicsEntity> = new Set();

  constructor(cellSize: number = 8) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cz}`;
  }

  private getCellKeys(aabb: AABB): string[] {
    const minX = Math.floor(aabb.min.x / this.cellSize);
    const maxX = Math.floor(aabb.max.x / this.cellSize);
    const minZ = Math.floor(aabb.min.z / this.cellSize);
    const maxZ = Math.floor(aabb.max.z / this.cellSize);

    const keys: string[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        keys.push(`${x},${z}`);
      }
    }
    return keys;
  }

  insert(entity: PhysicsEntity): void {
    this.entities.add(entity);
    const keys = this.getCellKeys(entity.aabb);
    for (const key of keys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      this.grid.get(key)!.add(entity);
    }
  }

  remove(entity: PhysicsEntity): void {
    this.entities.delete(entity);
    const keys = this.getCellKeys(entity.aabb);
    for (const key of keys) {
      const cell = this.grid.get(key);
      if (cell) {
        cell.delete(entity);
        if (cell.size === 0) {
          this.grid.delete(key);
        }
      }
    }
  }

  update(entity: PhysicsEntity): void {
    this.remove(entity);
    this.insert(entity);
  }

  getPotentialPairs(): [PhysicsEntity, PhysicsEntity][] {
    const pairs: [PhysicsEntity, PhysicsEntity][] = [];
    const checked = new Set<string>();

    for (const cell of this.grid.values()) {
      const cellEntities = Array.from(cell);
      for (let i = 0; i < cellEntities.length; i++) {
        for (let j = i + 1; j < cellEntities.length; j++) {
          const a = cellEntities[i];
          const b = cellEntities[j];

          const idA = a.id;
          const idB = b.id;
          const key = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;

          if (!checked.has(key)) {
            checked.add(key);
            if (this.shouldCollide(a, b)) {
              pairs.push([a, b]);
            }
          }
        }
      }
    }

    return pairs;
  }

  queryAABB(aabb: AABB, filter?: (e: PhysicsEntity) => boolean): PhysicsEntity[] {
    const results: PhysicsEntity[] = [];
    const keys = this.getCellKeys(aabb);

    for (const key of keys) {
      const cell = this.grid.get(key);
      if (cell) {
        for (const entity of cell) {
          if (!filter || filter(entity)) {
            if (this.aabbOverlap(aabb, entity.aabb)) {
              results.push(entity);
            }
          }
        }
      }
    }

    return results;
  }

  queryRay(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, filter?: (e: PhysicsEntity) => boolean): RaycastHit | null {
    let closestHit: RaycastHit | null = null;
    let closestDist = maxDistance;

    const invDir = new THREE.Vector3(
      direction.x !== 0 ? 1 / direction.x : Infinity,
      direction.y !== 0 ? 1 / direction.y : Infinity,
      direction.z !== 0 ? 1 / direction.z : Infinity
    );

    const step = new THREE.Vector3(
      direction.x > 0 ? this.cellSize : -this.cellSize,
      direction.y > 0 ? this.cellSize : -this.cellSize,
      direction.z > 0 ? this.cellSize : -this.cellSize
    );

    let currentCell = this.getCellKey(origin.x, origin.z);
    let tMaxX = ((Math.floor(origin.x / this.cellSize) + (direction.x > 0 ? 1 : 0)) * this.cellSize - origin.x) * invDir.x;
    let tMaxY = ((Math.floor(origin.y / this.cellSize) + (direction.y > 0 ? 1 : 0)) * this.cellSize - origin.y) * invDir.y;
    let tMaxZ = ((Math.floor(origin.z / this.cellSize) + (direction.z > 0 ? 1 : 0)) * this.cellSize - origin.z) * invDir.z;

    const tDeltaX = Math.abs(this.cellSize * invDir.x);
    const tDeltaY = Math.abs(this.cellSize * invDir.y);
    const tDeltaZ = Math.abs(this.cellSize * invDir.z);

    const maxSteps = 100;
    for (let stepCount = 0; stepCount < maxSteps; stepCount++) {
      const cell = this.grid.get(currentCell);
      if (cell) {
        for (const entity of cell) {
          if (!filter || filter(entity)) {
            const hit = this.raycastAABB(origin, direction, entity.aabb);
            if (hit && hit.distance < closestDist) {
              closestDist = hit.distance;
              closestHit = { ...hit, entity };
            }
          }
        }
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          if (tMaxX > closestDist) break;
          currentCell = this.getCellKey(
            origin.x + direction.x * tMaxX,
            origin.z
          );
          tMaxX += tDeltaX;
        } else {
          if (tMaxZ > closestDist) break;
          currentCell = this.getCellKey(
            origin.x,
            origin.z + direction.z * tMaxZ
          );
          tMaxZ += tDeltaZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          if (tMaxY > closestDist) break;
          currentCell = this.getCellKey(
            origin.x,
            origin.z + direction.z * tMaxY
          );
          tMaxY += tDeltaY;
        } else {
          if (tMaxZ > closestDist) break;
          currentCell = this.getCellKey(
            origin.x,
            origin.z + direction.z * tMaxZ
          );
          tMaxZ += tDeltaZ;
        }
      }
    }

    return closestHit;
  }

  private raycastAABB(origin: THREE.Vector3, direction: THREE.Vector3, aabb: AABB): RaycastHit | null {
    const invDir = new THREE.Vector3(
      1 / direction.x,
      1 / direction.y,
      1 / direction.z
    );

    const t1 = (aabb.min.x - origin.x) * invDir.x;
    const t2 = (aabb.max.x - origin.x) * invDir.x;
    const t3 = (aabb.min.y - origin.y) * invDir.y;
    const t4 = (aabb.max.y - origin.y) * invDir.y;
    const t5 = (aabb.min.z - origin.z) * invDir.z;
    const t6 = (aabb.max.z - origin.z) * invDir.z;

    const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

    if (tmax < 0 || tmin > tmax) return null;

    const distance = tmin < 0 ? tmax : tmin;
    if (distance < 0) return null;

    const position = origin.clone().addScaledVector(direction, distance);

    let normal = new THREE.Vector3();
    const epsilon = 0.001;

    if (Math.abs(position.x - aabb.min.x) < epsilon) normal.set(-1, 0, 0);
    else if (Math.abs(position.x - aabb.max.x) < epsilon) normal.set(1, 0, 0);
    else if (Math.abs(position.y - aabb.min.y) < epsilon) normal.set(0, -1, 0);
    else if (Math.abs(position.y - aabb.max.y) < epsilon) normal.set(0, 1, 0);
    else if (Math.abs(position.z - aabb.min.z) < epsilon) normal.set(0, 0, -1);
    else if (Math.abs(position.z - aabb.max.z) < epsilon) normal.set(0, 0, 1);

    return { position, normal, distance, face: normal.clone() };
  }

  private shouldCollide(a: PhysicsEntity, b: PhysicsEntity): boolean {
    if (a.isStatic && b.isStatic) return false;
    if (a.isSleeping && b.isSleeping) return false;

    const layerA = a.layer;
    const maskA = a.mask;
    const layerB = b.layer;
    const maskB = b.mask;

    return (maskA & layerB) !== 0 && (maskB & layerA) !== 0;
  }

  private aabbOverlap(a: AABB, b: AABB): boolean {
    return a.min.x <= b.max.x && a.max.x >= b.min.x &&
           a.min.y <= b.max.y && a.max.y >= b.min.y &&
           a.min.z <= b.max.z && a.max.z >= b.min.z;
  }

  clear(): void {
    this.grid.clear();
    this.entities.clear();
  }

  getEntityCount(): number {
    return this.entities.size;
  }
}

export class Narrowphase {
  static checkAABBvsAABB(a: AABB, b: AABB): ContactPoint | null {
    const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
    const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
    const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);

    if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) return null;

    let minOverlap = overlapX;
    let normal = new THREE.Vector3(1, 0, 0);

    if (overlapY < minOverlap) {
      minOverlap = overlapY;
      normal.set(0, 1, 0);
    }
    if (overlapZ < minOverlap) {
      minOverlap = overlapZ;
      normal.set(0, 0, 1);
    }

    const centerA = new THREE.Vector3().addVectors(a.min, a.max).multiplyScalar(0.5);
    const centerB = new THREE.Vector3().addVectors(b.min, b.max).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(centerB, centerA);

    if (direction.dot(normal) < 0) {
      normal.negate();
    }

    const point = centerA.clone().addScaledVector(normal, minOverlap * 0.5);

    return {
      point,
      normal: normal.clone(),
      penetration: minOverlap,
      entityA: null as any,
      entityB: null as any,
    };
  }

  static checkSphereVsAABB(sphereCenter: THREE.Vector3, radius: number, aabb: AABB): ContactPoint | null {
    const closest = new THREE.Vector3(
      Math.max(aabb.min.x, Math.min(sphereCenter.x, aabb.max.x)),
      Math.max(aabb.min.y, Math.min(sphereCenter.y, aabb.max.y)),
      Math.max(aabb.min.z, Math.min(sphereCenter.z, aabb.max.z))
    );

    const diff = new THREE.Vector3().subVectors(sphereCenter, closest);
    const distSq = diff.lengthSq();

    if (distSq > radius * radius) return null;

    const dist = Math.sqrt(distSq);
    if (dist < 0.001) {
      return {
        point: closest.clone(),
        normal: new THREE.Vector3(0, 1, 0),
        penetration: radius,
        entityA: null as any,
        entityB: null as any,
      };
    }

    const normal = diff.clone().divideScalar(dist);
    const point = closest.clone().addScaledVector(normal, radius * 0.5);

    return {
      point,
      normal,
      penetration: radius - dist,
      entityA: null as any,
      entityB: null as any,
    };
  }

  static checkCapsuleVsAABB(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    radius: number,
    aabb: AABB
  ): ContactPoint | null {
    const closest = new THREE.Vector3();
    closest.x = Math.max(aabb.min.x, Math.min(p1.x, aabb.max.x));
    closest.y = Math.max(aabb.min.y, Math.min(p1.y, aabb.max.y));
    closest.z = Math.max(aabb.min.z, Math.min(p1.z, aabb.max.z));

    const segment = new THREE.Vector3().subVectors(p2, p1);
    const segLenSq = segment.lengthSq();

    if (segLenSq > 0) {
      const t = Math.max(0, Math.min(1, new THREE.Vector3().subVectors(closest, p1).dot(segment) / segLenSq));
      closest.x = p1.x + segment.x * t;
      closest.y = p1.y + segment.y * t;
      closest.z = p1.z + segment.z * t;
    }

    const diff = new THREE.Vector3().subVectors(closest, new THREE.Vector3(
      Math.max(aabb.min.x, Math.min(closest.x, aabb.max.x)),
      Math.max(aabb.min.y, Math.min(closest.y, aabb.max.y)),
      Math.max(aabb.min.z, Math.min(closest.z, aabb.max.z))
    ));

    const distSq = diff.lengthSq();
    if (distSq > radius * radius) return null;

    const dist = Math.sqrt(distSq);
    if (dist < 0.001) {
      return {
        point: closest.clone(),
        normal: new THREE.Vector3(0, 1, 0),
        penetration: radius,
        entityA: null as any,
        entityB: null as any,
      };
    }

    const normal = diff.clone().divideScalar(dist);
    const point = closest.clone().addScaledVector(normal, radius * 0.5);

    return {
      point,
      normal,
      penetration: radius - dist,
      entityA: null as any,
      entityB: null as any,
    };
  }
}

export class Solver {
  private positionIterations: number;
  private velocityIterations: number;
  private contacts: ContactPoint[] = [];

  constructor(positionIterations = 8, velocityIterations = 6) {
    this.positionIterations = positionIterations;
    this.velocityIterations = velocityIterations;
  }

  solve(contacts: ContactPoint[], dt: number): void {
    this.contacts = contacts;

    for (let i = 0; i < this.positionIterations; i++) {
      this.solvePositions();
    }

    for (let i = 0; i < this.velocityIterations; i++) {
      this.solveVelocities(dt);
    }
  }

  private solvePositions(): void {
    for (const contact of this.contacts) {
      const a = contact.entityA;
      const b = contact.entityB;

      if (a.isStatic && b.isStatic) continue;

      const totalInvMass = a.invMass + b.invMass;
      if (totalInvMass <= 0) continue;

      const correction = contact.normal.clone().multiplyScalar(
        contact.penetration / totalInvMass * 0.8
      );

      if (!a.isStatic && !a.isKinematic) {
        a.position.addScaledVector(correction, -a.invMass / totalInvMass);
        this.updateAABB(a);
      }
      if (!b.isStatic && !b.isKinematic) {
        b.position.addScaledVector(correction, b.invMass / totalInvMass);
        this.updateAABB(b);
      }
    }
  }

  private solveVelocities(dt: number): void {
    for (const contact of this.contacts) {
      const a = contact.entityA;
      const b = contact.entityB;

      if (a.isStatic && b.isStatic) continue;

      const relativeVelocity = new THREE.Vector3().subVectors(b.velocity, a.velocity);
      const normalVelocity = relativeVelocity.dot(contact.normal);

      if (normalVelocity > 0) continue;

      const totalInvMass = a.invMass + b.invMass;
      if (totalInvMass <= 0) continue;

      const e = Math.min(a.material.restitution, b.material.restitution);
      const j = -(1 + e) * normalVelocity / totalInvMass;

      const impulse = contact.normal.clone().multiplyScalar(j);

      if (!a.isStatic && !a.isKinematic) {
        a.velocity.addScaledVector(impulse, -a.invMass);
      }
      if (!b.isStatic && !b.isKinematic) {
        b.velocity.addScaledVector(impulse, b.invMass);
      }

      const friction = Math.sqrt(a.material.friction * b.material.friction);
      this.solveFriction(a, b, contact, friction, dt);
    }
  }

  private solveFriction(a: PhysicsEntity, b: PhysicsEntity, contact: ContactPoint, friction: number, dt: number): void {
    const relativeVelocity = new THREE.Vector3().subVectors(b.velocity, a.velocity);
    const normalVelocity = relativeVelocity.dot(contact.normal);
    const tangentVelocity = new THREE.Vector3().subVectors(relativeVelocity, contact.normal.clone().multiplyScalar(normalVelocity));
    const tangentSpeed = tangentVelocity.length();

    if (tangentSpeed < 0.001) return;

    const tangentDir = tangentVelocity.clone().divideScalar(tangentSpeed);
    const totalInvMass = a.invMass + b.invMass;
    if (totalInvMass <= 0) return;

    const jt = -tangentSpeed / totalInvMass;
    const maxFriction = friction * Math.abs(-(1 + 0) * normalVelocity / totalInvMass);

    const frictionImpulse = tangentDir.clone().multiplyScalar(Math.max(-maxFriction, Math.min(maxFriction, jt)));

    if (!a.isStatic && !a.isKinematic) {
      a.velocity.addScaledVector(frictionImpulse, -a.invMass);
    }
    if (!b.isStatic && !b.isKinematic) {
      b.velocity.addScaledVector(frictionImpulse, b.invMass);
    }
  }

  private updateAABB(entity: PhysicsEntity): void {
    const halfExtents = new THREE.Vector3().subVectors(entity.aabb.max, entity.aabb.min).multiplyScalar(0.5);
    entity.aabb.min.copy(entity.position).sub(halfExtents);
    entity.aabb.max.copy(entity.position).add(halfExtents);
  }
}

export class PhysicsWorld {
  private config: PhysicsWorldConfig;
  private broadphase: Broadphase;
  private narrowphase: Narrowphase;
  private solver: Solver;
  private entities: Map<string, PhysicsEntity> = new Map();
  private staticEntities: Map<string, PhysicsEntity> = new Map();
  private kinematicEntities: Map<string, PhysicsEntity> = new Map();
  private dynamicEntities: Map<string, PhysicsEntity> = new Map();
  private contacts: ContactPoint[] = [];
  private accumulators: Map<string, THREE.Vector3> = new Map();
  private timeAccumulator = 0;
  private stepCount = 0;

  constructor(config: Partial<PhysicsWorldConfig> = {}) {
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    this.broadphase = new Broadphase(this.config.gridCellSize);
    this.narrowphase = new Narrowphase();
    this.solver = new Solver(this.config.positionIterations, this.config.velocityIterations);
  }

  addEntity(entity: PhysicsEntity): void {
    this.entities.set(entity.id, entity);
    this.broadphase.insert(entity);

    if (entity.isStatic) {
      this.staticEntities.set(entity.id, entity);
    } else if (entity.isKinematic) {
      this.kinematicEntities.set(entity.id, entity);
    } else {
      this.dynamicEntities.set(entity.id, entity);
    }
  }

  removeEntity(id: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    this.entities.delete(id);
    this.staticEntities.delete(id);
    this.kinematicEntities.delete(id);
    this.dynamicEntities.delete(id);
    this.broadphase.remove(entity);
    this.accumulators.delete(id);
    return true;
  }

  getEntity(id: string): PhysicsEntity | undefined {
    return this.entities.get(id);
  }

  updateEntity(entity: PhysicsEntity): void {
    this.broadphase.update(entity);
  }

  step(deltaTime: number): void {
    this.timeAccumulator += deltaTime;

    const fixedDt = this.config.fixedTimeStep;
    let steps = 0;

    while (this.timeAccumulator >= fixedDt && steps < this.config.maxSubSteps) {
      this.fixedStep(fixedDt);
      this.timeAccumulator -= fixedDt;
      steps++;
    }

    this.stepCount++;
  }

  private fixedStep(dt: number): void {
    this.contacts = [];

    this.integrateForces(dt);
    this.detectCollisions();
    this.solver.solve(this.contacts, dt);
    this.integrateVelocities(dt);
    this.updateSleepStates(dt);
    this.syncBroadphase();
  }

  private integrateForces(dt: number): void {
    for (const entity of this.dynamicEntities.values()) {
      if (entity.isSleeping) continue;

      if (entity.useGravity) {
        entity.acceleration.addScaledVector(this.config.gravity, entity.gravityScale);
      }

      entity.velocity.addScaledVector(entity.acceleration, dt);
      entity.acceleration.set(0, 0, 0);

      if (entity.linearDamping > 0) {
        entity.velocity.multiplyScalar(Math.pow(1 - entity.linearDamping, dt));
      }

      const speed = entity.velocity.length();
      if (speed > entity.maxSpeed) {
        entity.velocity.multiplyScalar(entity.maxSpeed / speed);
      }
    }
  }

  private integrateVelocities(dt: number): void {
    for (const entity of this.dynamicEntities.values()) {
      if (entity.isSleeping) continue;

      const oldPosition = entity.position.clone();
      entity.position.addScaledVector(entity.velocity, dt);

      entity.onGround = false;
      entity.onWall = false;

      for (const contact of this.contacts) {
        if (contact.entityA === entity) {
          if (contact.normal.y > 0.7) {
            entity.onGround = true;
            entity.groundNormal.copy(contact.normal);
          } else if (Math.abs(contact.normal.y) < 0.3) {
            entity.onWall = true;
            entity.wallNormal.copy(contact.normal);
          }
        } else if (contact.entityB === entity) {
          if (contact.normal.y < -0.7) {
            entity.onGround = true;
            entity.groundNormal.copy(contact.normal).negate();
          } else if (Math.abs(contact.normal.y) < 0.3) {
            entity.onWall = true;
            entity.wallNormal.copy(contact.normal).negate();
          }
        }
      }

      this.updateAABB(entity);

      gameEvents.emit('entity-moved', {
        entityId: entity.id,
        position: entity.position.clone(),
        velocity: entity.velocity.clone(),
        onGround: entity.onGround,
      });
    }

    for (const entity of this.kinematicEntities.values()) {
      this.updateAABB(entity);
    }
  }

  private detectCollisions(): void {
    const pairs = this.broadphase.getPotentialPairs();

    for (const [a, b] of pairs) {
      const contact = Narrowphase.checkAABBvsAABB(a.aabb, b.aabb);
      if (contact) {
        contact.entityA = a;
        contact.entityB = b;
        this.contacts.push(contact);
      }
    }
  }

  private updateSleepStates(dt: number): void {
    if (!this.config.enableSleep) return;

    for (const entity of this.dynamicEntities.values()) {
      const speed = entity.velocity.lengthSq();

      if (speed < this.config.sleepThreshold * this.config.sleepThreshold) {
        entity.sleepTimer += dt;
        if (entity.sleepTimer > this.config.sleepTimeThreshold) {
          entity.isSleeping = true;
          entity.velocity.set(0, 0, 0);
        }
      } else {
        entity.sleepTimer = 0;
        entity.isSleeping = false;
      }
    }
  }

  private syncBroadphase(): void {
    for (const entity of this.dynamicEntities.values()) {
      if (!entity.isSleeping) {
        this.broadphase.update(entity);
      }
    }
    for (const entity of this.kinematicEntities.values()) {
      this.broadphase.update(entity);
    }
  }

  private updateAABB(entity: PhysicsEntity): void {
    const halfExtents = new THREE.Vector3().subVectors(entity.aabb.max, entity.aabb.min).multiplyScalar(0.5);
    entity.aabb.min.copy(entity.position).sub(halfExtents);
    entity.aabb.max.copy(entity.position).add(halfExtents);
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, filter?: (e: PhysicsEntity) => boolean): RaycastHit | null {
    return this.broadphase.queryRay(origin, direction, maxDistance, filter);
  }

  queryAABB(aabb: AABB, filter?: (e: PhysicsEntity) => boolean): PhysicsEntity[] {
    return this.broadphase.queryAABB(aabb, filter);
  }

  applyImpulse(entityId: string, impulse: THREE.Vector3): void {
    const entity = this.entities.get(entityId);
    if (entity && !entity.isStatic && !entity.isKinematic) {
      entity.velocity.addScaledVector(impulse, entity.invMass);
      entity.isSleeping = false;
      entity.sleepTimer = 0;
    }
  }

  applyForce(entityId: string, force: THREE.Vector3): void {
    const entity = this.entities.get(entityId);
    if (entity && !entity.isStatic) {
      entity.acceleration.addScaledVector(force, entity.invMass);
    }
  }

  setVelocity(entityId: string, velocity: THREE.Vector3): void {
    const entity = this.entities.get(entityId);
    if (entity && !entity.isStatic) {
      entity.velocity.copy(velocity);
      entity.isSleeping = false;
      entity.sleepTimer = 0;
    }
  }

  setPosition(entityId: string, position: THREE.Vector3): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.position.copy(position);
      this.updateAABB(entity);
      this.broadphase.update(entity);
    }
  }

  wakeEntity(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.isSleeping = false;
      entity.sleepTimer = 0;
    }
  }

  getDynamicEntities(): PhysicsEntity[] {
    return Array.from(this.dynamicEntities.values());
  }

  getAllEntities(): PhysicsEntity[] {
    return Array.from(this.entities.values());
  }

  getContactCount(): number {
    return this.contacts.length;
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  setGravity(gravity: THREE.Vector3): void {
    this.config.gravity.copy(gravity);
  }

  setConfig(config: Partial<PhysicsWorldConfig>): void {
    this.config = { ...this.config, ...config };
    this.broadphase = new Broadphase(this.config.gridCellSize);
    this.solver = new Solver(this.config.positionIterations, this.config.velocityIterations);

    for (const entity of this.entities.values()) {
      this.broadphase.insert(entity);
    }
  }

  dispose(): void {
    this.entities.clear();
    this.staticEntities.clear();
    this.kinematicEntities.clear();
    this.dynamicEntities.clear();
    this.broadphase.clear();
    this.contacts = [];
    this.accumulators.clear();
  }
}

export function createPhysicsEntity(
  id: string,
  position: THREE.Vector3,
  halfExtents: THREE.Vector3,
  mass: number,
  config: Partial<PhysicsEntity> = {}
): PhysicsEntity {
  const isStatic = mass <= 0;
  const invMass = isStatic ? 0 : 1 / mass;

  return {
    id,
    position: position.clone(),
    velocity: new THREE.Vector3(),
    acceleration: new THREE.Vector3(),
    aabb: {
      min: position.clone().sub(halfExtents),
      max: position.clone().add(halfExtents),
    },
    mass,
    invMass,
    material: config.material ?? DEFAULT_MATERIAL,
    layer: config.layer ?? CollisionLayer.DEFAULT,
    mask: config.mask ?? CollisionFlags.ALL,
    isStatic,
    isKinematic: config.isKinematic ?? false,
    isSleeping: false,
    sleepTimer: 0,
    linearDamping: config.linearDamping ?? 0.01,
    angularDamping: config.angularDamping ?? 0.01,
    useGravity: config.useGravity ?? true,
    gravityScale: config.gravityScale ?? 1,
    maxSpeed: config.maxSpeed ?? 50,
    onGround: false,
    onWall: false,
    wallNormal: new THREE.Vector3(),
    groundNormal: new THREE.Vector3(0, 1, 0),
    contacts: [],
    userData: config.userData,
  };
}

export function createPhysicsWorld(config?: Partial<PhysicsWorldConfig>): PhysicsWorld {
  return new PhysicsWorld(config);
}