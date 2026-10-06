# AGENTS.md — @linked.cm/messaging

Staged in the **linked-cm** org (npm scope `@linked.cm`) pending René's review; moves to linked-fw (`@_linked/messaging`) only after approval. The `@_linked` npm scope is reserved for linked-fw.

Extracted from `serve-earth/serve-community` (Serve's chat engine) on 2026-09-11. Consumers: Serve (`serve-community`), `@linked.cm/matrix`; Peace Game planned.

## Do not change without a migration

- `linkedPackage('@_linked/messaging', { baseUri: 'https://linked.cm/' })` in `src/package.ts` — it decides the package and component IRIs. The npm name is independent of it.

## Rules

- Shape-agnostic and transport-agnostic: `Messaging` in `src/types.ts` is the seam. The in-memory store is the reference transport; live transports (e.g. `@linked.cm/matrix`) implement the same interface.
- The engine carries host values (thread audience, encryption flag) and never interprets them. Age bands, safeguarding, and who may read what belong to the host.
- Theme through `@_linked/css` variables only; no colours of its own.
- `src/styles.d.ts` is source (CSS-module declarations) even though `.gitignore` ignores other `src/**/*.d.ts`.
- Releases go through changesets (`npx changeset`). Add `.github/workflows/publish.yml` (copied from `linked-cm/calendar`) only when a release is intended: with no pending changesets, that workflow publishes the current version as soon as it lands on `main`.
