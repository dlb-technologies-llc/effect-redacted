/**
 * Production failure modes this catches that types/monitoring won't:
 *
 * 1. Result-name transform drift — `transformResultNames: Str.snakeToCamel`
 *    is what makes `rows[0].netWorth` work (vs `rows[0].net_worth`). If
 *    that config silently goes away, the assertion `Number(row.netWorth)
 *    === sample.netWorth` fails. Real Postgres + real driver, no mocking.
 *
 * 2. Audit-boundary regression — if a future refactor moves Redacted.value
 *    out of the SQL parameter binding (e.g. someone writes
 *    `${input.netWorth}` instead of `${Redacted.value(input.netWorth)}`),
 *    the test fails. The PRIMARY failure mode is that Postgres rejects
 *    `"<redacted:netWorth>"` at the INSERT — the BIGINT column won't
 *    parse a non-numeric string, so `yield* repo.insert(...)` errors
 *    before reaching the SELECT. The negative-match assertion below is
 *    a belt-and-suspenders backup for the case where a future schema
 *    change makes the column text-typed.
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
import { SqlClient } from "effect/unstable/sql"
import { ApplicantRepo, ApplicantRepoLive } from "../../src/db/ApplicantRepo"
import { migrationsDir } from "../../src/infra/migrationsDir"
import { FreshDbLayer } from "../setup/FreshDbLayer"
import { resetPublicSchema } from "../setup/resetPublicSchema"

// `provideMerge` re-exports `SqlClient` into the test layer so the test
// body can `yield* SqlClient.SqlClient` for the SELECT.
const TestLive = ApplicantRepoLive.pipe(Layer.provideMerge(FreshDbLayer))

// Schema-derived arbitraries for the input record. Per global policy:
// "All test data must use schema-derived arbitraries."
const inputArb = Schema.toArbitrary(
  Schema.Struct({
    firstName: FirstName,
    lastName: LastName,
    email: Email,
    phone: Phone,
    netWorth: NetWorth,
  }),
)

layer(TestLive)("ApplicantRepo (integration)", (it) => {
  it.effect.prop(
    "insert round-trips net_worth and never leaks the unwrapped value",
    { input: inputArb },
    ({ input }) =>
      Effect.gen(function* () {
        // Layer materializes once per describe — each prop iteration shares
        // the same container but needs a fresh schema.
        yield* resetPublicSchema
        yield* PgMigrator.run({
          schemaDirectory: `${os.tmpdir()}/effect-redacted-schema`,
          loader: PgMigrator.fromFileSystem(migrationsDir),
        })

        const repo = yield* ApplicantRepo
        const id = yield* repo.insert({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          netWorth: Redacted.make(input.netWorth, { label: "netWorth" }),
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

        // (1) Round-trip equality. node-postgres BIGINT may arrive as
        //     `number` or `string` depending on driver parser config;
        //     coerce defensively.
        expect(Number(row.netWorth)).toBe(input.netWorth)
        expect(row.email).toBe(input.email)

        // (2) Belt-and-suspenders: the persisted value must not contain
        //     "redacted". Under BIGINT this is unreachable (the INSERT
        //     would have failed earlier), but if a future schema change
        //     makes the column text-typed, this catches the regression.
        expect(String(row.netWorth)).not.toMatch(/redacted/i)
      }),
    { fastCheck: { numRuns: 5 } },
  )
})
