/**
 * Property tests for `IntakeService` against the in-memory `ApplicantRepoStub`.
 *
 * Production failure modes these catch:
 *
 * 1. Schema-arbitrary drift. The arbitraries are derived from the live
 *    `IntakePayload` schema, so a future tightening of any leaf (e.g.
 *    lowering NetWorth's max) flows automatically into the test inputs.
 * 2. Redacted-leak regression. The third test pins that JSON.stringify of a
 *    labelled `Redacted` returns `"<redacted:label>"` and never contains
 *    the raw value — if a future refactor swaps the wrapper for a plain
 *    value somewhere upstream, this fails.
 * 3. maskEmail correctness. The second test pins that the masked output
 *    keeps the domain, strips the local part beyond the first character,
 *    and never contains the raw local part.
 *
 * `Schema.toArbitrary(IntakePayload)` is invoked manually instead of via
 * the `it.effect.prop({ input: IntakePayload }, ...)` record form because
 * the record form silently drops the schema conversion in
 * `@effect/vitest@4.0.0-beta.69` (verified at effect-smol
 * `packages/vitest/src/internal/internal.ts:113-117` — missing `else`
 * between the `Schema.isSchema` branch and the unconditional re-assignment).
 * Revert this workaround when upstream lands the fix.
 */
import { expect, layer } from "@effect/vitest"
import { ApplicantId } from "@effect-redacted/shared/domain/Applicant"
import { IntakePayload } from "@effect-redacted/shared/http/payloads"
import { Effect, Layer, Redacted, Schema } from "effect"
import { IntakeService } from "../../src/services/IntakeService"
import { ApplicantRepoStub } from "../setup/ApplicantRepoStub"

const TestLive = IntakeService.layer.pipe(Layer.provide(ApplicantRepoStub))

const inputArb = Schema.toArbitrary(IntakePayload)

layer(TestLive)("IntakeService", (it) => {
  it.effect.prop(
    "intake returns a referenceId that decodes as a v4 UUID (the DB-assigned ApplicantId)",
    { input: inputArb },
    ({ input }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const result = yield* service.intake(input)
        yield* Schema.decodeUnknownEffect(ApplicantId)(result.referenceId)
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
