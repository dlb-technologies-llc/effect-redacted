import { Schema, Struct } from "effect"
import { Applicant, NetWorth } from "../domain/Applicant.js"
import { MaskedEmail } from "../domain/MaskedEmail.js"

/**
 * Wire payload for `POST /intake`. Derived from `Applicant.fields` so any
 * change to the Model propagates here automatically.
 */
export const IntakePayload = Schema.Struct(Applicant.fields).mapFields(
  Struct.pick(["firstName", "lastName", "email", "phone", "netWorth"]),
)
export type IntakePayload = typeof IntakePayload.Type

export const IntakeResponse = Schema.Struct({
  status: Schema.Literals(["received"]),
  referenceId: Schema.String,
})
export type IntakeResponse = typeof IntakeResponse.Type

/**
 * Request-side anti-pattern for `POST /intake-echo-redacted`.
 *
 * `Schema.RedactedFromValue` is encode-forbidden, so a typed `HttpApiClient`
 * cannot serialize this payload. The backend test exercises the failure
 * directly through the schema's JSON codec.
 */
export const IntakePayloadAntiPattern = Schema.Struct({
  netWorth: Schema.RedactedFromValue(NetWorth),
})
export type IntakePayloadAntiPattern = typeof IntakePayloadAntiPattern.Type

/**
 * Response-side anti-pattern for `POST /intake-redacted-response`. The
 * literal answer to the question this repo exists to answer: putting
 * `Schema.Redacted` in a success schema makes the server's response
 * encoder fail.
 */
export const RedactedResponse = Schema.Struct({
  referenceId: Schema.String,
  netWorth: Schema.Redacted(NetWorth),
})
export type RedactedResponse = typeof RedactedResponse.Type

/**
 * Working alternative for `POST /intake-masked-response`. If you really
 * want to echo something sensitive-looking back, hand-mask on the server
 * and put a plain branded string on the wire.
 */
export const MaskedResponse = Schema.Struct({
  referenceId: Schema.String,
  email: MaskedEmail,
})
export type MaskedResponse = typeof MaskedResponse.Type
