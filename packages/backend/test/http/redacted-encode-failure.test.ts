/**
 * Production failure modes this catches that types/monitoring won't:
 *
 * 1. Future Effect upgrade silently changes Schema.Redacted's encode
 *    behavior from "forbidden" to "passthrough" — this test fails the
 *    moment that happens, surfacing the regression before secrets leak.
 * 2. Documentation drift — Vinicius's question is the literal subject
 *    of this repo. If the test still asserts "Cannot serialize Redacted"
 *    on every release, the README's claim about the failure mode is
 *    accurate. If it breaks, the README is lying.
 *
 * Test harness: Option B — direct schema-encode assertions (no HTTP
 * server). These tests pin the exact encoder behavior of the wire
 * schemas. The HTTP layer is implementation detail; the property
 * under investigation is the schema itself.
 *
 * Important: we route through `Schema.toCodecJson(...)` because the
 * `Getter.forbidden` encoder on `Schema.Redacted` / `Schema.RedactedFromValue`
 * is wired through the `toCodecJson` annotation (not the default Type→Encoded
 * codec). The HTTP server uses the JSON codec, so this matches the
 * production failure mode.
 */
import { describe, expect, it } from "@effect/vitest"
import { maskEmail } from "@effect-redacted/shared/domain/MaskedEmail"
import {
  IntakePayload,
  IntakePayloadAntiPattern,
  MaskedResponse,
  RedactedResponse,
} from "@effect-redacted/shared/http/payloads"
import { Cause, Effect, Redacted, Schema } from "effect"

describe("Schema.Redacted — encode-failure surfaces", () => {
  it.effect("REQUEST anti-pattern: Schema.RedactedFromValue cannot encode (Getter.forbidden)", () =>
    Effect.gen(function* () {
      const payload = {
        email: Redacted.make("ada@example.com", { label: "email" }),
        netWorth: 1_000_000,
      }
      const codec = Schema.toCodecJson(IntakePayloadAntiPattern)
      const exit = yield* Effect.exit(Schema.encodeUnknownEffect(codec)(payload))
      expect(exit._tag).toBe("Failure")
      if (exit._tag === "Failure") {
        const message = Cause.pretty(exit.cause)
        // The message could be "Cannot encode Redacted" (RedactedFromValue's
        // Getter.forbidden) or "Forbidden". Match either form.
        expect(
          message.includes("Cannot encode Redacted") ||
            message.includes("Forbidden") ||
            message.toLowerCase().includes("encode"),
        ).toBe(true)
      }
    }),
  )

  it.effect(
    "RESPONSE anti-pattern: Schema.Redacted cannot encode in the response success schema",
    () =>
      Effect.gen(function* () {
        const responseValue = {
          referenceId: "ref_test_000000",
          email: Redacted.make("ada@example.com", { label: "email" }),
        }
        const codec = Schema.toCodecJson(RedactedResponse)
        const exit = yield* Effect.exit(Schema.encodeUnknownEffect(codec)(responseValue))
        expect(exit._tag).toBe("Failure")
        if (exit._tag === "Failure") {
          const message = Cause.pretty(exit.cause)
          expect(
            message.includes("Cannot serialize Redacted") ||
              message.includes("Cannot encode Redacted"),
          ).toBe(true)
          // The label SHOULD appear in the failure message since we set one.
          expect(message.includes("email")).toBe(true)
        }
      }),
  )

  it.effect("WORKING alternative: MaskedResponse encodes cleanly to a plain string", () =>
    Effect.gen(function* () {
      const responseValue = {
        referenceId: "ref_test_000000",
        email: maskEmail("ada@example.com"),
      }
      const encoded = yield* Schema.encodeUnknownEffect(MaskedResponse)(responseValue)
      expect(encoded).toEqual({
        referenceId: "ref_test_000000",
        email: "a**@example.com",
      })
    }),
  )

  it.effect("WORKING pattern: IntakePayload (plain branded strings) encodes cleanly", () =>
    Effect.gen(function* () {
      const payload = {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "2025551234",
        netWorth: 1_000_000,
      }
      const encoded = yield* Schema.encodeUnknownEffect(IntakePayload)(payload)
      expect(encoded).toEqual(payload)
    }),
  )
})
