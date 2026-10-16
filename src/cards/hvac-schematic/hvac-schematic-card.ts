import { LitElement, css, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, LovelaceCard, LovelaceCardConfig } from '../../types/home-assistant';
import { HVAC_POINTS, type HvacPoint, type HvacSystemConfig, getPoint } from '../../shared/model/system';
import { registerCard } from '../../shared/register';
import { sharedStyles } from '../../shared/styles';
import '../../shared/widgets/hvac-value';

export interface HvacSchematicCardConfig extends LovelaceCardConfig, HvacSystemConfig {
  title?: string;
}

/**
 * Full SCADA-style schematic of the HVAC system, meant for a `panel` view on a dedicated dashboard.
 * PLACEHOLDER: lists every known point until the SVG schematic from the mockup is implemented.
 */
export class HvacSchematicCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: HvacSchematicCardConfig;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  static getStubConfig(): Partial<HvacSchematicCardConfig> {
    return { title: 'HVAC' };
  }

  setConfig(config: HvacSchematicCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 12;
  }

  protected render() {
    if (!this.config) {
      return html``;
    }
    const config = this.config;
    return html`
      <ha-card>
        ${config.title ? html`<div class="header">${config.title}</div>` : ''}
        <div class="content">
          ${(Object.keys(HVAC_POINTS) as HvacPoint[]).map(
            (point) => html`<hvac-value .hass=${this.hass} .entity=${getPoint(this.hass, config, point)} .label=${HVAC_POINTS[point].label}></hvac-value>`,
          )}
        </div>
      </ha-card>
    `;
  }
}

registerCard('hvac-schematic-card', HvacSchematicCard, {
  name: 'HVAC Schematic',
  description: 'Full SCADA-style schematic of the HVAC system, for a dedicated panel view.',
});
