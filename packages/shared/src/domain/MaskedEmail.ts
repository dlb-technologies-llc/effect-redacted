import { Schema } from "effect"

const MASKED_PATTERN = /^[^@\s]\*+@[^\s@]+\.[^\s@]+$/

export const MaskedEmail = Schema.String.pipe(
  Schema.check(Schema.isPattern(MASKED_PATTERN, { message: "Expected a masked email" })),
)
export type MaskedEmail = typeof MaskedEmail.Type

export const maskEmail = (raw: string): MaskedEmail => {
  const at = raw.indexOf("@")
  if (at <= 0) return raw as MaskedEmail // caller pre-validated; defensive only
  const first = raw[0]
  const localRest = raw.slice(1, at)
  const domain = raw.slice(at)
  return `${first}${"*".repeat(localRest.length)}${domain}` as MaskedEmail
}
