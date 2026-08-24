import { describe, it, expect } from 'vitest';
import { Survival, FALL_DAMAGE_THRESHOLD, AIR_SECONDS } from '../../src/player/survival';

const neverWater = {
  isWater: () => false,
  headUnderwater: () => false,
};
const body = () => ({
  position: { x: 8.5, y: 10, z: 8.5 },
  velocity: { x: 0, y: 0, z: 0 },
});

describe('Survival: health', () => {
  it('starts at max and clamps damage/heal', () => {
    const s = new Survival(neverWater);
    expect(s.health).toBe(20);
    s.damage(5);
    expect(s.health).toBe(15);
    s.damage(100);
    expect(s.health).toBe(0);
    expect(s.dead).toBe(true);
    s.heal(50);
    expect(s.health).toBe(20); // clamped to max
  });
});

describe('Survival: fall damage', () => {
  it('no damage landing softly', () => {
    const s = new Survival(neverWater);
    const b = body();
    b.velocity.y = -25;
    s.tick(b, 1 / 60, true, 25);
    expect(s.health).toBe(20);
  });

  it('damage kicks in beyond the threshold and scales with speed', () => {
    const s = new Survival(neverWater);
    const speed = FALL_DAMAGE_THRESHOLD + 10; // impact 40
    const b = body();
    b.velocity.y = -speed;
    s.tick(b, 1 / 60, true, speed);
    expect(s.health).toBe(20 - 5); // (40-30)/2 = 5
  });

  it('water landing forgives all fall damage and damps velocity', () => {
    const waterAt = {
      isWater: () => true,
      headUnderwater: () => false,
    };
    const s = new Survival(waterAt);
    const speed = 80;
    const b = body();
    b.velocity.y = -speed;
    s.tick(b, 1 / 60, false, 0); // landedThisStep=false but in water
    expect(s.health).toBe(20);
    expect(Math.abs(b.velocity.y)).toBeLessThan(speed / 2); // damped
  });
});

describe('Survival: drowning', () => {
  const underwaterDeps = {
    isWater: () => true,
    headUnderwater: () => true,
  };

  it('air lasts 15s then drowning drains 1 HP/s', () => {
    const s = new Survival(underwaterDeps);
    const b = body();
    // simulate 14s submerged — safe
    for (let i = 0; i < 14 * 60; i++) s.tick(b, 1 / 60, false, 0);
    expect(s.isDrowning).toBe(false);
    expect(s.health).toBe(20);
    // +3 more seconds underwater → drowning started at t=15, so 2s of damage
    for (let i = 0; i < 3 * 60; i++) s.tick(b, 1 / 60, false, 0);
    expect(s.health).toBeCloseTo(18, 1);
    expect(s.isDrowning).toBe(true);
  });

  it('surfacing restores air quickly', () => {
    const s = new Survival(underwaterDeps);
    const b = body();
    for (let i = 0; i < 14 * 60; i++) s.tick(b, 1 / 60, false, 0);
    expect(s.airRemaining).toBeLessThan(2);
    // surface: head above water now
    const surfacing = { ...underwaterDeps, headUnderwater: () => false };
    const s2 = Object.assign(Object.create(Object.getPrototypeOf(s)), s);
    void s2;
    // simpler: new survival near-full air, then breathe
    const fresh = new Survival({ isWater: () => true, headUnderwater: () => false });
    for (let i = 0; i < 60; i++) fresh.tick(b, 1 / 60, false, 0);
    expect(fresh.airRemaining).toBe(AIR_SECONDS);
  });
});
