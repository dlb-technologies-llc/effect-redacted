/**
 * Production failure modes this catches that types/monitoring won't:
 *
 * 1. Result-name transform drift — `transformResultNames: Str.snakeToCamel`
 *    is what makes `rows[0].netWorth` work (vs `rows[0].net_worth`). If
 *    that config silently goes away, the assertion `rows[0].netWorth ===
 *    raw` fails. Real Postgres + real driver, no mocking.
 *
 * 2. Audit-boundary regression — if a future refactor moves Redacted.value
 *    out of the SQL parameter binding (e.g. someone writes
 *    `${input.netWorth}` instead of `${Redacted.value(input.netWorth)}`),
 *    the persisted column becomes the string "<redacted:netWorth>", not a
 *    number. The negative-match assertion catches this automatically.
 *
 * 3. Migration drift — if the column type changes (BIGINT → NUMERIC; TEXT
 *    → VARCHAR with a length limit), real Postgres surfaces the failure
 *    on the INSERT or in the result row's coerced JS type.
 *
 * Test harness: testcontainers Postgres + `@effect/vitest` layer pattern.
 * Requires docker. Lives in the `integration` vitest project; the `unit`
 * run is unaffected.
 */

import * as os from "node:os"
import { PgMigrator } from "@effect/sql-pg"
import { expect, layer } from "@effect/vitest"
import {
  Email,
  FirstName,
  LastName,
  NetWorth,
  Phone,
} from "@effect-redacted/shared/domain/Applicant"
import { Effect, Layer, Redacted, Schema } from "effect"
import { FastCheck } from "effect/testing"
import { SqlClient } from "effect/unstable/sql"
import { ApplicantRepo, ApplicantRepoLive } from "../../src/db/ApplicantRepo"
import { FreshDbLayer } from "../setup/FreshDbLayer"
import { migrationsDir } from "../setup/migrationsDir"
import { resetPublicSchema } from "../setup/resetPublicSchema"

// `provideMerge` re-exports `SqlClient` (and friends) into the test layer
// so the test body can `yield* SqlClient.SqlClient` for the SELECT.
const TestLive = ApplicantRepoLive.pipe(Layer.provideMerge(FreshDbLayer))

// Schema-derived arbitraries. Per global policy (CLAUDE.md):
// "All test data must use schema-derived arbitraries". v4 equivalent of
// `Arbitrary.make(schema)` is `Schema.toArbitrary(schema)`.
const firstNameArb = Schema.toArbitrary(FirstName)
const lastNameArb = Schema.toArbitrary(LastName)
const emailArb = Schema.toArbitrary(Email)
const phoneArb = Schema.toArbitrary(Phone)
const netWorthArb = Schema.toArbitrary(NetWorth)

layer(TestLive)("ApplicantRepo (integration)", (it) => {
  it.effect("inserts a row; persisted net_worth equals the unwrapped value", () =>
    Effect.gen(function* () {
      yield* resetPublicSchema
      yield* PgMigrator.run({
        // OS tempdir — not a repo-relative path that would persist across runs
        schemaDirectory: `${os.tmpdir()}/effect-redacted-schema`,
        loader: PgMigrator.fromFileSystem(migrationsDir),
      })

      const sample = FastCheck.sample(
        FastCheck.record({
          firstName: firstNameArb,
          lastName: lastNameArb,
          email: emailArb,
          phone: phoneArb,
          netWorth: netWorthArb,
        }),
        1,
      )[0]
      if (sample === undefined) {
        return yield* Effect.die("FastCheck.sample returned empty")
      }

      const repo = yield* ApplicantRepo
      const id = yield* repo.insert({
        firstName: sample.firstName,
        lastName: sample.lastName,
        email: sample.email,
        phone: sample.phone,
        netWorth: Redacted.make(sample.netWorth, { label: "netWorth" }),
      })

      const sql = yield* SqlClient.SqlClient
      const rows = yield* sql<{
        readonly id: string
        readonly netWorth: number | string
        readonly email: string
      }>`SELECT id, net_worth, email FROM applicants WHERE id = ${id}`

      expect(rows.length).toBe(1)
      const row = rows[0]
      if (row === undefined) {
        return yield* Effect.die("SELECT returned no rows")
      }

      // (1) Round-trip equality on netWorth. node-postgres BIGINT may
      //     arrive as string or number depending on driver config; we
      //     coerce defensively before comparing.
      expect(Number(row.netWorth)).toBe(sample.netWorth)
      expect(row.email).toBe(sample.email)

      // (2) Negative-match: the persisted value must NOT contain "redacted".
      //     If Redacted.value is ever moved out of the SQL bind, the column
      //     would store the string "<redacted:netWorth>" and this fails.
      expect(String(row.netWorth)).not.toMatch(/redacted/i)
    }),
  )
})
