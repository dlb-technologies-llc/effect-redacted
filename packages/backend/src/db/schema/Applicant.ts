import {
  Email,
  FirstName,
  LastName,
  NetWorth,
  Phone,
} from "@effect-redacted/shared/domain/Applicant"
import { Schema } from "effect"

const ApplicantIdBase = Schema.String.pipe(
  Schema.check(Schema.isUUID(4, { message: "Must be a valid UUID v4" })),
)
export const ApplicantId = ApplicantIdBase.pipe(Schema.brand("ApplicantId"))
export type ApplicantId = typeof ApplicantId.Type

export class Applicant extends Schema.Class<Applicant>("Applicant")({
  id: ApplicantId,
  firstName: FirstName,
  lastName: LastName,
  email: Email,
  phone: Phone,
  netWorth: NetWorth,
  createdAt: Schema.DateTimeUtcFromDate,
}) {}
