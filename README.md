# HVAC Cards

Home Assistant dashboard cards for the house HVAC system.
One bundle (`hvac-cards.js`) provides every card:

| Card | Type | Purpose |
|------|------|---------|
| HVAC Schematic | `custom:hvac-schematic-card` | Full SCADA-style schematic for a dedicated dashboard with a `panel` view. |
| HVAC Summary | `custom:hvac-summary-card` | Compact status tile for the main dashboard; tap opens the full schematic. |

Both cards are placeholders for now and will be filled in from the design handoff and mockup.

## Installation (HACS)

1. HACS → ⋮ → **Custom repositories** → add this repository with type **Dashboard**.
2. Install **HVAC Cards**; HACS registers `/hacsfiles/hvac-cards/hvac-cards.js` as a dashboard resource.
3. Reload the browser.

## Configuration

Every card accepts the same system configuration.
Entity IDs default to `<domain>.<prefix>_<point>` (e.g. `sensor.hvac_tank_top_temperature`), and any of them can be overridden:

```yaml
type: custom:hvac-summary-card
title: HVAC
prefix: hvac
navigation_path: /dashboard-hvac
entities:
  oil_heater: switch.boiler_oil_heater
```

The list of points lives in `src/shared/model/system.ts`.

### Recommended dashboard setup

- Create a dashboard **HVAC** (URL `dashboard-hvac`) with a single view of type **Panel** containing `custom:hvac-schematic-card`.
- Put `custom:hvac-summary-card` on the main dashboard.

## Development

Lit + TypeScript, bundled by Vite into a single ES module `dist/hvac-cards.js` (HACS allows one file per repo, so every card lives in this bundle).

```
src/index.ts               bundle entry; imports every card module
src/cards/<card>/          one directory per card, registered via src/shared/register.ts
src/shared/widgets/        reusable elements shared by schematic and summary cards
src/shared/model/system.ts logical points and entity-ID resolution
src/types/                 minimal hand-written Home Assistant types
```

Ground rules:

- Logic stays in Home Assistant: overrides, modes and setpoints are HA entities (`switch`, `select`, `number`). Cards only read `hass.states` and call services.
- Never hardcode entity IDs in a card; resolve them through `system.ts`.
- Style with HA theme CSS variables so light and dark themes work.
- Lit decorators use the legacy TS form (`experimentalDecorators`, `useDefineForClassFields: false`).

Requires Node 22 (see `.nvmrc`).

```bash
npm install
npm run build      # typecheck + production bundle in dist/
npm run watch      # rebuild dist/ on every change (unminified, inline sourcemaps)
npm run serve      # serve dist/ on http://<this-machine>:5000 with CORS
```

Without a local Node, run the same scripts through Docker:

```bash
docker run --rm --network host -u "$(id -u):$(id -g)" -e npm_config_cache=/tmp/.npm -v "$PWD":/app -w /app node:22-alpine npm run build
```

To test against a real Home Assistant, run `watch` and `serve` in two terminals and add `http://<this-machine>:5000/hvac-cards.js` as a dashboard resource of type **JavaScript module** (Settings → Dashboards → ⋮ → Resources).
Hard-refresh the browser after each rebuild.
If Home Assistant is opened over HTTPS, the browser blocks an HTTP resource; copy `dist/hvac-cards.js` to `/config/www/` and use `/local/hvac-cards.js` instead.

## Releasing

1. Bump `version` in `package.json`.
2. Create a GitHub release with tag `v<version>`.
3. The release workflow builds the bundle and attaches `hvac-cards.js`; HACS then offers the update.
