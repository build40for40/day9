# Nerds of Fashion (Day 9)

Day 9 of 40 for 40, built live on Twitch on Thursday 12 November 2026. The problem is "Deciding what to wear", from Samira. It became Nerds of Fashion, sabermetrics for fashion: a hundred years of trends, comebacks, shapes and colours. Work is tracked on the Superthread `day9` board and the "Day 9" page.

- **Form factor:** data visualisation.
- **Served at:** `build40for40.com/nerds-of-fashion/`, by this repo's own Worker. It was built inside the site repo and moved here afterwards.

Shared 40 for 40 context lives in `../AGENTS.md`.

## The problem

i want a clueless wardrobe app that tells me what to wear from my cupboard.

## How it fits together

- **The app** is Vue on Vite, with no router or framework on top. `index.html` is the page, `src/main.ts` mounts `src/NerdsApp.vue`, and the app keeps its screen in the URL's query string. It builds for `/nerds-of-fashion/`, into `dist/nerds-of-fashion/`.
- **The data** is static: `public/fashion.json` (the dataset), `public/forecast.json` (the comeback model) and the globe files. `datasets/fashion/` builds them, see its README. After the dataset changes, run `npm run trend-index` to rebuild `src/intent/trend-index.json`.
- **The Worker** in `worker/` only runs for `/nerds-of-fashion/api/*`. `intent` turns a search into a view (Jev when `TYPESAFE_API_KEY` is set, keywords otherwise) and `draw` asks Claude for a chart spec. Everything else is static assets.
- **Styling** is Tailwind only. The `nof-*` colours and fonts are tokens in `src/style.css`.

## Development

- `npm run dev` serves the app at `http://localhost:5173/nerds-of-fashion/` and proxies the API to `npm run dev:api` on port 8787.
- `npm test` runs the app and Worker tests.
- Run wrangler as `npm run wrangler -- <args>`, never `npx wrangler`, so it uses the `40for40` profile.
- Secrets for local runs go in `.dev.vars` (see `.dev.vars.example`). In production they're Worker secrets: `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY` and `PUBLIC_POSTHOG_PROJECT_TOKEN`.

## Deploys

CI tests and builds every PR, uploads a preview and comments its link. Merging to `main` deploys. Never deploy by hand.
