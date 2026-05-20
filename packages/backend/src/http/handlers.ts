import { AppApi } from "@effect-redacted/shared/http/api"
import { Effect, Redacted } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { IntakeService } from "../services/IntakeService"

/**
 * Four endpoints, on purpose.
 *
 * - `submitIntake` — working pattern. Wire is plain branded strings; the
 *   service wraps `netWorth` in `Redacted` and persists. Returns the row's
 *   `ApplicantId` as the response `referenceId`.
 * - `submitIntakeEcho` — request-side anti-pattern. A typed
 *   `HttpApiClient` cannot encode `Schema.RedactedFromValue(NetWorth)`,
 *   so the encode-forbidden failure surfaces client-side before the
 *   request is sent. A raw curl reaches this handler (decode is allowed);
 *   we throw a defect from inside `Effect.gen` to make that reachability
 *   boundary unmistakable.
 * - `submitIntakeRedactedResponse` — response-side anti-pattern (the
 *   literal question this repo answers). The handler builds a response
 *   whose schema contains `Schema.Redacted(NetWorth)`; the response
 *   encoder fails when writing the body.
 * - `submitIntakeMaskedResponse` — working alternative. The server
 *   hand-masks the email and returns a plain `MaskedEmail` string.
 */
export const IntakeHandlersLive = HttpApiBuilder.group(AppApi, "intake", (handlers) =>
  handlers
    .handle("submitIntake", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const { referenceId } = yield* service.intake(payload)
        return { status: "received" as const, referenceId }
      }),
    )
    .handle("submitIntakeEcho", () =>
      Effect.gen(function* () {
        yield* Effect.void
        throw new Error(
          "Schema.RedactedFromValue is encode-forbidden, so a typed HttpApiClient " +
            "cannot send this payload. Reached via raw HTTP only — see backend tests.",
        )
      }),
    )
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
    .handle("submitIntakeMaskedResponse", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        return yield* service.intakeWithMask(payload)
      }),
    ),
)
