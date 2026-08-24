import { describe, it, expect } from 'vitest';
import { Player } from '../../src/player/player';

describe('Player', () => {
  it('spawns at the requested position with eye offset', () => {
    const p = new Player({ position: { x: 8.5, y: 30, z: 8.5 } });
    expect(p.body.position.y).toBe(30);
    expect(p.eyePosition.y).toBe(31.62);
  });

  it('look() clamps pitch and accumulates yaw', () => {
    const p = new Player({ position: { x: 0, y: 0, z: 0 } });
    p.look(100, 0); // yaw decreases
    expect(p.yawAngle).toBeLessThan(0);
    p.look(0, 10000); // extreme pitch clamps to ~±π/2
    expect(Math.abs(p.pitchAngle)).toBeLessThan(Math.PI / 2);
  });

  it('W (forward) moves along the look direction', () => {
    const p = new Player({ position: { x: 0, y: 0, z: 0 } });
    p.move({ forward: 1, strafe: 0 });
    // yaw=0 → forward is -z
    expect(p.body.velocity.z).toBeLessThan(0);
    expect(p.body.velocity.x).toBe(0);
  });

  it('A/D strafe is perpendicular to forward', () => {
    const p = new Player({ position: { x: 0, y: 0, z: 0 } });
    p.move({ forward: 0, strafe: 1 });
    expect(p.body.velocity.x).toBeGreaterThan(0);
    // -0 and +0 are both "no forward motion"
    expect(Math.abs(p.body.velocity.z)).toBe(0);
  });

  it('jump only works when on ground', () => {
    const p = new Player({ position: { x: 0, y: 0, z: 0 } });
    p.body.onGround = false;
    p.tryJump();
    expect(p.body.velocity.y).toBe(0);
    p.body.onGround = true;
    p.tryJump();
    expect(p.body.velocity.y).toBeGreaterThan(0);
  });
});
