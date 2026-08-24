/**
 * Survival — health, fall damage, swimming, drowning.
 *
 * Pure simulation module (no DOM, no THREE): fully unit-testable.
 *  - Fall damage: impact speed beyond 30 (units/s) costs (speed-30)/2 HP.
 *  - Water: buoyancy damps falls; swim control replaces ground friction.
 *  - Air meter: 15s underwater, then 1 HP per second of drowning.
 */

export interface SurvivalBody {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
}

export interface SurvivalDeps {
  /** Is this cell a liquid the player can swim in? */
  isWater: (x: number, y: number, z: number) => boolean;
  /** Is the player's head underwater (for air meter)? */
  headUnderwater: (body: SurvivalBody) => boolean;
  maxHealth?: number;
}

export const FALL_DAMAGE_THRESHOLD = 30;
export const AIR_SECONDS = 15;

export class Survival {
  health: number;
  private readonly maxHealth: number;
  private readonly deps: SurvivalDeps;
  private airTimer = 0; // seconds submerged
  private _drowning = false;

  constructor(deps: SurvivalDeps, startHealth?: number) {
    this.deps = deps;
    this.maxHealth = deps.maxHealth ?? 20;
    this.health = startHealth ?? this.maxHealth;
  }

  get max(): number {
    return this.maxHealth;
  }

  get isDrowning(): boolean {
    return this._drowning;
  }

  get airRemaining(): number {
    return Math.max(0, AIR_SECONDS - this.airTimer);
  }

  damage(amount: number): void {
    if (amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
  }

  heal(amount: number): void {
    if (amount <= 0) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  get dead(): boolean {
    return this.health <= 0;
  }

  /**
   * Called by physics integration AFTER a move step.
   * `landedThisStep` flags a downward collision that zeroed vy.
   */
  tick(body: SurvivalBody, dt: number, landedThisStep: boolean, impactSpeed: number): void {
    const inWater = this.deps.isWater(
      Math.floor(body.position.x),
      Math.floor(body.position.y),
      Math.floor(body.position.z),
    );

    // --- fall damage on landing ---
    if (landedThisStep && !inWater && impactSpeed > FALL_DAMAGE_THRESHOLD) {
      this.damage((impactSpeed - FALL_DAMAGE_THRESHOLD) / 2);
    }
    // water landing forgives all fall momentum
    if (inWater && body.velocity.y < -FALL_DAMAGE_THRESHOLD) {
      body.velocity.y = -FALL_DAMAGE_THRESHOLD / 4; // splash deceleration
    }

    // --- air / drowning ---
    if (this.deps.headUnderwater(body)) {
      this.airTimer += dt;
      if (this.airTimer >= AIR_SECONDS) {
        this._drowning = true;
        this.damage(dt * 1); // 1 HP per second while drowning
      }
    } else {
      // breathing resets quickly when surfacing
      this.airTimer = Math.max(0, this.airTimer - dt * 3);
      this._drowning = false;
    }
  }

  resetAir(): void {
    this.airTimer = 0;
    this._drowning = false;
  }
}
