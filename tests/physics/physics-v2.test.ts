import { describe, it, expect } from 'vitest';
import { PhysicsWorld, type PhysicsBody } from '../../src/physics/physics';

function makeBody(over: Partial<PhysicsBody> = {}): PhysicsBody {
  return {
    position: { x: 8.5, y: 40, z: 8.5 },
    velocity: { x: 0, y: 0, z: 0 },
    width: 0.6,
    height: 1.8,
    onGround: false,
    ...over,
  };
}

describe('Physics superiority #1: anti-tunneling (substeps)', () => {
  it('a body moving at 100 blocks/s cannot pass through a 1-block wall', () => {
    // wall at x=20 (single column), floor below
    const p = new PhysicsWorld({
      isSolid: (x, y) => y < 0 || x === 20,
    });
    const b = makeBody({ position: { x: 10.5, y: 5, z: 8.5 }, onGround: true });
    b.velocity.x = 100; // insane speed — would tunnel in vanilla
    for (let i = 0; i < 60; i++) p.step(b, 1 / 60);
    expect(b.position.x).toBeLessThan(20); // never crossed
    expect(b.position.x).toBeGreaterThan(19 - 1); // stopped at the wall face
    expect(b.velocity.x).toBe(0);
  });

  it('a fast-falling body lands ON the floor, never inside/below it', () => {
    const p = new PhysicsWorld({ isSolid: (_x, y) => y < 0 });
    const b = makeBody({ position: { x: 0, y: 60, z: 0 } });
    // gravity alone reaches ~-45 blocks/s after ~1.6s of fall from 60 up
    for (let i = 0; i < 200; i++) p.step(b, 1 / 30);
    expect(b.position.y).toBeGreaterThanOrEqual(0);
    expect(b.position.y).toBeLessThan(1);
    expect(p.lastImpactSpeed).toBeGreaterThan(FALL_THRESHOLD);
  });

  it('normal-speed movement still works identically', () => {
    const p = new PhysicsWorld({ isSolid: (_x, y) => y < 0 });
    const b = makeBody({ position: { x: 8.5, y: 3, z: 8.5 }, onGround: true });
    b.velocity.x = 5; // normal walk speed
    for (let i = 0; i < 30; i++) p.step(b, 1 / 60);
    expect(b.position.x).toBeGreaterThan(9); // moved normally
  });
});

const FALL_THRESHOLD = 20;

describe('Physics superiority #3: depth-aware water', () => {
  /** water fills y<10 with column depth reported by a lookup */
  function waterWorld(columns: Map<string, number>) {
    return new PhysicsWorld({
      isSolid: (_x, y) => y < 0,
      waterColumnAt: (x, _y, z) => columns.get(`${x},${z}`) ?? 0,
    });
  }

  it('deep water sinks slower than shallow water', () => {
    const deep = waterWorld(new Map([['8,8', 6]]));
    const shallow = waterWorld(new Map([['8,8', 1]]));
    const bd = makeBody({ position: { x: 8.5, y: 8, z: 8.5 }, velocity: { x: 0, y: -5, z: 0 } });
    const bs = makeBody({ position: { x: 8.5, y: 8, z: 8.5 }, velocity: { x: 0, y: -5, z: 0 } });
    deep.step(bd, 0.2);
    shallow.step(bs, 0.2);
    // deep column drags harder → less negative velocity remains (before clamp)
    expect(bd.velocity.y).toBeGreaterThan(bs.velocity.y);
  });

  it('buoyancy reduces effective gravity underwater vs air', () => {
    const wet = waterWorld(new Map([['8,8', 4]]));
    const dry = new PhysicsWorld({ isSolid: () => false });
    const bw = makeBody({ velocity: { x: 0, y: 0, z: 0 } });
    const ba = makeBody({ velocity: { x: 0, y: 0, z: 0 } });
    wet.step(bw, 0.5);
    dry.step(ba, 0.5);
    // after same dt: falling slower in water than in air
    expect(bw.velocity.y).toBeGreaterThan(ba.velocity.y);
    expect(bw.velocity.y).toBeGreaterThan(-15); // gentle sink
  });
});

describe('Physics superiority #4: per-block ground friction', () => {
  it('ice (high friction value → low drag) slides farther than sand', () => {
    // friction fn returns 1.0 on ice strip, 0.05 on sand strip
    let surface = 'ice';
    const p = new PhysicsWorld({
      isSolid: (_x, y) => y < 0,
      groundFrictionAt: () => (surface === 'ice' ? 1.0 : 0.05),
    });
    const slide = (): number => {
      const b = makeBody({ position: { x: 8.5, y: 0.01, z: 8.5 }, onGround: true });
      b.velocity.x = 10;
      for (let i = 0; i < 60; i++) p.step(b, 1 / 60);
      return b.position.x - 8.5;
    };
    const iceDist = slide();
    surface = 'sand';
    const sandDist = slide();
    expect(iceDist).toBeGreaterThan(sandDist * 1.5); // dramatically slippier
  });

  it('no friction callback → legacy behavior preserved', () => {
    const p = new PhysicsWorld({ isSolid: (_x, y) => y < 0 });
    const b = makeBody({ position: { x: 8.5, y: 0.01, z: 8.5 }, onGround: true });
    b.velocity.x = 5;
    for (let i = 0; i < 60; i++) p.step(b, 1 / 60);
    expect(b.position.x).toBeGreaterThan(13); // glides freely like before
  });
});

describe('Regression guard: core behaviors still work', () => {
  it('gravity + landing + jump still function', () => {
    const p = new PhysicsWorld({ isSolid: (_x, y) => y < 0 });
    const b = makeBody({ position: { x: 8.5, y: 5, z: 8.5 } });
    for (let i = 0; i < 200; i++) p.step(b, 1 / 60);
    expect(b.onGround).toBe(true);
    b.velocity.y = 9;
    let peak = b.position.y;
    for (let i = 0; i < 90; i++) {
      p.step(b, 1 / 60);
      peak = Math.max(peak, b.position.y);
    }
    expect(peak).toBeGreaterThan(1.2); // jumped (v=9, g=28 → apex ≈1.45)
    expect(b.onGround).toBe(true);
  });

  it('wall sliding still works with substeps active', () => {
    const p = new PhysicsWorld({ isSolid: (x, y) => y < 0 || (x === 10 && y < 3) });
    const b = makeBody({ position: { x: 9.5, y: 0.01, z: 8.5 }, onGround: true });
    b.velocity.x = 5;
    b.velocity.z = 3;
    for (let i = 0; i < 60; i++) p.step(b, 1 / 60);
    expect(b.position.x).toBeLessThan(10);
    expect(b.position.z).toBeGreaterThan(9);
  });
});
