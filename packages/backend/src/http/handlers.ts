import { IntakeProcessingError } from "@effect-redacted/shared/domain/errors"
import { AppApi } from "@effect-redacted/shared/http/api"
import { Effect, Redacted } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { IntakeService } from "../services/IntakeService"

export const IntakeHandlersLive = HttpApiBuilder.group(AppApi, "intake", (handlers) =>
  handlers
    /* 1. Working pattern. IntakeService can't fail (Effect<_, never>), so no
     *    error mapping is needed. If the service grows real failure modes
     *    later, the endpoint's declared `error` type should be a union that
     *    includes them. */
    .handle("submitIntake", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const { referenceId } = yield* service.intake(payload)
        return { status: "received" as const, referenceId }
      }),
    )

    /* 2. Anti-pattern A — request-side Redacted.
     *
     *    A typed `HttpApiClient` cannot reach this handler: it must encode
     *    `Schema.RedactedFromValue(Email)` on the wire, and that encoder is
     *    `Getter.forbidden`. The client Effect fails before the request is
     *    sent. A raw curl WILL reach this handler (the decode direction is
     *    allowed — raw value → Redacted), so we return a clear processing
     *    error to make the boundary explicit. */
    .handle("submitIntakeEcho", () =>
      Effect.fail(
        new IntakeProcessingError({
          message:
            "Schema.RedactedFromValue is encode-forbidden, so a typed HttpApiClient " +
            "cannot send this payload. Reached via raw HTTP only — see backend tests.",
          referenceId: "n/a",
        }),
      ),
    )

    /* 3. Anti-pattern B — response-side Redacted (Vinicius's question).
     *    Handler builds a response whose schema contains `Schema.Redacted`.
     *    The response encoder fails when writing the body; HttpApi surfaces
     *    this as an HttpApiSchemaError with the `Cannot serialize Redacted`
     *    cause attached to the span. */
    .handle("submitIntakeRedactedResponse", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const { referenceId } = yield* service.intake(payload)
        return {
          referenceId,
          email: Redacted.make(payload.email, { label: "email" }),
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
