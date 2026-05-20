import { Schema } from "effect"

export class IntakeValidationError extends Schema.TaggedErrorClass<IntakeValidationError>()(
  "IntakeValidationError",
  { message: Schema.String, field: Schema.optional(Schema.String) },
  { httpApiStatus: 400 },
) {}

export class IntakeProcessingError extends Schema.TaggedErrorClass<IntakeProcessingError>()(
  "IntakeProcessingError",
  { message: Schema.String, referenceId: Schema.String },
  { httpApiStatus: 500 },
) {}

export class RedactedEncodeFailure extends Schema.TaggedErrorClass<RedactedEncodeFailure>()(
  "RedactedEncodeFailure",
  { message: Schema.String },
  { httpApiStatus: 500 },
) {}
