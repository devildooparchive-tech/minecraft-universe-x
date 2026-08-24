/**
 * Physics — minimal AABB-vs-voxel physics for the player.
 *
 * Kept dependency-free and pure (no THREE import) so it is fully unit-testable.
 * The player is an axis-aligned box; the world is solid/air cells.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PhysicsBody {
  position: Vec3; // feet center
  velocity: Vec3;
  width: number; // full width (x and z)
  height: number;
  onGround: boolean;
}

export interface PhysicsWorldOptions {
  gravity?: number; // blocks/s^2
  /** Collision query: is this world cell solid? */
  isSolid: (x: number, y: number, z: number) => boolean;
  /** Friction coefficient of the block underfoot (0..1, default 1). */
  groundFrictionAt?: (x: number, y: number, z: number) => number;
  /** Water column height above a cell (0 = dry) for depth-aware fluids. */
  waterColumnAt?: (x: number, y: number, z: number) => number;
}

const EPS = 1e-6;
const MAX_SUBSTEP = 0.4; // blocks per substep — anti-tunneling guarantee

/** Depth-aware water drag: deeper column → slower terminal sink. */
const WATER_VERTICAL_DRAG_PER_DEPTH = 0.82;

export class PhysicsWorld {
  readonly gravity: number;
  private readonly isSolidFn: (x: number, y: number, z: number) => boolean;
  private readonly frictionFn?: (x: number, y: number, z: number) => number;
  private readonly waterColumnFn?: (x: number, y: number, z: number) => number;
  /** last-step impact speed (positive magnitude), consumed by survival systems */
  lastImpactSpeed = 0;

  constructor(options: PhysicsWorldOptions) {
    this.gravity = options.gravity ?? 28;
    this.isSolidFn = options.isSolid;
    this.frictionFn = options.groundFrictionAt;
    this.waterColumnFn = options.waterColumnAt;
  }

  /** Would the AABB at (pos) intersect any solid cell? pos = feet center. */
  private collides(pos: Vec3, width: number, height: number): boolean {
    const half = width / 2;
    const minX = Math.floor(pos.x - half + EPS);
    const maxX = Math.floor(pos.x + half - EPS);
    const minY = Math.floor(pos.y + EPS);
    const maxY = Math.floor(pos.y + height - EPS);
    const minZ = Math.floor(pos.z - half + EPS);
    const maxZ = Math.floor(pos.z + half - EPS);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.isSolidFn(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  /**
   * Integrate one fixed step.
   * Superiority #1 (anti-tunneling): the move is split into substeps of at
   * most MAX_SUBSTEP blocks, so no velocity can skip past a thin wall.
   * Superiority #3 (depth-aware water): buoyancy & vertical drag scale with
   * the water column above the entity.
   * Superiority #4: ground friction comes from the block underfoot.
   */
  step(body: PhysicsBody, dt: number): void {
    const feet = body.position;
    const waterCol = this.waterColumnFn?.(Math.floor(feet.x), Math.floor(feet.y), Math.floor(feet.z)) ?? 0;
    const submerged = waterCol > 0;

    // --- gravity & fluids ---
    if (submerged) {
      const depthRatio = Math.min(1, waterCol / 3);
      // buoyancy counteracts gravity proportionally to submersion depth
      const effectiveGravity = this.gravity * (1 - 0.85 * depthRatio);
      body.velocity.y -= effectiveGravity * dt;
      // deeper column → stronger vertical drag (scaled by depth ratio)
      const drag = Math.pow(WATER_VERTICAL_DRAG_PER_DEPTH, dt * 10 * depthRatio);
      body.velocity.y *= drag;
      if (body.velocity.y < -6) body.velocity.y = -6; // gentle terminal sink in water
    } else {
      body.velocity.y -= this.gravity * dt;
      if (body.velocity.y < -60) body.velocity.y = -60; // terminal velocity in air
    }

    // --- substepped movement ---
    const moveX = body.velocity.x * dt;
    const moveY = body.velocity.y * dt;
    const moveZ = body.velocity.z * dt;
    const steps = Math.max(
      1,
      Math.ceil(Math.abs(moveX) / MAX_SUBSTEP),
      Math.ceil(Math.abs(moveY) / MAX_SUBSTEP),
      Math.ceil(Math.abs(moveZ) / MAX_SUBSTEP),
    );
    const subDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      // X axis
      if (body.velocity.x !== 0) {
        const old = body.position.x;
        body.position.x += body.velocity.x * subDt;
        if (this.collides(body.position, body.width, body.height)) {
          body.position.x = old;
          body.velocity.x = 0;
        }
      }
      // Z axis
      if (body.velocity.z !== 0) {
        const old = body.position.z;
        body.position.z += body.velocity.z * subDt;
        if (this.collides(body.position, body.width, body.height)) {
          body.position.z = old;
          body.velocity.z = 0;
        }
      }
      // Y axis
      if (body.velocity.y !== 0) {
        const old = body.position.y;
        const vyBefore = body.velocity.y;
        body.position.y += body.velocity.y * subDt;
        if (this.collides(body.position, body.width, body.height)) {
          body.position.y = old;
          if (vyBefore < 0) {
            body.onGround = true;
            // record the strongest downward impact seen this step
            this.lastImpactSpeed = Math.max(this.lastImpactSpeed, -vyBefore);
          }
          body.velocity.y = 0;
        } else if (!submerged) {
          body.onGround = false;
        }
      }
    }

    // --- environment friction on horizontal motion (grounded only) ---
    if (body.onGround && this.frictionFn) {
      const f = this.frictionFn(Math.floor(body.position.x), Math.floor(body.position.y - 0.1), Math.floor(body.position.z));
      const drag = Math.pow(1 - Math.min(0.9, Math.max(0, 1 - f)), dt * 10);
      body.velocity.x *= drag;
      body.velocity.z *= drag;
    }

    // --- ground probe when standing still ---
    if (body.velocity.y === 0 && !submerged) {
      const probe: Vec3 = { x: body.position.x, y: body.position.y - 0.05, z: body.position.z };
      body.onGround = this.collides(probe, body.width, body.height);
    }
  }
}
