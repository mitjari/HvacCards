# HVAC Cards

Home Assistant dashboard cards for the house HVAC system.
One bundle (`hvac-cards.js`) provides every card:

| Card | Type | Purpose |
|------|------|---------|
| HVAC Schematic | `custom:hvac-schematic-card` | Full SCADA-style schematic for a dedicated dashboard with a `panel` view. |
| HVAC Buffer Tank | `custom:hvac-tank-card` | Stratified buffer tank with heat sources, loads and flow animation for the main dashboard; tap opens the full schematic. |

The schematic card is still a placeholder.

## Installation (HACS)

1. HACS → ⋮ → **Custom repositories** → add this repository with type **Dashboard**.
2. Install **HVAC Cards**; HACS registers `/hacsfiles/hvac-cards/hvac-cards.js` as a dashboard resource.
3. Reload the browser.

## Configuration

Every card accepts the same system configuration.
Entity IDs default to `<domain>.<prefix>_<point>` (e.g. `sensor.hvac_tank_top_temperature`), and any of them can be overridden:

```yaml
type: custom:hvac-tank-card
name: Buffer tank
prefix: hvac
navigation_path: /dashboard-hvac
show_energy: true
entities:
  oil_boiler_running: binary_sensor.burner_running
tank:
  volume: 1000
  min_temp: 20
  max_temp: 80
  reference_temp: 20               # zero point for stored heat; defaults to min_temp
  inlet_position: 0.19             # 0 = top, 1 = bottom
  probe_positions: [0.07, 0.19, 0.56, 0.93]   # T1..T4, top to bottom
```

The list of points, the tank probes and the heat sources and loads live in `src/shared/model/system.ts`.
Device power sensors may report W or kW; the card does not derive power from flow and ΔT, so publish a power sensor from Home Assistant if a device only has those.

### Buffer tank card

- The tank fill interpolates between the probes; the colour ramp is fixed (not themed) because it encodes temperature.
- Pipes animate while their device runs, faster for more power, and take the tank colour where they connect; idle pipes are grey.
- Net power sums running sources minus running loads; if any running device has no power figure the value shows an em dash.
- Stored heat weights each probe by the slice of tank around it, so measure the real probe heights before trusting the number.
- The generation inlet and the radiator takeoff face each other at the same level, so while the burner fires T2 tracks boiler flow temperature rather than tank temperature. That is real behaviour, not a display bug.
- Tapping a probe or device opens its more-info dialog; tapping anywhere else navigates to `navigation_path`.

### Recommended dashboard setup

- Create a dashboard **HVAC** (URL `dashboard-hvac`) with a single view of type **Panel** containing `custom:hvac-schematic-card`.
- Put `custom:hvac-tank-card` on the main dashboard.

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
