import { Schema, SchemaGetter } from "effect"
import { Model } from "effect/unstable/schema"

/**
 * Arbitraries use fast-check primitives directly (`fc.stringMatching`,
 * `fc.emailAddress`) so they participate in fast-check's seeded RNG.
 */

const NAME_PATTERN = /^[A-Za-z'’\- ]{1,80}$/
const NAME_ARB_PATTERN = /^[A-Za-z]{1,20}$/ // narrower for arbitrary; still satisfies NAME_PATTERN

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

// Whole US dollars. INTEGER fits up to ~$2.1B (max signed 32-bit), which is
// well above "accredited investor" thresholds and well below
// `Number.MAX_SAFE_INTEGER`, so JS number and Postgres INTEGER agree without
// any pg type-parser config. Cents-level precision isn't useful for an
// intake form — nobody reports $X.50 of net worth.
export const NetWorth = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  Schema.check(Schema.isLessThanOrEqualTo(2_000_000_000)),
).annotate({
  toArbitrary: () => (fc) => fc.integer({ min: 0, max: 2_000_000_000 }),
})
export type NetWorth = typeof NetWorth.Type

/* ──────────────────────────────────────────────────────────────────────────
 * Applicant Model — single source of truth across FE wire, BE handler, DB.
 *
 * - `id` is `Model.GeneratedByApp(ApplicantId)`: present in DB insert/update
 *   variants (so SqlModel's repo can use it as the WHERE-clause id) but
 *   omitted from JSON create/update (so the wire schema doesn't include
 *   it — the FE never supplies an id). The app generates the UUID inside
 *   `ApplicantRepo.insert` via `crypto.randomUUID()` and decodes it
 *   through the `ApplicantId` schema. The migration also keeps
 *   `DEFAULT gen_random_uuid()` as a defensive fallback.
 * - `createdAt` is `Model.GeneratedByDb(Schema.DateTimeUtcFromDate)`:
 *   read-only — the column has `DEFAULT CURRENT_TIMESTAMP` and the app
 *   never supplies it.
 *
 * Derived shapes:
 * - `Applicant.fields` — field map (used by `Schema.Struct(Applicant.fields)`
 *   to mint wire shapes via `mapFields(Struct.pick(...))`)
 * - `Applicant.insert` — insert variant (no `id`, no `createdAt`); this is
 *   what the SqlModel-generated repo expects
 * - `Applicant.Type` — full entity row including the DB-generated id
 * ────────────────────────────────────────────────────────────────────────── */

const ApplicantIdBase = Schema.String.pipe(
  Schema.check(Schema.isUUID(4, { message: "Must be a valid UUID v4" })),
)
export const ApplicantId = ApplicantIdBase.pipe(Schema.brand("ApplicantId"))
export type ApplicantId = typeof ApplicantId.Type

export class Applicant extends Model.Class<Applicant>("Applicant")({
  id: Model.GeneratedByApp(ApplicantId),
  firstName: FirstName,
  lastName: LastName,
  email: Email,
  phone: Phone,
  netWorth: NetWorth,
  createdAt: Model.GeneratedByDb(Schema.DateTimeUtcFromDate),
}) {}
