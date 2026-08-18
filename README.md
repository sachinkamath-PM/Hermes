# Hermes

Hermes is an interactive travel atlas, journal, and trip planner from BuildQuick. It gives travellers one place to record where they have been, explore countries and regions, plan future trips, and turn a completed itinerary into a lasting travel history.

The current release is a browser-based personal experience. Travel data stays in the browser on the device where it was entered; there is no account, cloud sync, booking integration, or shared itinerary service yet.

## What Hermes does

- Explore an interactive world map with country, state or province, and city detail.
- Mark countries and cities as visited.
- Search for countries, regions, cities, or a custom place.
- Keep a travel journal with visited, planned, and dreaming entries.
- Create multi-stop trips with dates, budget, traveller count, itinerary items, and checklists.
- Complete a trip to add its destinations to the atlas and journal.
- Track exploration progress through levels, XP, ranks, and achievements.
- Review an Explorer Passport with travel depth, story coverage, personal rankings, and upcoming journeys.
- Set personal country and place milestones with a target date.
- Share a concise journey summary using the device share sheet or clipboard.
- Download and restore a private JSON backup of countries, places, journal entries, trips, and goals.
- Preserve the atlas, journal, and trips locally between browser sessions.

## Typical user workflows

### Record a place

1. Search for or select a country on the world map.
2. Open its regional map and choose a city or region.
3. Mark the location as visited, or add a custom place.
4. Open **Travel journal** to add the date, rating, status, and a note.

### Plan and complete a trip

1. Open **Trip planner** and create a trip.
2. Add one or more destinations, travel dates, budget, and traveller count.
3. Build the daily itinerary and pre-travel checklist.
4. Mark the trip complete after travelling.
5. Hermes adds the trip destinations to the visited atlas and creates journal entries.

### Review progress

Use the atlas summary, Explorer Passport, and achievement panel to see visited-country coverage, saved cities, travel depth, story coverage, explorer XP, current level, and the next milestones.

## Product boundaries

Hermes is currently a personal travel organiser, not a booking or navigation service.

- No flights, hotels, payments, live prices, maps navigation, or visa advice.
- No sign-in, automatic multi-device sync, or collaboration. Manual JSON backup and restore are available from the Explorer Passport.
- Browser data can be lost if site storage is cleared or a different browser or device is used.
- Trip budgets are notes; Hermes does not calculate spend or exchange rates.
- The included geographic data is intended for product exploration and may not represent every boundary or naming convention.

## Technology

- React 19 and TypeScript
- [vinext](https://github.com/cloudflare/vinext) and Vite
- Cloudflare Worker-compatible server output
- D3 Geo, TopoJSON, and `world-atlas` for map rendering
- Local JSON geographic datasets for country and administrative-region detail
- Browser `localStorage` for the current personal workspace
- OpenAI Sites configuration in `.openai/hosting.json`

Hermes currently declares no D1 database or R2 bucket. The Drizzle files and `examples/d1/` directory are extension points, not part of the live product data flow.

## Project structure

```text
app/
  HermesApp.tsx       Main atlas, journal, achievements, and trip planner
  country-data.json   Country metadata and representative cities
  layout.tsx          Site metadata and social sharing configuration
  page.tsx            Application entry page
public/admin1/        Administrative-region GeoJSON by country code
db/                   Optional Drizzle database foundation
examples/d1/          Reference D1 example; not used by Hermes today
tests/                Rendered-output and product-contract tests
worker/               Cloudflare Worker entry point
.openai/hosting.json  Sites project and optional resource bindings
vite.config.ts        vinext, Sites, and Cloudflare build configuration
```

## Run locally

### Requirements

- Node.js 22.13 or newer
- pnpm through Corepack

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by the development server.

## Quality checks

```bash
pnpm lint
pnpm test
```

`pnpm test` builds the Worker output and verifies the server-rendered Hermes shell, metadata, atlas datasets, local persistence contract, journal, achievements, and trip-planning surface.

For a production build without the test suite:

```bash
pnpm build
```

## Data and privacy

Hermes stores visited countries, visited cities, journal entries, trips, and travel goals under the `hermes_travel_atlas_v1` browser-storage key. The application does not currently send that travel history to an application database. Users can download or restore a JSON backup from the Explorer Passport.

Do not treat browser storage as a backup. Download the atlas backup periodically. Restoring a backup replaces the atlas on the current device after confirmation. Before adding accounts or cloud sync, define deletion, retention, authentication, and recovery workflows.

## Deployment

The repository is configured for OpenAI Sites and Cloudflare Worker-compatible output. `.openai/hosting.json` identifies the Sites project and declares its managed resources. Keep that file, `vite.config.ts`, and `worker/index.ts` aligned when adding a database, file storage, or other hosted capability.

Useful commands:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start local development |
| `pnpm build` | Create the deployment build |
| `pnpm start` | Run the built application locally |
| `pnpm lint` | Check TypeScript and accessibility-oriented lint rules |
| `pnpm test` | Build and run product-contract tests |
| `pnpm db:generate` | Generate Drizzle migrations after a schema change |

## Current status

Hermes is an MVP suitable for exploring the travel-tracking and planning experience. Account-backed persistence, portability, collaboration, travel-service integrations, and production data recovery remain future work.
