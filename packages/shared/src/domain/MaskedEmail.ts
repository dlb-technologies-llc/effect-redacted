import { Schema } from "effect"

const MASKED_PATTERN = /^[^@\s]\*+@[^\s@]+\.[^\s@]+$/

export const MaskedEmail = Schema.String.pipe(
  Schema.check(Schema.isPattern(MASKED_PATTERN, { message: "Expected a masked email" })),
)
export type MaskedEmail = typeof MaskedEmail.Type

/**
 * Mask an email's local part: keep the first character, replace the rest with
 * `*`, and preserve the domain. For a single-character local part, emits a
 * single `*` so the result always satisfies `MASKED_PATTERN` (≥1 star).
 *
 * Throws on input that does not contain `@` after at least one character —
 * the caller is responsible for passing an already-validated `Email`.
 */
export const maskEmail = (raw: string): MaskedEmail => {
  const at = raw.indexOf("@")
  if (at <= 0) {
    throw new Error(`maskEmail requires a valid email with non-empty local part; got: ${raw}`)
  }
  const first = raw.slice(0, 1)
  const localRest = raw.slice(1, at)
  const domain = raw.slice(at)
  const stars = "*".repeat(Math.max(1, localRest.length))
  return `${first}${stars}${domain}` as MaskedEmail
}
