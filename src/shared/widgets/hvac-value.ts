import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import type { HassEntity, HomeAssistant } from '../../types/home-assistant';
import { defineElement } from '../register';

/** Label plus live entity value; the smallest building block shared by the schematic and summary cards. */
export class HvacValue extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) entity?: HassEntity;
  @property() label = '';

  static styles = css`
    :host {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      line-height: 1.8;
    }
    .label {
      color: var(--secondary-text-color);
    }
    .value {
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
    }
    .missing {
      color: var(--secondary-text-color);
      font-style: italic;
    }
  `;

  protected render() {
    return html`
      <span class="label">${this.label}</span>
      ${this.entity ? html`<span class="value">${this.formatState(this.entity)}</span>` : html`<span class="missing">not found</span>`}
    `;
  }

  private formatState(entity: HassEntity) {
    if (this.hass?.formatEntityState) {
      return this.hass.formatEntityState(entity);
    }
    const unit = entity.attributes.unit_of_measurement;
    return unit ? `${entity.state} ${unit}` : entity.state;
  }
}

defineElement('hvac-value', HvacValue);

declare global {
  interface HTMLElementTagNameMap {
    'hvac-value': HvacValue;
  }
}
