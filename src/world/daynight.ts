/**
 * DayNight — time-of-day cycle driving sun/moon light, sky color, fog.
 *
 * t = 0..1 where 0.0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset.
 * Pure math module — fully unit-testable, renderer consumes the outputs.
 */

export interface SkyState {
  sunIntensity: number; // 0..1
  moonIntensity: number;
  sunDirection: { x: number; y: number; z: number };
  skyColor: number; // hex
  fogNear: number;
  fogFar: number;
  ambient: number; // 0..1
  isNight: boolean;
  label: string; // Arabic phase name
}

const DAY_LENGTH_TICKS = 1; // normalized input

export function computeSky(t: number): SkyState {
  // normalize
  const tt = ((t % DAY_LENGTH_TICKS) + DAY_LENGTH_TICKS) % DAY_LENGTH_TICKS;

  // Sun angle: sunrise at .25 → noon .5 → sunset .75
  const sunAngle = (tt - 0.25) * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle); // -1..1 (negative at night)
  const sunIntensity = Math.max(0, Math.min(1, sunHeight * 1.4));
  const moonIntensity = Math.max(0, Math.min(1, -sunHeight * 1.2));

  const sunDir = {
    x: Math.cos(sunAngle) * 0.6,
    y: Math.max(-0.2, sunHeight),
    z: 0.35,
  };

  // Sky color keyframes (hex): night navy → dawn orange → day sky-blue → dusk purple
  const NIGHT = 0x0a0e1e;
  const DAWN = 0xe8956b;
  const DAY = 0x87ceeb;
  const DUSK = 0x7a4a6b;

  function lerpColor(a: number, b: number, k: number): number {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * k);
    const g = Math.round(ag + (bg - ag) * k);
    const bl = Math.round(ab + (bb - ab) * k);
    return (r << 16) | (g << 8) | bl;
  }

  let skyColor: number;
  let label: string;
  // progress within a transition window, smoothed
  function windowK(tt: number, start: number, end: number): number {
    const k = Math.max(0, Math.min(1, (tt - start) / (end - start)));
    return k * k * (3 - 2 * k);
  }
  if (tt < 0.22) {
    skyColor = NIGHT;
    label = 'منتصف الليل';
  } else if (tt < 0.3) {
    skyColor = lerpColor(NIGHT, DAWN, windowK(tt, 0.22, 0.3));
    label = 'الفجر';
  } else if (tt < 0.45) {
    skyColor = lerpColor(DAWN, DAY, windowK(tt, 0.3, 0.45));
    label = 'الصباح';
  } else if (tt < 0.55) {
    skyColor = DAY;
    label = 'الظهيرة';
  } else if (tt < 0.7) {
    skyColor = lerpColor(DAY, DUSK, windowK(tt, 0.55, 0.7));
    label = 'العصر';
  } else if (tt < 0.78) {
    skyColor = lerpColor(DUSK, NIGHT, windowK(tt, 0.7, 0.78));
    label = 'الغروب';
  } else {
    skyColor = NIGHT;
    label = 'الليل';
  }

  const ambient = 0.18 + sunIntensity * 0.55;
  const fogNear = 40 + sunIntensity * 30;
  const fogFar = 110 + sunIntensity * 60;

  return {
    sunIntensity,
    moonIntensity,
    sunDirection: sunDir,
    skyColor,
    fogNear,
    fogFar,
    ambient,
    isNight: tt < 0.24 || tt > 0.76,
    label,
  };
}

/** Advance a 0..1 clock by real seconds (full day = 10 minutes default). */
export function advanceTime(t: number, dtSeconds: number, dayLengthSec = 600): number {
  return (t + dtSeconds / dayLengthSec) % 1;
}
