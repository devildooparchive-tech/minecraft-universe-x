import { describe, it, expect } from 'vitest';
import { PhysicsWorld, PhysicsBody } from '../../src/physics/physics';

function flatWorld(): (x: number, y: number, z: number) => boolean {
  return (_x, y, _z) => y < 0; // solid below y=0
}

function makeBody(over: Partial<PhysicsBody> = {}): PhysicsBody {
  return {
    position: { x: 8.5, y: 5, z: 8.5 },
    velocity: { x: 0, y: 0, z: 0 },
    width: 0.6,
    height: 1.8,
    onGround: false,
    ...over,
  };
}

describe('PhysicsWorld', () => {
  it('gravity accelerates downward until ground contact', () => {
    const p = new PhysicsWorld({ isSolid: flatWorld() });
    const b = makeBody();
    for (let i = 0; i < 200; i++) p.step(b, 1 / 60);
    expect(b.onGround).toBe(true);
    expect(b.position.y).toBeGreaterThanOrEqual(0);
    expect(b.position.y).toBeLessThan(0.2);
    expect(b.velocity.y).toBe(0);
  });

  it('walking into a wall stops x movement but keeps gravity working', () => {
    // wall at x=10
    const p = new PhysicsWorld({ isSolid: (x, y) => y < 0 || (x === 10 && y < 3) });
    const b = makeBody({ position: { x: 8.5, y: 0.01, z: 8.5 }, onGround: true });
    b.velocity.x = 5;
    for (let i = 0; i < 120; i++) p.step(b, 1 / 60);
    expect(b.position.x).toBeLessThan(10); // never inside the wall
    expect(b.velocity.x).toBe(0); // stopped by wall
    expect(b.onGround).toBe(true);
  });

  it('jumping leaves ground then returns', () => {
    const p = new PhysicsWorld({ isSolid: flatWorld() });
    const b = makeBody({ position: { x: 8.5, y: 0.01, z: 8.5 }, onGround: true });
    b.velocity.y = 9; // jump impulse
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      p.step(b, 1 / 60);
      peak = Math.max(peak, b.position.y);
    }
    expect(peak).toBeGreaterThan(1); // actually jumped
    expect(b.onGround).toBe(true); // and landed
  });

  it('sliding along a wall: blocked on x, free on z', () => {
    const p = new PhysicsWorld({ isSolid: (x, y) => y < 0 || (x === 10 && y < 3) });
    const b = makeBody({ position: { x: 9.5, y: 0.01, z: 8.5 }, onGround: true });
    b.velocity.x = 5;
    b.velocity.z = 3;
    for (let i = 0; i < 60; i++) p.step(b, 1 / 60);
    expect(b.position.x).toBeLessThan(10);
    expect(b.position.z).toBeGreaterThan(9); // kept sliding on z
  });

  it('ceiling stops upward velocity', () => {
    const p = new PhysicsWorld({ isSolid: (_x, y) => y < 0 || y === 4 });
    const b = makeBody({ position: { x: 8.5, y: 0.01, z: 8.5 }, onGround: true });
    b.velocity.y = 20;
    for (let i = 0; i < 120; i++) p.step(b, 1 / 60);
    expect(b.position.y + b.height).toBeLessThan(4.01);
  });
});
