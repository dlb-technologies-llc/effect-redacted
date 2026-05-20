# effect-redacted

> **Status: complete.** This repo answers a specific question about Effect's `Schema.Redacted` and stops there. The two tests in `packages/backend/test/` pin the behavior; CI runs them on every push. Open and read; clone and run; it isn't going anywhere.

Built around a question raised in the Effect community:

> *How should I handle Redacted attributes on a response schema with HttpApi? `Schema.RedactedFromValue` does not support encoding to a string.*

## The short answer

You don't put `Redacted` on the wire. `Schema.Redacted` and `Schema.RedactedFromValue` are **encode-forbidden by design** — putting either in a request payload schema or a response success schema breaks the encoder on whichever side has to produce wire bytes. The wire holds plain validated values; the server wraps them in `Redacted` immediately after decode, and from that point on the wrapper renders as `<redacted:label>` everywhere — logs, spans, traces, error reports. `Redacted.value(...)` is the explicit, grep-able escape hatch — call it sparingly, at the boundaries where the raw value genuinely needs to leave the safety rail (in this repo: the SQL parameter bind that persists the applicant).

## The four endpoints

A fake investment-firm intake form (Astro + React frontend, Effect HttpApi backend, Postgres) with four endpoints that exercise the boundary:

| Endpoint | Wire shape | Outcome | Lesson |
|---|---|---|---|
| `POST /intake` | Plain branded strings (`Email`, `Phone`, `NetWorth`, …) | Works. Server wraps `netWorth` in `Redacted` inside `IntakeService`; spans/logs render as `<redacted:netWorth>`. | **The pattern.** Wire = plain validated strings; `Redacted` wrapping is a server-side responsibility. |
| `POST /intake-echo-redacted` | `Schema.RedactedFromValue(NetWorth)` on payload | A typed `HttpApiClient` cannot encode the payload — `Cannot encode Redacted`. | **Request-side anti-pattern.** Don't put `Redacted` on the wire; the typed client breaks. |
| `POST /intake-redacted-response` | Plain payload, `Schema.Redacted(NetWorth)` on the success body | Server-side encoder fails — `Cannot serialize Redacted with label: "netWorth"`. | **Response-side anti-pattern.** The literal answer to the question above: `Redacted` cannot be a response body field. |
| `POST /intake-masked-response` | Plain payload, `MaskedEmail` (a branded string like `a***@example.com`) in the response | Works. Server hand-masks via `maskEmail(...)` and returns a plain string. | **Working alternative.** If you must echo something sensitive-looking, mask server-side and put the **masked string** on the wire — not a `Redacted`. |

## Chain of custody

```
HTTP request → decode (plain branded strings)
            → IntakeService wraps netWorth via Redacted.make({label:"netWorth"})
            → flows through logs/spans/traces as <redacted:netWorth>
            → ApplicantRepo.insert: Redacted.value(netWorth) at the SQL bind
            → Postgres row stored
```

The SINGLE `Redacted.value(...)` call site in `packages/backend/src/` is the line that hands the unwrapped number to Postgres:

```ts
// packages/backend/src/db/ApplicantRepo.ts
yield* repo.insert({ ..., netWorth: Redacted.value(input.netWorth) })
```

Grep `Redacted.value` to audit. The only hit in `src/` is that line.

Telemetry is wired through `@effect/opentelemetry` + `ConsoleSpanExporter`. Span attributes render `Redacted` values as `<redacted:label>` automatically (because `Redacted.toString()` returns that string and OTel coerces non-primitive attribute values via `String()`). The exporter dump on stdout is the eyeball-test that nothing leaks.

## Tests that pin the behavior

Two tests, both about Redacted, both non-tautological:

- [`test/http/redacted-encode-failure.test.ts`](packages/backend/test/http/redacted-encode-failure.test.ts) — pins the encode-forbidden behavior of `Schema.Redacted` and `Schema.RedactedFromValue` through the JSON codec. If a future Effect release silently changes this, the test fails first.
- [`test/db/ApplicantRepo.test.ts`](packages/backend/test/db/ApplicantRepo.test.ts) — pins the chain of custody end-to-end against a real Postgres (via `@testcontainers/postgresql`): the `Redacted.value(...)` audit-boundary unwrap, round-trip equality on the persisted column, and a negative-match regression guard that catches a future regression where the unwrap is moved elsewhere.

## Layout

```
packages/
  shared/     Effect v4 schemas + HttpApi definitions. Applicant is a Model.Class
              that's the single source of truth for FE wire, BE handler, and DB row.
  backend/    Effect HttpApi server on @effect/platform-bun, with IntakeService,
              ApplicantRepo (SqlModel.makeRepository), OpenTelemetry NodeSdk +
              ConsoleSpanExporter, tagged errors, and auto-migrate on boot.
  frontend/   Astro 6 + React 19 + Tailwind v4 + shadcn intake form, wired via
              @effect/atom-react and AtomHttpApi.Service.
```

## Run it locally

The backend persists to Postgres. You need a running database with `DATABASE_URL` set — and docker, if you want to run the integration test.

```sh
# 1. Start a local Postgres (or point at any other; just set DATABASE_URL)
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
```

`DATABASE_URL` is consumed via `Config.redacted("DATABASE_URL")`; if unset, the backend fails to start with a `ConfigError`. The migration in `packages/backend/src/migrations/` runs on every layer build, so a fresh Postgres comes up to schema automatically.

## Smoke the endpoints

```sh
# Working pattern — returns {status:"received", referenceId:"<uuid>"}
curl -sX POST :3001/intake -H 'content-type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","phone":"2025551234","netWorth":15000000}'

# Working alternative — returns {referenceId:"<uuid>", email:"a**@example.com"}
curl -sX POST :3001/intake-masked-response -H 'content-type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","phone":"2025551234","netWorth":15000000}'

# Response-side anti-pattern — HTTP 4xx; span carries "Cannot serialize Redacted"
curl -sX POST :3001/intake-redacted-response -H 'content-type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","phone":"2025551234","netWorth":15000000}'
```

(`/intake-echo-redacted` is reachable from raw HTTP but the failure mode it documents — typed client cannot encode — is exercised by the backend test suite, which is the canonical demonstration.)

## Other layers (not in scope)

- **TLS** protects bytes between client and server. Different threat, different tool.
- **Encryption at rest** (`pgcrypto`, KMS) protects bytes once they're on disk. Different threat, different tool.

The three layers — TLS, `Redacted` + `Redacted.value`, encryption-at-rest — compose. None subsumes another.

## Why no RPC or Cluster experiments

The network-boundary lesson generalizes. `Redacted` is an **in-process** wrapper; it lives entirely on one side of any transport. RPC and Cluster would repeat the HTTP result with different paint. The interesting boundary in practice is the persistence one — that's where `Redacted.value()` earns its keep, and that's what the repo demonstrates.
