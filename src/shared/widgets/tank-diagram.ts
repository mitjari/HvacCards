import { css, html, svg, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { type DeviceReading, flowDuration } from '../model/devices';
import type { ResolvedTank } from '../model/system';
import { type ProbeReading, temperatureAt, temperatureColor } from '../model/tank';

/** Geometry in SVG user units; the viewBox is `W` wide and as tall as the content needs. */
const G = { W: 380, TX: 150, TW: 76, TY: 44, TH: 244, CW: 108, LX: 4, RX: 268, MX: 136, TOP: 22 } as const;

export interface TankProbeView extends ProbeReading {
  entityId: string;
}

export interface TankLoadView extends DeviceReading {
  connection: 'top' | 'side';
}

export interface TankDiagramView {
  tank: ResolvedTank;
  /** Sorted by position, top first. */
  probes: readonly TankProbeView[];
  sources: readonly DeviceReading[];
  loads: readonly TankLoadView[];
  unit: string;
}

interface Leg {
  device: DeviceReading;
  route: string;
  chipY: number;
  side: 'l' | 'r';
  /** Tank height the pipe connects at; its flow takes the tank colour there. */
  at: number;
}

/** Tank colour where the leg connects, shared by its flowing pipe and its active chip outline. */
function legColor(leg: Leg, view: TankDiagramView): string {
  return temperatureColor(temperatureAt(view.probes, leg.at), view.tank);
}

/**
 * Stratified buffer tank with heat sources on a manifold to the left and loads to the right.
 * A template rather than an element so the full schematic can embed the same drawing.
 */
export function tankDiagram(view: TankDiagramView, onSelect: (entityId: string) => void): TemplateResult {
  const { tank, probes } = view;
  const midX = G.TX + G.TW / 2;
  const inletY = G.TY + tank.inlet_position * G.TH;
  const legs: Leg[] = [];
  let bottom = G.TY + G.TH;

  const n = view.sources.length;
  if (n) {
    // The first source lines up with the inlet so its pipe runs straight into the tank; the rest stack below it.
    const first = Math.max(22, inletY);
    const spacing = n > 1 ? Math.min(80, Math.max(48, (G.TY + G.TH - 22 - first) / (n - 1))) : 0;
    view.sources.forEach((device, i) => {
      const y = first + i * spacing;
      legs.push({ device, route: `M${G.LX + G.CW},${y} H${G.MX} V${inletY} H${G.TX}`, chipY: y, side: 'l', at: tank.inlet_position });
      bottom = Math.max(bottom, y + 22);
    });
  }

  let topSlot = G.TOP + 4;
  view.loads.forEach((device) => {
    if (device.connection === 'top') {
      const y = topSlot;
      topSlot += 52;
      legs.push({ device, route: `M${midX},${G.TY} V${y} H${G.RX}`, chipY: y, side: 'r', at: 0 });
    } else {
      const y = Math.max(G.TY + 22, inletY);
      legs.push({ device, route: `M${G.TX + G.TW},${y} H${G.RX}`, chipY: y, side: 'r', at: tank.inlet_position });
      bottom = Math.max(bottom, y + 22);
    }
  });

  const height = bottom + 12;
  const last = probes[probes.length - 1];
  const stops: Array<readonly [number, TankProbeView]> = [[0, probes[0]], ...probes.map((p) => [p.position, p] as const), [1, last]];

  // Clicks on parts open more-info instead of bubbling to the card's own tap action.
  const select = (ev: Event, entityId: string) => {
    ev.stopPropagation();
    onSelect(entityId);
  };

  const chip = (leg: Leg) => {
    const x = leg.side === 'l' ? G.LX : G.RX;
    const d = leg.device;
    const status = !d.found ? '—' : !d.active ? 'off' : d.kw != null ? `${d.kw.toFixed(1)} kW` : 'on';
    return svg`
      <g class="chip" @click=${(ev: Event) => select(ev, d.entityId)}>
        <rect
          x=${x}
          y=${leg.chipY - 22}
          width=${G.CW}
          height="44"
          rx="8"
          class=${classMap({ chipbg: true, on: d.active })}
          style=${d.active ? `stroke: ${legColor(leg, view)}` : ''}
        ></rect>
        <text x=${x + 12} y=${leg.chipY - 4} class="cn">${d.name}</text>
        <text x=${x + 12} y=${leg.chipY + 12} class="cs">${status}</text>
      </g>
    `;
  };

  const reading = (probe: TankProbeView) => {
    const y = Math.max(G.TY + 12, Math.min(G.TY + G.TH - 12, G.TY + probe.position * G.TH));
    const value = probe.temperature == null ? '—' : `${Math.round(probe.temperature)} ${view.unit}`;
    return svg`
      <g class="reading" @click=${(ev: Event) => select(ev, probe.entityId)}>
        <rect x=${G.TX + 6} y=${y - 10} width=${G.TW - 12} height="20" fill="transparent"></rect>
        <text x=${midX} y=${y + 4} class="pv">${value}</text>
      </g>
    `;
  };

  return html`
    <svg class="tank-diagram" viewBox="0 0 ${G.W} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="strat" gradientUnits="userSpaceOnUse" x1="0" y1=${G.TY} x2="0" y2=${G.TY + G.TH}>
          ${stops.map(([offset, probe]) => svg`<stop offset=${offset} stop-color=${temperatureColor(probe.temperature, tank)}></stop>`)}
        </linearGradient>
      </defs>
      <rect x=${G.TX} y=${G.TY} width=${G.TW} height=${G.TH} rx="18" fill="url(#strat)" class="water"></rect>
      ${legs.map((leg) => svg`<path class="pipe" d=${leg.route}></path>`)}
      ${legs.map(
        (leg) => svg`
          <path
            class=${classMap({ flow: true, on: leg.device.active })}
            d=${leg.route}
            stroke=${legColor(leg, view)}
            style=${leg.device.kw != null ? `animation-duration: ${flowDuration(leg.device.kw)}` : ''}
          ></path>
        `,
      )}
      <rect x=${G.TX} y=${G.TY} width=${G.TW} height=${G.TH} rx="18" fill="none" stroke="var(--divider-color)" stroke-width="1.5"></rect>
      ${probes.map(reading)} ${legs.map(chip)}
    </svg>
  `;
}

export const tankDiagramStyles = css`
  /* One tint strength for every temperature colour: tank, flowing pipes and active chip outlines. */
  .tank-diagram {
    --hvac-tint-opacity: 0.35;
    display: block;
    width: 100%;
    height: auto;
  }
  /* A light tint rather than solid colour, so the tank sits quietly among other cards. */
  .tank-diagram .water {
    fill-opacity: var(--hvac-tint-opacity);
  }
  .tank-diagram .pv {
    font-size: 12px;
    fill: var(--primary-text-color);
    text-anchor: middle;
  }
  .tank-diagram .cn {
    font-size: 11px;
    fill: var(--primary-text-color);
  }
  .tank-diagram .cs {
    font-size: 11px;
    fill: var(--secondary-text-color);
  }
  .tank-diagram .chipbg {
    fill: var(--secondary-background-color);
    stroke: var(--divider-color);
    transition: stroke 0.3s;
  }
  .tank-diagram .chipbg.on {
    stroke-width: 2;
    stroke-opacity: var(--hvac-tint-opacity);
  }
  .tank-diagram .chip,
  .tank-diagram .reading {
    cursor: pointer;
  }
  /* Idle pipes stay grey; temperature shows on a pipe only where water moves. */
  .tank-diagram .pipe {
    stroke: var(--divider-color);
    stroke-width: 3;
    fill: none;
    stroke-opacity: 0.4;
    stroke-linejoin: round;
  }
  .tank-diagram .flow {
    stroke-width: 3;
    fill: none;
    stroke-dasharray: 7 9;
    stroke-linejoin: round;
    stroke-opacity: var(--hvac-tint-opacity);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .tank-diagram .flow.on {
    opacity: 1;
    animation: hvac-flow-dash 1s linear infinite;
  }
  @keyframes hvac-flow-dash {
    to {
      stroke-dashoffset: -16;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tank-diagram .flow.on {
      animation: none;
    }
  }
`;
