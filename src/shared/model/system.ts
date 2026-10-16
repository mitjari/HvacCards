import type { HassEntity, HomeAssistant } from '../../types/home-assistant';

/**
 * Logical points of the HVAC system the cards know about.
 * DRAFT: the final list comes from the handoff document; these are placeholders to exercise the model.
 */
export const HVAC_POINTS = {
  tank_top_temperature: { domain: 'sensor', label: 'Tank top' },
  tank_middle_temperature: { domain: 'sensor', label: 'Tank middle' },
  tank_bottom_temperature: { domain: 'sensor', label: 'Tank bottom' },
  load_controller_power: { domain: 'sensor', label: 'Smart load controller' },
  oil_heater: { domain: 'switch', label: 'Oil heater' },
} as const;

export type HvacPoint = keyof typeof HVAC_POINTS;

/**
 * Shared configuration accepted by every card in the bundle.
 * Entity IDs default to `<domain>.<prefix>_<point>`; any of them can be overridden in `entities`.
 */
export interface HvacSystemConfig {
  prefix?: string;
  entities?: Partial<Record<HvacPoint, string>>;
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
