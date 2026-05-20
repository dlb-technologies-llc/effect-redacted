import { type MaskedEmail, maskEmail } from "@effect-redacted/shared/domain/MaskedEmail"
import type { IntakePayload } from "@effect-redacted/shared/http/payloads"
import { Context, Effect, Layer, Redacted } from "effect"
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
    return IntakeService.of({
      intake: (payload) =>
        Effect.gen(function* () {
          const referenceId = yield* ids.next()

          // Only netWorth is wrapped in Redacted — it's the field deemed
          // particularly sensitive. The other fields stay as plain strings.
          // The wrapper is created inline at the point of use so the
          // pattern is visible right next to where it matters.
          const netWorth = Redacted.make(payload.netWorth, { label: "netWorth" })

          // Span attributes: every other field renders as its raw value;
          // netWorth renders as "<redacted:netWorth>" because that's what
          // Redacted.toString() returns and the OTel layer coerces with
          // String() when it sees a non-primitive attribute value.
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

          // DEMO — explicit unwrap. This is the escape hatch: every place
          // that calls Redacted.value(...) is a place that deliberately
          // exposes the raw value. Grep for "Redacted.value" to audit.
          // (In a real app you'd unwrap at the DB write, not in a log line.)
          yield* Effect.logInfo("[demo] explicit unwrap").pipe(
            Effect.annotateLogs({
              referenceId,
              netWorthRaw: Redacted.value(netWorth),
            }),
          )

          return { referenceId }
        }),
      intakeWithMask: (payload) =>
        Effect.gen(function* () {
          const referenceId = yield* ids.next()
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

          // maskEmail is a server-derived sensitive-looking value, NOT a
          // Redacted. The masked string is the data on the wire.
          return { referenceId, email: maskEmail(payload.email) }
        }),
    })
  }),
)
