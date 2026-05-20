import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import {
  IntakeProcessingError,
  IntakeValidationError,
  RedactedEncodeFailure,
} from "../domain/errors.js"
import {
  IntakePayload,
  IntakePayloadAntiPattern,
  IntakeResponse,
  MaskedResponse,
  RedactedResponse,
} from "./payloads.js"

const submitIntake = HttpApiEndpoint.post("submitIntake", "/intake", {
  payload: IntakePayload,
  success: IntakeResponse,
  error: IntakeValidationError,
})

const submitIntakeEcho = HttpApiEndpoint.post("submitIntakeEcho", "/intake-echo-redacted", {
  payload: IntakePayloadAntiPattern,
  success: IntakeResponse,
  error: IntakeProcessingError,
})

const submitIntakeRedactedResponse = HttpApiEndpoint.post(
  "submitIntakeRedactedResponse",
  "/intake-redacted-response",
  { payload: IntakePayload, success: RedactedResponse, error: RedactedEncodeFailure },
)

const submitIntakeMaskedResponse = HttpApiEndpoint.post(
  "submitIntakeMaskedResponse",
  "/intake-masked-response",
  { payload: IntakePayload, success: MaskedResponse, error: IntakeProcessingError },
)

const IntakeGroup = HttpApiGroup.make("intake")
  .add(submitIntake)
  .add(submitIntakeEcho)
  .add(submitIntakeRedactedResponse)
  .add(submitIntakeMaskedResponse)

export const AppApi = HttpApi.make("app").add(IntakeGroup)
