import { Schema, Struct } from "effect"
import { Applicant, NetWorth } from "../domain/Applicant.js"
import { MaskedEmail } from "../domain/MaskedEmail.js"

/* 1. WORKING PATTERN — /intake
 *
 * Derived from the `Applicant` Model so the wire schema, the in-memory
 * handler types, AND the DB schema all flow from one source of truth.
 * Adding/removing a field on `Applicant` propagates here automatically.
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

/* 2. ANTI-PATTERN A — /intake-echo-redacted (REQUEST-side Redacted) */
export const IntakePayloadAntiPattern = Schema.Struct({
  netWorth: Schema.RedactedFromValue(NetWorth),
})
export type IntakePayloadAntiPattern = typeof IntakePayloadAntiPattern.Type

/* 3. ANTI-PATTERN B — /intake-redacted-response (RESPONSE-side Redacted) */
export const RedactedResponse = Schema.Struct({
  referenceId: Schema.String,
  netWorth: Schema.Redacted(NetWorth),
})
export type RedactedResponse = typeof RedactedResponse.Type

/* 4. WORKING ALTERNATIVE — /intake-masked-response */
export const MaskedResponse = Schema.Struct({
  referenceId: Schema.String,
  email: MaskedEmail,
})
export type MaskedResponse = typeof MaskedResponse.Type
