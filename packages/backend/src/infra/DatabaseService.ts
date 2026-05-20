import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Layer, String as Str } from "effect"

/**
 * Production PgClient layer.
 *
 * `DATABASE_URL` is read via `Config.redacted` inside the layer effect, so a
 * missing value surfaces as a typed `ConfigError` instead of a synchronous
 * process throw at module-import time.
 *
 * The snake↔camel transforms let SqlModel-driven queries map the Model's
 * camelCase fields (`firstName`, `netWorth`) to the column names
 * (`first_name`, `net_worth`) and back on the way out.
 */
export const DatabaseLive = Layer.unwrap(
  Effect.gen(function* () {
    const url = yield* Config.redacted("DATABASE_URL")
    return PgClient.layer({
      url,
      transformResultNames: Str.snakeToCamel,
      transformQueryNames: Str.camelToSnake,
    })
  }),
)
