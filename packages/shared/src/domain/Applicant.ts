import { Schema, SchemaGetter } from "effect"

/**
 * Arbitraries use fast-check primitives directly (`fc.stringMatching`,
 * `fc.emailAddress`) so they participate in fast-check's seeded RNG. The
 * earlier `fc.constant(null).map(() => faker.X())` form bypassed the seed —
 * shrink/replay didn't work.
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

export const NetWorth = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  Schema.check(Schema.isLessThanOrEqualTo(100_000_000_000_00)), // $100B cap, integer cents
).annotate({
  toArbitrary: () => (fc) => fc.integer({ min: 0, max: 100_000_000_00 }),
})
export type NetWorth = typeof NetWorth.Type
