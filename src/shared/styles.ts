import { css } from 'lit';

// Shared look for all cards; built on Home Assistant theme variables so light/dark themes just work.
export const sharedStyles = css`
  :host {
    --hvac-hot: var(--error-color, #db4437);
    --hvac-warm: var(--warning-color, #ffa600);
    --hvac-cold: var(--info-color, #039be5);
    --hvac-active: var(--success-color, #43a047);
    --hvac-muted: var(--secondary-text-color);
  }

  .header {
    padding: 12px 16px 0;
    font-size: 1.1em;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .content {
    padding: 12px 16px 16px;
  }

  .unavailable {
    color: var(--hvac-muted);
    font-style: italic;
  }
`;
