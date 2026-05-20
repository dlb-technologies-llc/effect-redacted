import { AppApi } from "@effect-redacted/shared/http/api"
import { Effect, Redacted } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { IntakeService } from "../services/IntakeService"

export const IntakeHandlersLive = HttpApiBuilder.group(AppApi, "intake", (handlers) =>
  handlers
    /* 1. Working pattern. Wire is plain branded strings; the service wraps
     *    netWorth in Redacted internally for logs/traces. */
    .handle("submitIntake", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const { referenceId } = yield* service.intake(payload)
        return { status: "received" as const, referenceId }
      }),
    )

    /* 2. Anti-pattern A — request-side Redacted.
     *
     *    A typed HttpApiClient cannot reach this handler: it would have to
     *    encode `Schema.RedactedFromValue(NetWorth)` on the wire, and that
     *    encoder is forbidden. A raw curl WILL reach this handler (the
     *    decode direction is allowed — raw number → Redacted), so we throw
     *    a defect to make the reachability boundary unmistakable. */
    .handle("submitIntakeEcho", () =>
      Effect.gen(function* () {
        yield* Effect.void
        throw new Error(
          "Schema.RedactedFromValue is encode-forbidden, so a typed HttpApiClient " +
            "cannot send this payload. Reached via raw HTTP only — see backend tests.",
        )
      }),
    )

    /* 3. Anti-pattern B — response-side Redacted (Vinicius's question).
     *    Handler builds a response whose schema contains Schema.Redacted.
     *    The response encoder fails when writing the body. */
    .handle("submitIntakeRedactedResponse", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const { referenceId } = yield* service.intake(payload)
        return {
          referenceId,
          netWorth: Redacted.make(payload.netWorth, { label: "netWorth" }),
        }
      }),
    )

    /* 4. Working alternative — mask server-side, return a plain branded string */
    .handle("submitIntakeMaskedResponse", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        return yield* service.intakeWithMask(payload)
      }),
    ),
)
