import { faker } from "@faker-js/faker"
import { Schema, SchemaGetter } from "effect"

const NAME_PATTERN = /^[A-Za-z'’\- ]{1,80}$/

export const FirstName = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(NAME_PATTERN, {
      message: "Please enter a valid first name (letters, spaces, apostrophes, and hyphens only).",
    }),
  ),
).annotate({
  toArbitrary: () => (fc) => fc.constant(null).map(() => faker.person.firstName()),
})
export type FirstName = typeof FirstName.Type

export const LastName = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(NAME_PATTERN, {
      message: "Please enter a valid last name (letters, spaces, apostrophes, and hyphens only).",
    }),
  ),
).annotate({
  toArbitrary: () => (fc) => fc.constant(null).map(() => faker.person.lastName()),
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
  toArbitrary: () => (fc) => fc.constant(null).map(() => faker.internet.email().toLowerCase()),
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
  toArbitrary: () => (fc) =>
    fc.constant(null).map(() => faker.string.numeric({ length: 10, allowLeadingZeros: false })),
})
export type Phone = typeof Phone.Type

export const NetWorth = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  Schema.check(Schema.isLessThanOrEqualTo(100_000_000_000_00)), // $100B cap, integer cents
).annotate({
  toArbitrary: () => (fc) => fc.integer({ min: 0, max: 100_000_000_00 }),
})
export type NetWorth = typeof NetWorth.Type
