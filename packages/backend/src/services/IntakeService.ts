import type { IntakeProcessingError } from "@effect-redacted/shared/domain/errors"
import { type MaskedEmail, maskEmail } from "@effect-redacted/shared/domain/MaskedEmail"
import type { IntakePayload } from "@effect-redacted/shared/http/payloads"
import { Context, Effect, Layer, Redacted } from "effect"
import { ReferenceIdService } from "../infra/ReferenceIdService"

export interface ApplicantInternal {
  readonly firstName: Redacted.Redacted<string>
  readonly lastName: Redacted.Redacted<string>
  readonly email: Redacted.Redacted<string>
  readonly phone: Redacted.Redacted<string>
  readonly netWorth: Redacted.Redacted<number>
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
    readonly intake: (
      payload: IntakePayload,
    ) => Effect.Effect<{ referenceId: string }, IntakeProcessingError>
    readonly intakeWithMask: (
      payload: IntakePayload,
    ) => Effect.Effect<{ referenceId: string; email: MaskedEmail }, IntakeProcessingError>
  }
>()("@services/IntakeService") {}

const annotateRedacted = (referenceId: string, a: ApplicantInternal) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({
      referenceId,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      phone: a.phone,
      netWorth: a.netWorth,
    })
    yield* Effect.logInfo("intake received").pipe(
      Effect.annotateLogs({ referenceId, email: a.email }),
    )
  })

export const IntakeServiceLive = Layer.effect(
  IntakeService,
  Effect.gen(function* () {
    const ids = yield* ReferenceIdService
    return IntakeService.of({
      intake: (payload) =>
        Effect.gen(function* () {
          const applicant = wrap(payload)
          const referenceId = yield* ids.next()
          yield* annotateRedacted(referenceId, applicant)
          return { referenceId }
        }),
      intakeWithMask: (payload) =>
        Effect.gen(function* () {
          const applicant = wrap(payload)
          const referenceId = yield* ids.next()
          yield* annotateRedacted(referenceId, applicant)
          return { referenceId, email: maskEmail(payload.email) }
        }),
    })
  }),
)
