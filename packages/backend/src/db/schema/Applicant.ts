import { Schema } from "effect"

const ApplicantIdBase = Schema.String.pipe(
  Schema.check(Schema.isUUID(4, { message: "Must be a valid UUID v4" })),
)
export const ApplicantId = ApplicantIdBase.pipe(Schema.brand("ApplicantId"))
export type ApplicantId = typeof ApplicantId.Type
