# effect-redacted

A learning sandbox for [Effect v4](https://effect.website)'s `Schema.Redacted` — how to thread redacted values across the **HttpApi** boundary, with **RPC** and **Cluster** explorations to follow.

Built around a specific question raised in the Effect community:

> *How should I handle Redacted attributes on a response schema with HttpApi? Schema.RedactedFromValue does not support encoding to a string.*

This repo is the answer, in code.

## The investigation

`Schema.Redacted` and `Schema.RedactedFromValue` are **encode-forbidden by design** (`Getter.forbidden` on their JSON codecs — see `~/.claude/effect-smol/packages/effect/src/Schema.ts:7497-7644`). That means a `Redacted` field placed in either an HTTP request payload or a response success schema breaks the encoder on whichever side has to produce wire bytes — the **client** for requests, the **server** for responses.

The repo demonstrates this concretely with four endpoints on a fake investment-firm intake form, plus a backend test suite that pins the exact failure messages.

| Endpoint | Wire shape | Outcome | Lesson |
|---|---|---|---|
| `POST /intake` | Plain branded strings (`Email`, `Phone`, `NetWorth`, …) | Works. Server wraps fields in `Redacted` inside `IntakeService`; spans/logs render as `<redacted:label>`. | **The pattern.** Wire = plain validated strings; `Redacted` wrapping is a server-side responsibility. |
| `POST /intake-echo-redacted` | `Schema.RedactedFromValue(NetWorth)` on payload | A typed `HttpApiClient` cannot encode the payload — `Cannot encode Redacted`. A raw curl reaches the handler (decode is permitted) but the handler returns a documented `IntakeProcessingError`. | **Request-side anti-pattern.** Don't put `Redacted` on the wire; the typed client breaks. |
| `POST /intake-redacted-response` | Plain payload, but `Schema.Redacted(NetWorth)` on the success body | Server-side encoder fails — `Cannot serialize Redacted with label: "netWorth"`. HttpApi returns 400 with the cause attached to the span. | **Response-side anti-pattern.** This is the literal answer to the question above: `Redacted` cannot be a response body field. |
| `POST /intake-masked-response` | Plain payload, `MaskedEmail` (a branded string like `a***@example.com`) in the response | Works. Server hand-masks via `maskEmail(...)` and returns a plain string. | **Working alternative.** If you must echo something sensitive-looking in a response, do the masking server-side and put the **masked string** on the wire — not a `Redacted`. |

Telemetry is wired through `@effect/opentelemetry` + `ConsoleSpanExporter`. Every span's `attributes` object renders `Redacted` values as `<redacted:label>` automatically (because `Redacted.toString()` returns that string and OTel calls `String()` on non-primitive attribute values). The exporter dump on stdout is the eyeball-test that nothing leaks.

The source of truth lives in [`packages/shared/src/http/payloads.ts`](packages/shared/src/http/payloads.ts) and [`packages/shared/src/http/api.ts`](packages/shared/src/http/api.ts). The encode-failure assertions live in [`packages/backend/test/http/redacted-encode-failure.test.ts`](packages/backend/test/http/redacted-encode-failure.test.ts) — if a future Effect release silently changes the encoder behavior, that test fails first.

## Layout

```
packages/
  shared/     Effect v4 schemas + HttpApi definitions (source of truth)
  backend/    Effect HttpApi server on @effect/platform-bun, with IntakeService,
              OpenTelemetry NodeSdk + ConsoleSpanExporter, tagged errors
  frontend/   Astro 6 + React 19 + Tailwind v4 + shadcn intake form, wired via
              @effect/atom-react and AtomHttpApi.Service
```

## Develop

The backend persists submissions to Postgres. You need a running database with `DATABASE_URL` set in the environment — and docker, if you want to run the integration tests.

```sh
# 1. Start a local Postgres (or use any other; just set DATABASE_URL)
docker run --rm -d --name dev-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine

# 2. Install + run
bun install
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
bun run dev:backend     # http://localhost:3001 — migrations auto-run on boot
bun run dev:frontend    # http://localhost:4321

# Lint / format
bun run lint
bun run format

# Tests
bun --filter @effect-redacted/backend test:unit          # no docker required
bun --filter @effect-redacted/backend test:integration   # spins testcontainer (needs docker)
bun --filter @effect-redacted/backend test               # runs both
```

`DATABASE_URL` is consumed via `Config.redacted("DATABASE_URL")`; if unset, the backend fails to start with a `ConfigError`. The migration in `src/migrations/` runs on every layer build, so a fresh Postgres comes up to schema automatically.

## Smoke the endpoints

```sh
# 1. Working — returns {status:"received", referenceId:"ref_..."}
curl -sX POST :3001/intake -H 'content-type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","phone":"2025551234","netWorth":15000000}'

# 4. Working alternative — returns {referenceId:"ref_...", email:"a**@example.com"}
curl -sX POST :3001/intake-masked-response -H 'content-type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","phone":"2025551234","netWorth":15000000}'

# 3. Response-side anti-pattern — HTTP 400; span carries "Cannot serialize Redacted"
curl -sX POST :3001/intake-redacted-response -H 'content-type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","phone":"2025551234","netWorth":15000000}'
```

(`/intake-echo-redacted` is reachable from raw HTTP but the failure mode it documents — typed client cannot encode — is exercised by the backend test suite, which is the canonical demonstration.)

## Chain of custody

The network boundary is only one stretch. `Redacted` is an **in-process** wrapper — it lives entirely on the server side of the wire. The same rule applies regardless of transport (HTTP, RPC, Cluster messages): plain validated values cross the wire; `Redacted.make(...)` wraps them on receipt; `Redacted.value(...)` unwraps at exactly one place per sensitive field — the audit boundary.

In this repo, that audit boundary is the SQL parameter binding inside `packages/backend/src/db/ApplicantRepo.ts`:

```ts
// The ONLY Redacted.value call site in the codebase. Grep it.
yield* sql`INSERT INTO applicants (..., net_worth) VALUES (..., ${Redacted.value(input.netWorth)})`
```

The integration test in `packages/backend/test/db/ApplicantRepo.test.ts` uses `@testcontainers/postgresql` to spin a real ephemeral Postgres, run the migration, write a row, and assert that the persisted value round-trips. To run it: `docker ps` must work, then `bun --filter @effect-redacted/backend test:integration`.

## Other layers (not in scope here)

- **TLS** protects bytes between client and server. Different threat, different tool.
- **Encryption at rest** (`pgcrypto`, KMS) protects bytes once they're on disk. Different threat, different tool.

The three layers — TLS, `Redacted` + `Redacted.value`, encryption-at-rest — compose. None subsumes another.
