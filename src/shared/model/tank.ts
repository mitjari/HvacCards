import type { ResolvedTank } from './system';

type Rgb = readonly [number, number, number];

/**
 * Temperature colour ramp, anchored at fractions of the min_temp..max_temp span so a different range stretches it rather than clipping it.
 * At 20..80 the blue-to-warm crossing sits at 33-38 °C, keeping the 40-60 °C working band in clear orange.
 * Literal colours on purpose: they encode physical meaning and must not flip with the theme.
 */
const RAMP: ReadonlyArray<readonly [number, Rgb]> = [
  [0.0, [18, 80, 143]],
  [0.133, [58, 128, 196]],
  [0.217, [147, 166, 182]],
  [0.3, [235, 164, 92]],
  [0.533, [228, 131, 46]],
  [0.7, [217, 97, 31]],
  [0.85, [203, 67, 38]],
  [1.0, [188, 43, 43]],
];

export const UNAVAILABLE_COLOR = '#888780';

const KWH_PER_LITRE_KELVIN = 1.163e-3;

/** A probe reading at a height in the tank; `temperature` is null when the probe is unavailable. */
export interface ProbeReading {
  position: number;
  temperature: number | null;
}

function hex(rgb: readonly number[]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function rampColor(fraction: number): string {
  const x = Math.max(0, Math.min(1, fraction));
  for (let i = 1; i < RAMP.length; i++) {
    const [bFraction, bRgb] = RAMP[i];
    if (x <= bFraction) {
      const [aFraction, aRgb] = RAMP[i - 1];
      const t = (x - aFraction) / (bFraction - aFraction);
      return hex(aRgb.map((a, j) => a + (bRgb[j] - a) * t));
    }
  }
  return hex(RAMP[RAMP.length - 1][1]);
}

export function temperatureColor(temperature: number | null, tank: ResolvedTank): string {
  if (temperature == null || !Number.isFinite(temperature)) {
    return UNAVAILABLE_COLOR;
  }
  return rampColor((temperature - tank.min_temp) / (tank.max_temp - tank.min_temp));
}

/** Linear interpolation between available probes (sorted by position), clamped to the outermost readings. */
export function temperatureAt(readings: readonly ProbeReading[], position: number): number | null {
  const points = readings.filter((r): r is { position: number; temperature: number } => r.temperature != null);
  if (!points.length) {
    return null;
  }
  if (position <= points[0].position) {
    return points[0].temperature;
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (position <= b.position) {
      return a.temperature + (b.temperature - a.temperature) * ((position - a.position) / (b.position - a.position));
    }
  }
  return points[points.length - 1].temperature;
}

/**
 * Heat above `reference_temp` in kWh.
 * Each probe owns the slice of volume between the midpoints to its neighbours; unavailable probes are skipped, not read as zero.
 */
export function storedHeatKwh(readings: readonly ProbeReading[], tank: ResolvedTank): number | null {
  let kwh = 0;
  let any = false;
  readings.forEach((reading, i) => {
    if (reading.temperature == null) {
      return;
    }
    const lo = i === 0 ? 0 : (readings[i - 1].position + reading.position) / 2;
    const hi = i === readings.length - 1 ? 1 : (reading.position + readings[i + 1].position) / 2;
    kwh += (hi - lo) * tank.volume * KWH_PER_LITRE_KELVIN * Math.max(0, reading.temperature - tank.reference_temp);
    any = true;
  });
  return any ? kwh : null;
}

/** Mean of the available probes mapped onto min_temp..max_temp, as a whole percent. */
export function chargePercent(readings: readonly ProbeReading[], tank: ResolvedTank): number | null {
  const valid = readings.flatMap((r) => (r.temperature == null ? [] : [r.temperature]));
  if (!valid.length) {
    return null;
  }
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  return Math.max(0, Math.min(100, Math.round(((mean - tank.min_temp) / (tank.max_temp - tank.min_temp)) * 100)));
}
