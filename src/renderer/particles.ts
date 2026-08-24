/**
 * ParticleSystem (logic core) — burst particles on block break.
 *
 * Renderer-agnostic: owns positions/velocities/lifetimes as typed arrays.
 * The THREE layer (main.ts) maps these to a Points buffer each frame.
 * Deterministic given the same RNG seed → unit-testable.
 */

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number; // seconds remaining
  maxLife: number;
  colorIndex: number; // palette slot
}

export class ParticleSystem {
  readonly particles: Particle[] = [];
  private readonly maxParticles: number;

  constructor(maxParticles = 500) {
    this.maxParticles = maxParticles;
  }

  get count(): number {
    return this.particles.length;
  }

  /**
   * Spawn a break-burst at a block center with its color index.
   * count clamped to [10,20] per spec; velocities are small random sprays.
   */
  burst(x: number, y: number, z: number, colorIndex: number, rng: () => number = Math.random): void {
    const count = 10 + Math.floor(rng() * 11); // 10..20
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const maxLife = 0.6 + rng() * 0.5; // 0.6..1.1s
      this.particles.push({
        x: x + 0.5 + (rng() - 0.5) * 0.6,
        y: y + 0.5 + (rng() - 0.5) * 0.6,
        z: z + 0.5 + (rng() - 0.5) * 0.6,
        vx: (rng() - 0.5) * 4,
        vy: 2 + rng() * 3, // pop upward
        vz: (rng() - 0.5) * 4,
        life: maxLife,
        maxLife,
        colorIndex,
      });
    }
  }

  /** Advance all particles; gravity pulls them down; dead ones are culled. */
  update(dt: number): void {
    const g = -12;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  }
}
