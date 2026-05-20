import { PgClient } from "@effect/sql-pg"
import { Redacted, String as Str } from "effect"

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error("DATABASE_URL must be set to start the backend")
}

export const DatabaseLive = PgClient.layer({
  url: Redacted.make(url),
  // Snake↔camel transform: when a Schema field is `firstName`, queries
  // emitted from Model-driven helpers (and SELECT result keys returned
  // by the driver) round-trip between `first_name` (column) and
  // `firstName` (TS). Our raw SQL in ApplicantRepo uses snake_case
  // column names directly, so the transform only affects RESULT
  // keys here.
  transformResultNames: Str.snakeToCamel,
  transformQueryNames: Str.camelToSnake,
})
