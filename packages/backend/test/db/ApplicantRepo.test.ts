/**
 * Integration test for `ApplicantRepoLive`. Spins a real Postgres via
 * testcontainers, runs the migration, inserts an applicant with
 * schema-derived arbitrary inputs, and asserts the round-trip.
 *
 * Production failure modes this catches:
 *
 * 1. Result-name transform drift. `transformResultNames: Str.snakeToCamel`
 *    is what makes the SqlModel-decoded row's `netWorth` field work. If
 *    that config silently goes away, the round-trip assertion fails.
 *
 * 2. Audit-boundary regression. The negative-match assertion is a
 *    belt-and-suspenders check: under the current INTEGER column, a
 *    regression that omits `Redacted.value` would fail at the INSERT
 *    before reaching the assertion (Postgres can't parse
 *    `"<redacted:netWorth>"` as an integer). The assertion still catches
 *    the case where a future schema change makes the column text-typed.
 *
 * 3. Migration drift. Real Postgres surfaces column-type mismatches at
 *    the INSERT or in the result row's coerced JS type.
 *
 * Requires docker; lives in the `integration` vitest project so the
 * `unit` run is unaffected.
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
import { ApplicantRepo } from "../../src/db/ApplicantRepo"
import { migrationsDir } from "../../src/infra/migrationsDir"
import { FreshDbLayer } from "../setup/FreshDbLayer"
import { resetPublicSchema } from "../setup/resetPublicSchema"

const TestLive = ApplicantRepo.layer.pipe(Layer.provideMerge(FreshDbLayer))

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
          readonly netWorth: number
          readonly email: string
        }>`SELECT id, net_worth, email FROM applicants WHERE id = ${id}`

        expect(rows.length).toBe(1)
        const row = rows[0]
        if (row === undefined) {
          return yield* Effect.die("SELECT returned no rows")
        }

        expect(row.netWorth).toBe(input.netWorth)
        expect(row.email).toBe(input.email)
        expect(String(row.netWorth)).not.toMatch(/redacted/i)
      }),
    { fastCheck: { numRuns: 5 } },
  )
})
