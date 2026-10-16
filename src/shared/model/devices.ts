import type { HassEntity, HomeAssistant } from '../../types/home-assistant';
import { type HvacDevice, type HvacSystemConfig, resolveEntityId } from './system';

const ON_STATES = ['on', 'heat', 'heating', 'true', 'running'];

/** A power reading at or above this counts as running (100 W, enough to ignore standby draw). */
const ACTIVE_POWER_KW = 0.1;

/** Net power within this band of zero reads as Balanced. */
const BALANCED_KW = 0.05;

export interface DeviceReading {
  name: string;
  /** Entity to open in more-info when the device is clicked. */
  entityId: string;
  found: boolean;
  active: boolean;
  /** Present only while active and a power figure is available. */
  kw: number | null;
}

export type NetStatus = 'Idle' | 'Charging' | 'Drawing' | 'Balanced' | 'Circulating';

/** Returns the entity unless it is missing, `unavailable` or `unknown`. */
export function usableEntity(hass: HomeAssistant | undefined, entityId: string): HassEntity | undefined {
  const entity = hass?.states[entityId];
  return entity && entity.state !== 'unavailable' && entity.state !== 'unknown' ? entity : undefined;
}

export function numericState(entity: HassEntity | undefined): number | null {
  if (!entity) {
    return null;
  }
  const value = parseFloat(entity.state);
  return Number.isFinite(value) ? value : null;
}

/** Power in kW, converting from W by unit; null for anything that is not a power reading. */
function powerKw(entity: HassEntity | undefined): number | null {
  const value = numericState(entity);
  if (value == null) {
    return null;
  }
  const unit = String(entity?.attributes.unit_of_measurement ?? '').toLowerCase();
  if (unit === 'w') {
    return value / 1000;
  }
  return unit === 'kw' ? value : null;
}

function isActive(entity: HassEntity | undefined): boolean {
  if (!entity) {
    return false;
  }
  const kw = powerKw(entity);
  if (kw != null) {
    return kw >= ACTIVE_POWER_KW;
  }
  const value = numericState(entity);
  if (value != null) {
    return value >= 1;
  }
  return ON_STATES.includes(entity.state.toLowerCase());
}

export function readDevice(hass: HomeAssistant | undefined, config: HvacSystemConfig, device: HvacDevice): DeviceReading {
  const entityId = resolveEntityId(config, device.active);
  const active = isActive(usableEntity(hass, entityId));
  const kw = active && device.power ? powerKw(usableEntity(hass, resolveEntityId(config, device.power))) : null;
  return { name: device.name, entityId, found: Boolean(hass?.states[entityId]), active, kw };
}

/**
 * Sources count positive, loads negative.
 * If any running device has no power figure the status still resolves, but `kw` is null: a partial sum would mislead.
 */
export function netFlow(sources: readonly DeviceReading[], loads: readonly DeviceReading[]): { status: NetStatus; kw: number | null } {
  const activeSources = sources.filter((d) => d.active);
  const activeLoads = loads.filter((d) => d.active);
  if (!activeSources.length && !activeLoads.length) {
    return { status: 'Idle', kw: 0 };
  }
  if ([...activeSources, ...activeLoads].some((d) => d.kw == null)) {
    const status = !activeLoads.length ? 'Charging' : !activeSources.length ? 'Drawing' : 'Circulating';
    return { status, kw: null };
  }
  const kw = activeSources.reduce((sum, d) => sum + Math.abs(d.kw!), 0) - activeLoads.reduce((sum, d) => sum + Math.abs(d.kw!), 0);
  const status = kw > BALANCED_KW ? 'Charging' : kw < -BALANCED_KW ? 'Drawing' : 'Balanced';
  return { status, kw };
}

/** Dash animation period, so a 24 kW burner visibly outruns a 6 kW element. */
export function flowDuration(kw: number): string {
  return `${Math.max(0.5, Math.min(3, 18 / Math.abs(kw))).toFixed(2)}s`;
}
