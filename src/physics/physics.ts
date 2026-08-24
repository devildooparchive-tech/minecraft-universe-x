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
}

const EPS = 1e-6;

export class PhysicsWorld {
  readonly gravity: number;
  private readonly isSolidFn: (x: number, y: number, z: number) => boolean;

  constructor(options: PhysicsWorldOptions) {
    this.gravity = options.gravity ?? 28;
    this.isSolidFn = options.isSolid;
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
   * Integrate one fixed step. Moves axis-by-axis (x, then z, then y) so
   * sliding along walls works naturally.
   */
  step(body: PhysicsBody, dt: number): void {
    // gravity
    body.velocity.y -= this.gravity * dt;
    if (body.velocity.y < -60) body.velocity.y = -60; // terminal velocity

    const move: Vec3 = {
      x: body.velocity.x * dt,
      y: body.velocity.y * dt,
      z: body.velocity.z * dt,
    };

    // X axis
    if (move.x !== 0) {
      const old = body.position.x;
      body.position.x += move.x;
      if (this.collides(body.position, body.width, body.height)) {
        body.position.x = old;
        body.velocity.x = 0;
      }
    }
    // Z axis
    if (move.z !== 0) {
      const old = body.position.z;
      body.position.z += move.z;
      if (this.collides(body.position, body.width, body.height)) {
        body.position.z = old;
        body.velocity.z = 0;
      }
    }
    // Y axis
    if (move.y !== 0) {
      const old = body.position.y;
      body.position.y += move.y;
      if (this.collides(body.position, body.width, body.height)) {
        body.position.y = old;
        if (move.y < 0) {
          body.onGround = true;
        }
        body.velocity.y = 0;
      } else if (move.y !== 0) {
        body.onGround = false;
      }
    }
    // Ground probe when standing still (velocity.y === 0 case)
    if (body.velocity.y === 0) {
      const probe: Vec3 = { x: body.position.x, y: body.position.y - 0.05, z: body.position.z };
      body.onGround = this.collides(probe, body.width, body.height);
    }
  }
}
