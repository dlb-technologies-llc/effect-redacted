import { type MaskedEmail, maskEmail } from "@effect-redacted/shared/domain/MaskedEmail"
import type { IntakePayload } from "@effect-redacted/shared/http/payloads"
import { Context, Effect, Layer, Redacted } from "effect"
import { ApplicantRepo } from "../db/ApplicantRepo"

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
    const repo = yield* ApplicantRepo

    const persist = (payload: IntakePayload) =>
      Effect.gen(function* () {
        const netWorth = Redacted.make(payload.netWorth, { label: "netWorth" })

        // Note: the spans/logs below intentionally annotate netWorth AFTER
        // the DB write completes so the reference id is real. Annotation
        // order doesn't matter for the audit invariant — what matters is
        // that we never log/annotate the unwrapped value.
        //
        // ⚠️ TRAP: if a future migration adds a UNIQUE constraint (e.g. on
        // `email`), a duplicate-insert raises a SqlError carrying Postgres
        // code `23505`. With the `orDie` below, that surfaces as a 500
        // instead of a typed 4xx. When a constraint lands, replace this
        // with a `catchTag("SqlError")` that pattern-matches on the code
        // and routes constraint violations to a typed IntakeValidationError
        // or IntakeProcessingError.
        const referenceId = yield* repo
          .insert({
            firstName: payload.firstName,
            lastName: payload.lastName,
            email: payload.email,
            phone: payload.phone,
            netWorth,
          })
          .pipe(Effect.orDie)

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

        return referenceId
      })

    return IntakeService.of({
      intake: (payload) =>
        Effect.gen(function* () {
          const referenceId = yield* persist(payload)
          return { referenceId }
        }),
      intakeWithMask: (payload) =>
        Effect.gen(function* () {
          const referenceId = yield* persist(payload)
          return { referenceId, email: maskEmail(payload.email) }
        }),
    })
  }),
)
