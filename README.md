# Budgeting App

A local-first, zero-based (envelope) budgeting web app (React + TypeScript + Vite).

## Commands

- `npm install` — install dependencies
- `npm run dev` — start the dev server
- `npm test` — run the budget engine tests (no dependencies needed)
- `npm run typecheck` / `npm run build`
- `npm run build:single` — build the whole app into one file, `dist/offline-zerobase-budgeting.html`, that works offline when opened from disk

## Structure

- `src/engine/` — pure budget math (Ready to Assign, Available, goals) and tests
