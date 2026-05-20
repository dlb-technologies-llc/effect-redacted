import { type MaskedEmail, maskEmail } from "@effect-redacted/shared/domain/MaskedEmail"
import type { IntakePayload } from "@effect-redacted/shared/http/payloads"
import { Context, Effect, Layer, Redacted } from "effect"
import { ApplicantRepo } from "../db/ApplicantRepo"
import { ReferenceIdService } from "../infra/ReferenceIdService"

export class IntakeService extends Context.Service<
  IntakeService,
  {
    readonly intake: (payload: IntakePayload) => Effect.Effect<{ referenceId: string }>
    readonly intakeWithMask: (
      payload: IntakePayload,
    ) => Effect.Effect<{ referenceId: string; email: MaskedEmail }>
  }
>()("@services/IntakeService") {}

export const IntakeServiceLive = Layer.effect(
  IntakeService,
  Effect.gen(function* () {
    const ids = yield* ReferenceIdService
    const repo = yield* ApplicantRepo

    const persist = (payload: IntakePayload, referenceId: string) =>
      Effect.gen(function* () {
        const netWorth = Redacted.make(payload.netWorth, { label: "netWorth" })

        yield* Effect.annotateCurrentSpan({
          referenceId,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          netWorth,
        })
        yield* Effect.logInfo("intake received").pipe(
          Effect.annotateLogs({ referenceId, netWorth }),
        )

        // SQL/schema failures become defects: this is a server fault,
        // not a typed business error. The handler/endpoint contract
        // doesn't need to know about it.
        //
        // ⚠️ TRAP: if a future migration adds a UNIQUE constraint (e.g. on
        // `email`), a duplicate-insert raises a SqlError carrying Postgres
        // code `23505`. With this `orDie`, that surfaces as a 500 instead
        // of a typed 4xx. When a constraint lands, replace this with a
        // `catchTag("SqlError")` that pattern-matches on the code and
        // routes constraint violations to an IntakeValidationError /
        // IntakeProcessingError.
        yield* repo
          .insert({
            firstName: payload.firstName,
            lastName: payload.lastName,
            email: payload.email,
            phone: payload.phone,
            netWorth,
          })
          .pipe(Effect.orDie)
      })

    return IntakeService.of({
      intake: (payload) =>
        Effect.gen(function* () {
          const referenceId = yield* ids.next()
          yield* persist(payload, referenceId)
          return { referenceId }
        }),
      intakeWithMask: (payload) =>
        Effect.gen(function* () {
          const referenceId = yield* ids.next()
          yield* persist(payload, referenceId)
          return { referenceId, email: maskEmail(payload.email) }
        }),
    })
  }),
)
