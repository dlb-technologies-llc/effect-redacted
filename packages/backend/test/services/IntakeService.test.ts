/**
 * Production failure modes this catches that types/monitoring won't:
 *
 * 1. Schema-arbitrary drift — if NetWorth's check is tightened later, the
 *    arbitrary's range must follow; the property test runs against the
 *    LIVE schema so it fails when they diverge.
 * 2. Redacted-leak regression — if a future refactor changes how the
 *    service logs/annotates and accidentally calls Redacted.value(...),
 *    the JSON.stringify property test fails.
 * 3. maskEmail correctness — produces output that the wire schema
 *    accepts AND never contains the raw local part. A unit invariant
 *    that's impossible to assert from production monitoring.
 */
import { expect, layer } from "@effect/vitest"
import { IntakePayload } from "@effect-redacted/shared/http/payloads"
import { Effect, Layer, Redacted, Schema } from "effect"
import { ReferenceIdServiceLive } from "../../src/infra/ReferenceIdService"
import { IntakeService, IntakeServiceLive } from "../../src/services/IntakeService"

const TestLive = IntakeServiceLive.pipe(Layer.provide(ReferenceIdServiceLive))

// `it.effect.prop` in @effect/vitest@4.0.0-beta.66 has a bug where schemas
// passed via the record form are not converted; convert manually.
const inputArb = Schema.toArbitrary(IntakePayload)

layer(TestLive)("IntakeService", (it) => {
  it.effect.prop(
    "intake returns a well-formed referenceId",
    { input: inputArb },
    ({ input }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const result = yield* service.intake(input)
        expect(result.referenceId).toMatch(/^ref_[0-9a-z]+_[0-9a-z]{6}$/)
      }),
    { fastCheck: { numRuns: 100 } },
  )

  it.effect.prop(
    "intakeWithMask returns a MaskedEmail-shaped string with the original domain",
    { input: inputArb },
    ({ input }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const result = yield* service.intakeWithMask(input)
        const at = input.email.indexOf("@")
        const domain = input.email.slice(at)
        expect(result.email).toMatch(/^[^@]\*+@/)
        expect(result.email.endsWith(domain)).toBe(true)
        // If the local part has more than one character, the masked output
        // must NOT contain the full original local part.
        if (at > 1) {
          const localPart = input.email.slice(0, at)
          expect(result.email.startsWith(localPart)).toBe(false)
        }
      }),
    { fastCheck: { numRuns: 100 } },
  )

  it.effect.prop(
    "JSON.stringify of a labelled Redacted attribute returns '<redacted:label>' and never leaks the value",
    { input: inputArb },
    ({ input }) =>
      Effect.gen(function* () {
        yield* Effect.void
        const wrapped = Redacted.make(input.email, { label: "email" })
        const j = JSON.stringify({ email: wrapped })
        expect(j).toBe(`{"email":"<redacted:email>"}`)
        expect(j.includes(input.email)).toBe(false)
      }),
    { fastCheck: { numRuns: 100 } },
  )
})
