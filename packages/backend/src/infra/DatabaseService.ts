import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Layer, String as Str } from "effect"

/**
 * Production PgClient layer. Reads `DATABASE_URL` via `Config.redacted`
 * inside the Layer effect — failures surface as a typed `ConfigError`
 * (caught by `BunRuntime.runMain`) rather than as a synchronous
 * process throw at module import time. This matches the rest of the
 * Effect architecture.
 */
export const DatabaseLive = Layer.unwrap(
  Effect.gen(function* () {
    const url = yield* Config.redacted("DATABASE_URL")
    return PgClient.layer({
      url,
      // `transformResultNames: Str.snakeToCamel` is load-bearing — it's
      // what makes `SELECT net_worth ...` come back as `rows[0].netWorth`.
      // `transformQueryNames` is set for future Model-driven helpers; the
      // current raw SQL in ApplicantRepo already spells columns in
      // snake_case so the query transform is a no-op here.
      transformResultNames: Str.snakeToCamel,
      transformQueryNames: Str.camelToSnake,
    })
  }),
)
