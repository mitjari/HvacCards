import { LitElement, css, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, LovelaceCard, LovelaceCardConfig } from '../../types/home-assistant';
import { HVAC_POINTS, type HvacSystemConfig, getPoint } from '../../shared/model/system';
import { registerCard } from '../../shared/register';
import { sharedStyles } from '../../shared/styles';
import '../../shared/widgets/hvac-value';

export interface HvacSummaryCardConfig extends LovelaceCardConfig, HvacSystemConfig {
  title?: string;
  /** Where a tap leads; normally the dedicated HVAC dashboard. */
  navigation_path?: string;
}

const DEFAULT_NAVIGATION_PATH = '/dashboard-hvac';

/**
 * Compact HVAC status tile for the main dashboard; tapping it opens the full schematic dashboard.
 * PLACEHOLDER: shows a few key points until the design from the mockup is implemented.
 */
export class HvacSummaryCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: HvacSummaryCardConfig;

  static styles = [
    sharedStyles,
    css`
      ha-card {
        cursor: pointer;
      }
    `,
  ];

  static getStubConfig(): Partial<HvacSummaryCardConfig> {
    return { title: 'HVAC', navigation_path: DEFAULT_NAVIGATION_PATH };
  }

  setConfig(config: HvacSummaryCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  // Sizing hint for sections views.
  getGridOptions() {
    return { columns: 6, rows: 2, min_columns: 3, min_rows: 2 };
  }

  protected render() {
    if (!this.config) {
      return html``;
    }
    const config = this.config;
    return html`
      <ha-card @click=${this.navigate}>
        ${config.title ? html`<div class="header">${config.title}</div>` : ''}
        <div class="content">
          <hvac-value .hass=${this.hass} .entity=${getPoint(this.hass, config, 'tank_top_temperature')} .label=${HVAC_POINTS.tank_top_temperature.label}></hvac-value>
          <hvac-value .hass=${this.hass} .entity=${getPoint(this.hass, config, 'oil_heater')} .label=${HVAC_POINTS.oil_heater.label}></hvac-value>
        </div>
      </ha-card>
    `;
  }

  // Same mechanism Home Assistant's own `tap_action: navigate` uses.
  private navigate(): void {
    const path = this.config?.navigation_path ?? DEFAULT_NAVIGATION_PATH;
    history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }
}

registerCard('hvac-summary-card', HvacSummaryCard, {
  name: 'HVAC Summary',
  description: 'Compact HVAC status for the main dashboard; tap to open the full schematic.',
});
