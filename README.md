# Budgeting App

A local-first, zero-based (envelope) budgeting web app (React + TypeScript + Vite). See the design document for scope.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start the dev server
- `npm test` — run the budget engine tests (no dependencies needed)
- `npm run typecheck` / `npm run build`

## Structure

- `src/engine/` — pure budget math (Ready to Assign, Available, goals) and tests
- Planned: `src/db/` (Dexie storage), `src/store/`, `src/features/`
