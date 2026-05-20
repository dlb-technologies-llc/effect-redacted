# effect-redacted

A learning sandbox for [Effect](https://effect.website)'s `Schema.Redacted` — how to thread redacted values across boundaries:

- **HttpApi** — request/response payloads, headers
- **RPC** — caller/callee schemas
- **Cluster** — entity messages, persisted state

Each boundary has its own serialization rules and its own ways to leak. The goal here is to find the sharp edges before they show up in a real system.

## Layout

```
packages/
  frontend/   Astro 6 + React + Tailwind v4 + shadcn
  backend/    Bun.serve (Effect HttpApi to follow)
```

## Develop

```sh
bun install
bun run dev:frontend   # http://localhost:4321
bun run dev:backend    # http://localhost:3001/health
```

## Lint / format

```sh
bun run lint
bun run format
```
