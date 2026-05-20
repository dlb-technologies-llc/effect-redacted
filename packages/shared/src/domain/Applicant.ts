import { Schema, SchemaGetter } from "effect"
import { Model } from "effect/unstable/schema"

/**
 * Branded leaves for the applicant fields.
 *
 * Arbitraries use fast-check primitives (`fc.stringMatching`, `fc.emailAddress`)
 * so they participate in fast-check's seeded RNG. The narrower
 * `NAME_ARB_PATTERN` keeps generated names ASCII to avoid `’`-vs-`'`
 * decoder noise; both patterns satisfy `NAME_PATTERN`.
 */

const NAME_PATTERN = /^[A-Za-z'’\- ]{1,80}$/
const NAME_ARB_PATTERN = /^[A-Za-z]{1,20}$/

export const FirstName = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(NAME_PATTERN, {
      message: "Please enter a valid first name (letters, spaces, apostrophes, and hyphens only).",
    }),
  ),
).annotate({
  toArbitrary: () => (fc) => fc.stringMatching(NAME_ARB_PATTERN),
})
export type FirstName = typeof FirstName.Type

export const LastName = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(NAME_PATTERN, {
      message: "Please enter a valid last name (letters, spaces, apostrophes, and hyphens only).",
    }),
  ),
).annotate({
  toArbitrary: () => (fc) => fc.stringMatching(NAME_ARB_PATTERN),
})
export type LastName = typeof LastName.Type

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const Email = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(EMAIL_PATTERN, {
      message: "Please enter an email address that looks like name@domain.com.",
    }),
  ),
).annotate({
  toArbitrary: () => (fc) => fc.emailAddress(),
})
export type Email = typeof Email.Type

const stripToDigits = (s: string): string => {
  const digits = s.trim().replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits
}
const PHONE_PATTERN = /^\d{10}$/
export const Phone = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform(stripToDigits),
    encode: SchemaGetter.passthrough(),
  }),
  Schema.check(
    Schema.isPattern(PHONE_PATTERN, {
      message: "Please enter a 10-digit phone number (e.g. 202-555-1234).",
    }),
  ),
).annotate({
  toArbitrary: () => (fc) => fc.stringMatching(PHONE_PATTERN),
})
export type Phone = typeof Phone.Type

/**
 * Whole US dollars. The $2B cap fits in signed 32-bit and well within
 * `Number.MAX_SAFE_INTEGER`, so a Postgres `INTEGER` column round-trips
 * as a JS number without any pg type-parser config.
 */
export const NetWorth = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  Schema.check(Schema.isLessThanOrEqualTo(2_000_000_000)),
).annotate({
  toArbitrary: () => (fc) => fc.integer({ min: 0, max: 2_000_000_000 }),
})
export type NetWorth = typeof NetWorth.Type

const ApplicantIdBase = Schema.String.pipe(
  Schema.check(Schema.isUUID(4, { message: "Must be a valid UUID v4" })),
)
export const ApplicantId = ApplicantIdBase.pipe(Schema.brand("ApplicantId"))
export type ApplicantId = typeof ApplicantId.Type

/**
 * `Applicant` is the single source of truth for FE wire shape, BE handler
 * types, and the Postgres row. Wire shapes are derived from
 * `Applicant.fields` via `Schema.Struct(Applicant.fields).mapFields(...)`;
 * the SqlModel repository is generated from `Applicant` directly.
 *
 * `id` uses `Model.GeneratedByApp` so it's present in DB insert/update
 * variants (required by `SqlModel.makeRepository`'s `idColumn` constraint)
 * but omitted from JSON create/update (so the wire schema doesn't include
 * it). `ApplicantRepo.insert` generates the UUID via `crypto.randomUUID()`
 * before handing it to the repo; the migration's `DEFAULT gen_random_uuid()`
 * is a defensive fallback.
 *
 * `createdAt` uses `Model.GeneratedByDb` — read-only, supplied by the
 * column's `DEFAULT CURRENT_TIMESTAMP`.
 */
export class Applicant extends Model.Class<Applicant>("Applicant")({
  id: Model.GeneratedByApp(ApplicantId),
  firstName: FirstName,
  lastName: LastName,
  email: Email,
  phone: Phone,
  netWorth: NetWorth,
  createdAt: Model.GeneratedByDb(Schema.DateTimeUtcFromDate),
}) {}
