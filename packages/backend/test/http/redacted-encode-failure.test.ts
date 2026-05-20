/**
 * Pins the encode-forbidden behavior of `Schema.Redacted` and
 * `Schema.RedactedFromValue`. The assertions route through
 * `Schema.toCodecJson(...)` because the `Getter.forbidden` encoder lives on
 * the JSON codec annotation, not on the default Type→Encoded codec — and
 * HttpApi serializes responses through the JSON codec, so the failure mode
 * this test catches is the one the HTTP server actually exhibits.
 *
 * Production failure modes this catches:
 *
 * 1. Future Effect release silently changes the encoder behavior from
 *    "forbidden" to "passthrough". This test fails the moment that
 *    happens, surfacing the regression before any secret can leak.
 * 2. README drift. The README claims these specific encoder failures hold
 *    "Cannot encode Redacted" / "Cannot serialize Redacted". If the
 *    upstream messages ever change, this test fails and the README needs
 *    updating to match.
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
        netWorth: Redacted.make(1_000_000, { label: "netWorth" }),
      }
      const codec = Schema.toCodecJson(IntakePayloadAntiPattern)
      const exit = yield* Effect.exit(Schema.encodeUnknownEffect(codec)(payload))
      expect(exit._tag).toBe("Failure")
      if (exit._tag === "Failure") {
        const message = Cause.pretty(exit.cause)
        expect(
          message.includes("Cannot encode Redacted with label") ||
            message.includes("Cannot encode Redacted"),
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
          netWorth: Redacted.make(1_000_000, { label: "netWorth" }),
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
          expect(message.includes("netWorth")).toBe(true)
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
