import type { HassEntity, HomeAssistant } from '../../types/home-assistant';

/**
 * Logical points of the HVAC system the cards know about.
 * Each resolves to `<domain>.<prefix>_<point>` unless the card config overrides it in `entities`.
 */
export const HVAC_POINTS = {
  tank_t1_temperature: { domain: 'sensor', label: 'Tank T1' },
  tank_t2_temperature: { domain: 'sensor', label: 'Tank T2' },
  tank_t3_temperature: { domain: 'sensor', label: 'Tank T3' },
  tank_t4_temperature: { domain: 'sensor', label: 'Tank T4' },
  oil_boiler_running: { domain: 'binary_sensor', label: 'Oil boiler' },
  oil_boiler_power: { domain: 'sensor', label: 'Oil boiler power' },
  electric_heater_power: { domain: 'sensor', label: 'Electric heater power' },
  dhw_pump_running: { domain: 'binary_sensor', label: 'Hot water pump' },
  heating_pump_running: { domain: 'binary_sensor', label: 'Heating pump' },
  heating_power: { domain: 'sensor', label: 'Heating power' },
} as const;

export type HvacPoint = keyof typeof HVAC_POINTS;

/** Temperature probe in the buffer tank; probes are listed top to bottom. */
export interface TankProbe {
  point: HvacPoint;
  label: string;
}

export const TANK_PROBES: readonly TankProbe[] = [
  { point: 'tank_t1_temperature', label: 'T1' },
  { point: 'tank_t2_temperature', label: 'T2' },
  { point: 'tank_t3_temperature', label: 'T3' },
  { point: 'tank_t4_temperature', label: 'T4' },
];

/**
 * A heat source or load attached to the tank.
 * `active` may be a binary state or a numeric reading; `power` is a kW or W sensor.
 */
export interface HvacDevice {
  name: string;
  active: HvacPoint;
  power?: HvacPoint;
}

/** Top loads leave through the riser above the tank; side loads leave at the inlet level, facing the generation inlet. */
export interface HvacLoad extends HvacDevice {
  connection: 'top' | 'side';
}

// Every source joins one manifold into the tank, so adding the CHP later is one more entry here.
export const HEAT_SOURCES: readonly HvacDevice[] = [
  { name: 'Oil boiler', active: 'oil_boiler_running', power: 'oil_boiler_power' },
  { name: 'Electric', active: 'electric_heater_power', power: 'electric_heater_power' },
];

export const HEAT_LOADS: readonly HvacLoad[] = [
  { name: 'Hot water', active: 'dhw_pump_running', connection: 'top' },
  { name: 'Radiators', active: 'heating_pump_running', power: 'heating_power', connection: 'side' },
];

/** Physical tank parameters; positions are fractions of tank height, 0 = top, 1 = bottom. */
export interface TankConfig {
  volume: number;
  min_temp: number;
  max_temp: number;
  /** Temperature counted as zero stored heat; defaults to `min_temp`. */
  reference_temp?: number;
  inlet_position: number;
  /** One per probe in `TANK_PROBES` order. Estimates until measured off the real tank; they weight the stored-heat figure. */
  probe_positions: number[];
}

export type ResolvedTank = Required<TankConfig>;

export const DEFAULT_TANK: TankConfig = {
  volume: 1000,
  min_temp: 20,
  max_temp: 80,
  inlet_position: 0.19,
  probe_positions: [0.07, 0.19, 0.56, 0.93],
};

/**
 * Shared configuration accepted by every card in the bundle.
 * Entity IDs default to `<domain>.<prefix>_<point>`; any of them can be overridden in `entities`.
 */
export interface HvacSystemConfig {
  prefix?: string;
  entities?: Partial<Record<HvacPoint, string>>;
  tank?: Partial<TankConfig>;
}

export const DEFAULT_PREFIX = 'hvac';

export function resolveEntityId(config: HvacSystemConfig, point: HvacPoint): string {
  const override = config.entities?.[point];
  if (override) {
    return override;
  }
  const prefix = config.prefix ?? DEFAULT_PREFIX;
  return `${HVAC_POINTS[point].domain}.${prefix}_${point}`;
}

export function getPoint(hass: HomeAssistant | undefined, config: HvacSystemConfig, point: HvacPoint): HassEntity | undefined {
  return hass?.states[resolveEntityId(config, point)];
}

/** Merges the card's `tank` block over the defaults; throws on values the tank card cannot draw. */
export function resolveTank(config: HvacSystemConfig): ResolvedTank {
  const tank = { ...DEFAULT_TANK, ...config.tank };
  const minTemp = Number(tank.min_temp);
  const maxTemp = Number(tank.max_temp);
  if (!(maxTemp > minTemp)) {
    throw new Error('tank.max_temp must be above tank.min_temp');
  }
  if (!Array.isArray(tank.probe_positions) || tank.probe_positions.length !== TANK_PROBES.length) {
    throw new Error(`tank.probe_positions needs ${TANK_PROBES.length} values, top to bottom`);
  }
  return {
    volume: Number(tank.volume) || DEFAULT_TANK.volume,
    min_temp: minTemp,
    max_temp: maxTemp,
    reference_temp: Number(tank.reference_temp ?? minTemp),
    inlet_position: clamp(Number(tank.inlet_position), 0.05, 0.95),
    probe_positions: tank.probe_positions.map((position) => clamp(Number(position), 0, 1)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
