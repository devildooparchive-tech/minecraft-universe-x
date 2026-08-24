/**
 * Player — physics body + movement intents. Rendering-agnostic.
 */

import type { PhysicsBody, Vec3 } from '../physics/physics';

export interface PlayerOptions {
  position: Vec3;
  speed?: number;
  jumpVelocity?: number;
}

export class Player {
  readonly body: PhysicsBody;
  readonly speed: number;
  readonly jumpVelocity: number;
  private yaw = 0;
  private pitch = 0;

  constructor(options: PlayerOptions) {
    this.speed = options.speed ?? 5.5;
    this.jumpVelocity = options.jumpVelocity ?? 9;
    this.body = {
      position: { ...options.position },
      velocity: { x: 0, y: 0, z: 0 },
      width: 0.6,
      height: 1.8,
      onGround: false,
    };
  }

  get eyePosition(): Vec3 {
    return {
      x: this.body.position.x,
      y: this.body.position.y + 1.62,
      z: this.body.position.z,
    };
  }

  look(dx: number, dy: number, sensitivity = 0.0022): void {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  get yawAngle(): number {
    return this.yaw;
  }

  get pitchAngle(): number {
    return this.pitch;
  }

  /** Apply WASD movement relative to look direction. */
  move(input: { forward: number; strafe: number }): void {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward vector in xz plane (three.js style: -z forward at yaw 0)
    const fx = -sin;
    const fz = -cos;
    const rx = cos;
    const rz = -sin;
    this.body.velocity.x = (fx * input.forward + rx * input.strafe) * this.speed;
    this.body.velocity.z = (fz * input.forward + rz * input.strafe) * this.speed;
  }

  tryJump(): void {
    if (this.body.onGround) {
      this.body.velocity.y = this.jumpVelocity;
    }
  }
}
