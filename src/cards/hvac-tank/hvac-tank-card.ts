import { LitElement, css, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, LovelaceCard, LovelaceCardConfig } from '../../types/home-assistant';
import { netFlow, numericState, readDevice, usableEntity } from '../../shared/model/devices';
import { HEAT_LOADS, HEAT_SOURCES, type HvacSystemConfig, type ResolvedTank, TANK_PROBES, resolveEntityId, resolveTank } from '../../shared/model/system';
import { chargePercent, storedHeatKwh } from '../../shared/model/tank';
import { registerCard } from '../../shared/register';
import { sharedStyles } from '../../shared/styles';
import { type TankProbeView, tankDiagram, tankDiagramStyles } from '../../shared/widgets/tank-diagram';

export interface HvacTankCardConfig extends LovelaceCardConfig, HvacSystemConfig {
  show_energy?: boolean;
  /** Where a tap on the card leads; normally the dedicated HVAC dashboard. */
  navigation_path?: string;
}

const DEFAULT_NAVIGATION_PATH = '/dashboard-hvac';

/**
 * Buffer tank with stratification gradient, heat sources, loads and flow animation; the compact card for the main dashboard.
 * Tapping a probe or device opens its more-info dialog, tapping anywhere else opens the full schematic dashboard.
 */
export class HvacTankCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: HvacTankCardConfig;
  private tank?: ResolvedTank;

  static styles = [
    sharedStyles,
    tankDiagramStyles,
    css`
      ha-card {
        padding: 16px;
        cursor: pointer;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 8px;
      }
      .metric {
        background: var(--secondary-background-color);
        border-radius: 8px;
        padding: 10px 12px;
      }
      .metric-label {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .metric-value {
        font-size: 22px;
        font-weight: 500;
        color: var(--primary-text-color);
        font-variant-numeric: tabular-nums;
      }
      .bar-row {
        display: flex;
        justify-content: space-between;
        margin: 12px 0 5px;
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .track {
        height: 6px;
        border-radius: 3px;
        background: var(--secondary-background-color);
        overflow: hidden;
      }
      .fill {
        height: 100%;
        background: var(--primary-color);
        transition: width 0.6s ease;
      }
    `,
  ];

  static getStubConfig(): Partial<HvacTankCardConfig> {
    return { navigation_path: DEFAULT_NAVIGATION_PATH };
  }

  setConfig(config: HvacTankCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this.tank = resolveTank(config);
    this.config = config;
  }

  getCardSize(): number {
    return 7;
  }

  // Sizing hint for sections views: full section width like the power flow card, height follows the content.
  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  protected render() {
    if (!this.config || !this.tank) {
      return html``;
    }
    const config = this.config;
    const tank = this.tank;

    const probes: TankProbeView[] = TANK_PROBES.map((probe, i) => {
      const entityId = resolveEntityId(config, probe.point);
      return { label: probe.label, entityId, position: tank.probe_positions[i], temperature: numericState(usableEntity(this.hass, entityId)) };
    }).sort((a, b) => a.position - b.position);
    const unit = this.hass?.states[probes[0].entityId]?.attributes.unit_of_measurement ?? '°C';
    const sources = HEAT_SOURCES.map((device) => readDevice(this.hass, config, device));
    const loads = HEAT_LOADS.map((device) => ({ ...readDevice(this.hass, config, device), connection: device.connection }));

    const net = netFlow(sources, loads);
    const stored = storedHeatKwh(probes, tank);
    const charge = chargePercent(probes, tank);

    return html`
      <ha-card @click=${this.navigate}>
        ${tankDiagram({ tank, probes, sources, loads, unit }, (entityId) => this.moreInfo(entityId))}
        <div class="grid">
          <div class="metric">
            <div class="metric-label">${net.status}</div>
            <div class="metric-value">${formatNet(net.status, net.kw)}</div>
          </div>
          ${config.show_energy === false
            ? ''
            : html`
                <div class="metric">
                  <div class="metric-label">Stored heat</div>
                  <div class="metric-value">${stored == null ? '—' : `${stored.toFixed(1)} kWh`}</div>
                </div>
              `}
        </div>
        <div class="bar-row">
          <span>Charge</span>
          <span>${charge == null ? '—' : `${charge} %`}</span>
        </div>
        <div class="track"><div class="fill" style="width: ${charge ?? 0}%"></div></div>
      </ha-card>
    `;
  }

  private moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId } }));
  }

  // Same mechanism Home Assistant's own `tap_action: navigate` uses.
  private navigate(): void {
    const path = this.config?.navigation_path ?? DEFAULT_NAVIGATION_PATH;
    history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }
}

function formatNet(status: string, kw: number | null): string {
  if (status === 'Idle') {
    return '0 kW';
  }
  if (kw == null) {
    return '—';
  }
  const sign = status === 'Charging' ? '+' : status === 'Drawing' ? '−' : '';
  return `${sign}${Math.abs(kw).toFixed(1)} kW`;
}

registerCard('hvac-tank-card', HvacTankCard, {
  name: 'HVAC Buffer Tank',
  description: 'Stratified buffer tank with heat sources, loads and flow animation; tap to open the full schematic.',
});
