import { describe, it, expect } from 'vitest';
import { computeSky, advanceTime } from '../../src/world/daynight';
import { World } from '../../src/world/world';

describe('Day/Night cycle', () => {
  it('midnight is dark with moon up', () => {
    const s = computeSky(0.0);
    expect(s.isNight).toBe(true);
    expect(s.sunIntensity).toBe(0);
    expect(s.moonIntensity).toBeGreaterThan(0);
    expect(s.ambient).toBeLessThan(0.3);
  });

  it('noon is bright with sun at peak', () => {
    const s = computeSky(0.5);
    expect(s.isNight).toBe(false);
    expect(s.sunIntensity).toBeGreaterThan(0.9);
    expect(s.ambient).toBeGreaterThan(0.6);
    expect(s.label).toBe('الظهيرة');
  });

  it('sunrise and sunset have warm intermediate colors', () => {
    const dawn = computeSky(0.26);
    const dusk = computeSky(0.74);
    // dawn/dusk colors differ from both night and pure day
    expect(dawn.skyColor).not.toBe(computeSky(0).skyColor);
    expect(dawn.skyColor).not.toBe(computeSky(0.5).skyColor);
    expect(dusk.skyColor).not.toBe(computeSky(0).skyColor);
  });

  it('sun direction rotates through the sky', () => {
    const morning = computeSky(0.35);
    const evening = computeSky(0.65);
    // x component flips sign across noon
    expect(Math.sign(morning.sunDirection.x)).not.toBe(
      Math.sign(evening.sunDirection.x),
    );
  });

  it('advanceTime wraps at day boundary', () => {
    // 0.99 + 0.2 days = 1.19 → wraps to 0.19
    expect(advanceTime(0.99, 120, 600)).toBeCloseTo(0.19, 5);
    // advancing a full day returns to start
    const t = 0.4;
    expect(advanceTime(t, 600, 600)).toBeCloseTo(t, 10);
  });

  it('all Arabic phase labels are non-empty', () => {
    for (let i = 0; i < 24; i++) {
      expect(computeSky(i / 24).label.length).toBeGreaterThan(0);
    }
  });
});

describe('Biome trees: spruce vs oak variety', () => {
  it('cold biome forests grow spruce-style tall trees', () => {
    const w = new World({ seed: 42 });
    // snow biome confirmed at chunks ~(16,60)-(20,64) for this seed
    let tallTree = false;
    for (let cx = 14; cx <= 22; cx++) {
      for (let cz = 54; cz <= 66; cz++) {
        if (w.biomeAt(cx * 16 + 8, cz * 16 + 8).id !== 5) continue;
        w.ensureChunk(cx, cz);
        const chunk = w.getChunk(cx, cz)!;
        // vertical walk per column (trunks are vertical!)
        for (let lx = 0; lx < 16 && !tallTree; lx++) {
          for (let lz = 0; lz < 16 && !tallTree; lz++) {
            let run = 0;
            let maxRun = 0;
            for (let y = 0; y < 64; y++) {
              if (chunk.get(lx, y, lz) === 6) {
                run++;
                maxRun = Math.max(maxRun, run);
              } else run = 0;
            }
            if (maxRun >= 6) tallTree = true;
          }
        }
      }
    }
    expect(tallTree).toBe(true); // spruce exists in cold biomes
  });
});
