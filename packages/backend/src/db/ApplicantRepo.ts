import type {
  Email,
  FirstName,
  LastName,
  NetWorth,
  Phone,
} from "@effect-redacted/shared/domain/Applicant"
import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { SqlClient } from "effect/unstable/sql"
import type { SqlError } from "effect/unstable/sql/SqlError"
import { ApplicantId } from "./schema/Applicant"

/**
 * Input shape for inserting an applicant. The `netWorth` field is wrapped
 * in Redacted on the way in; the `Redacted.value(...)` call inside
 * `insert` below is the SINGLE audit-boundary unwrap for the codebase.
 * Grep `Redacted.value` to audit.
 */
export type ApplicantInsert = {
  readonly firstName: FirstName
  readonly lastName: LastName
  readonly email: Email
  readonly phone: Phone
  readonly netWorth: Redacted.Redacted<NetWorth>
}

export class ApplicantRepo extends Context.Service<
  ApplicantRepo,
  {
    readonly insert: (
      input: ApplicantInsert,
    ) => Effect.Effect<ApplicantId, SqlError | Schema.SchemaError>
  }
>()("@db/ApplicantRepo") {}

export const ApplicantRepoLive = Layer.effect(
  ApplicantRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return ApplicantRepo.of({
      insert: (input) =>
        Effect.gen(function* () {
          // ─────────────────────────────────────────────────────────────
          // THE AUDIT BOUNDARY. Redacted.value is called here, exactly
          // once, at the SQL parameter binding. The DB generates the id
          // via `gen_random_uuid()` and returns it through RETURNING;
          // we validate it through the ApplicantId schema before handing
          // it back.
          // ─────────────────────────────────────────────────────────────
          const rows = yield* sql<{ readonly id: string }>`
            INSERT INTO applicants
              (first_name, last_name, email, phone, net_worth)
            VALUES (
              ${input.firstName},
              ${input.lastName},
              ${input.email},
              ${input.phone},
              ${Redacted.value(input.netWorth)}
            )
            RETURNING id
          `
          const first = rows[0]
          if (first === undefined) {
            return yield* Effect.die("INSERT ... RETURNING returned no rows")
          }
          return yield* Schema.decodeUnknownEffect(ApplicantId)(first.id)
        }),
    })
  }),
)

// Test layer — in-memory map. Generates an id via crypto.randomUUID()
// and decodes through ApplicantId so the value is brand-valid without
// an `as` cast. No Redacted.value call site — tests that need the
// audit-boundary behavior specifically should use ApplicantRepoLive +
// FreshDbLayer.
export const ApplicantRepoTest = Layer.effect(
  ApplicantRepo,
  Effect.gen(function* () {
    const rows = new Map<ApplicantId, ApplicantInsert>()
    return ApplicantRepo.of({
      insert: (input) =>
        Effect.gen(function* () {
          const id = yield* Schema.decodeUnknownEffect(ApplicantId)(crypto.randomUUID())
          rows.set(id, input)
          return id
        }),
    })
  }),
)
