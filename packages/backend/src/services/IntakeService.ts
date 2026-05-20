import { type MaskedEmail, maskEmail } from "@effect-redacted/shared/domain/MaskedEmail"
import type { IntakePayload } from "@effect-redacted/shared/http/payloads"
import { Context, Effect, Layer, Redacted } from "effect"
import { ReferenceIdService } from "../infra/ReferenceIdService"

/**
 * Internal representation of a decoded intake payload with every field wrapped
 * in `Redacted`. Derived from `IntakePayload` so adding a field to the wire
 * schema automatically propagates here — no parallel type definition.
 */
export type ApplicantInternal = {
  readonly [K in keyof IntakePayload]: Redacted.Redacted<IntakePayload[K]>
}

const wrap = (payload: IntakePayload): ApplicantInternal => ({
  firstName: Redacted.make(payload.firstName, { label: "firstName" }),
  lastName: Redacted.make(payload.lastName, { label: "lastName" }),
  email: Redacted.make(payload.email, { label: "email" }),
  phone: Redacted.make(payload.phone, { label: "phone" }),
  netWorth: Redacted.make(payload.netWorth, { label: "netWorth" }),
})

export class IntakeService extends Context.Service<
  IntakeService,
  {
    readonly intake: (payload: IntakePayload) => Effect.Effect<{ referenceId: string }>
    readonly intakeWithMask: (
      payload: IntakePayload,
    ) => Effect.Effect<{ referenceId: string; email: MaskedEmail }>
  }
>()("@services/IntakeService") {}

const annotateSpan = (referenceId: string, a: ApplicantInternal) =>
  Effect.annotateCurrentSpan({
    referenceId,
    firstName: a.firstName,
    lastName: a.lastName,
    email: a.email,
    phone: a.phone,
    netWorth: a.netWorth,
  })

const logIntake = (referenceId: string, a: ApplicantInternal) =>
  Effect.logInfo("intake received").pipe(Effect.annotateLogs({ referenceId, email: a.email }))

export const IntakeServiceLive = Layer.effect(
  IntakeService,
  Effect.gen(function* () {
    const ids = yield* ReferenceIdService
    return IntakeService.of({
      intake: (payload) =>
        Effect.gen(function* () {
          const applicant = wrap(payload)
          const referenceId = yield* ids.next()
          yield* annotateSpan(referenceId, applicant)
          yield* logIntake(referenceId, applicant)
          return { referenceId }
        }),
      intakeWithMask: (payload) =>
        Effect.gen(function* () {
          const applicant = wrap(payload)
          const referenceId = yield* ids.next()
          yield* annotateSpan(referenceId, applicant)
          yield* logIntake(referenceId, applicant)
          return { referenceId, email: maskEmail(payload.email) }
        }),
    })
  }),
)
