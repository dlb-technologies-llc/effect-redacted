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

/**
 * Wraps `netWorth` in `Redacted`, persists the applicant, annotates the
 * current span and log line with the wrapped value. The returned
 * `referenceId` is the DB-assigned `ApplicantId`.
 *
 * `Effect.orDie` on `repo.insert` collapses `SqlError | SchemaError` to a
 * defect — these are server faults, not typed business errors. Trap: adding
 * a UNIQUE constraint later (e.g. on `email`) means duplicate inserts come
 * back as `SqlError` with Postgres code `23505`; when that lands, replace
 * `orDie` with `catchTag("SqlError")` and route `23505` to a typed 4xx.
 */
export const IntakeServiceLive = Layer.effect(
  IntakeService,
  Effect.gen(function* () {
    const repo = yield* ApplicantRepo

    const persist = (payload: IntakePayload) =>
      Effect.gen(function* () {
        const netWorth = Redacted.make(payload.netWorth, { label: "netWorth" })

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
