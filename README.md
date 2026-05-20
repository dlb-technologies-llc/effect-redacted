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
| `POST /intake-echo-redacted` | `Schema.RedactedFromValue(Email)` on payload | A typed `HttpApiClient` cannot encode the payload — `Cannot encode Redacted`. A raw curl reaches the handler (decode is permitted) but the handler returns a documented `IntakeProcessingError`. | **Request-side anti-pattern.** Don't put `Redacted` on the wire; the typed client breaks. |
| `POST /intake-redacted-response` | Plain payload, but `Schema.Redacted(Email)` on the success body | Server-side encoder fails — `Cannot serialize Redacted with label: "email"`. HttpApi returns 400 with the cause attached to the span. | **Response-side anti-pattern.** This is the literal answer to the question above: `Redacted` cannot be a response body field. |
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

```sh
bun install
bun run dev:backend    # http://localhost:3001
bun run dev:frontend   # http://localhost:4321

# Lint / format
bun run lint
bun run format

# Backend tests (property tests + encode-failure assertions)
bun --filter @effect-redacted/backend test
```

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

## What's next

- RPC: same `Redacted` boundary question across `@effect/rpc`.
- Cluster: persisted state + entity messages — what happens when a `Redacted` is serialized into durable storage.
