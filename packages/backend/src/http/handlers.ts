import {
  IntakeProcessingError,
  IntakeValidationError,
  RedactedEncodeFailure,
} from "@effect-redacted/shared/domain/errors"
import { AppApi } from "@effect-redacted/shared/http/api"
import { Effect, Redacted } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { IntakeService } from "../services/IntakeService"

// `RedactedEncodeFailure` is the declared error type for endpoint #3.
// The handler body never constructs it — the failure surfaces from the
// response encoder when it tries to serialize `Schema.Redacted`. Keep the
// import so the file's intent is explicit.
void RedactedEncodeFailure

export const IntakeHandlersLive = HttpApiBuilder.group(AppApi, "intake", (handlers) =>
  handlers
    /* 1. Working pattern */
    .handle("submitIntake", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const { referenceId } = yield* service.intake(payload)
        return { status: "received" as const, referenceId }
      }).pipe(
        Effect.mapError(
          (e: IntakeProcessingError) => new IntakeValidationError({ message: e.message }),
        ),
      ),
    )

    /* 2. Anti-pattern A — never reached, the client cannot encode the body */
    .handle("submitIntakeEcho", () =>
      Effect.fail(
        new IntakeProcessingError({
          message:
            "Unreachable: Schema.RedactedFromValue refuses to encode (Getter.forbidden), " +
            "so a typed HttpApiClient cannot build this request body. See backend test.",
          referenceId: "n/a",
        }),
      ),
    )

    /* 3. Anti-pattern B — response-side. Handler builds a response whose
     *    schema contains Schema.Redacted. The encoder fails when writing
     *    the body. */
    .handle("submitIntakeRedactedResponse", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        const { referenceId } = yield* service.intake(payload)
        return {
          referenceId,
          email: Redacted.make(payload.email, { label: "email" }),
        }
      }).pipe(
        Effect.mapError(
          (e: IntakeProcessingError) => new RedactedEncodeFailure({ message: e.message }),
        ),
      ),
    )

    /* 4. Working alternative — mask server-side, return a plain string */
    .handle("submitIntakeMaskedResponse", ({ payload }) =>
      Effect.gen(function* () {
        const service = yield* IntakeService
        return yield* service.intakeWithMask(payload)
      }),
    ),
)
