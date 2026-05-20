import { Effect } from "effect"
import { SqlClient } from "effect/unstable/sql"

/**
 * Drops the `public` schema and recreates it with default privileges.
 * Call as the FIRST `yield*` inside every `it.effect` body — without it,
 * subsequent tests in the same describe share state through the Migrator's
 * tracking table.
 */
export const resetPublicSchema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`DROP SCHEMA public CASCADE`
  yield* sql`CREATE SCHEMA public`
  yield* sql`GRANT ALL ON SCHEMA public TO public`
})
