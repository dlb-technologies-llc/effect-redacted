import {
  Applicant,
  ApplicantId,
  type Email,
  type FirstName,
  type LastName,
  type NetWorth,
  type Phone,
} from "@effect-redacted/shared/domain/Applicant"
import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { SqlModel } from "effect/unstable/sql"
import type { SqlError } from "effect/unstable/sql/SqlError"

/**
 * Input shape for inserting an applicant. The `netWorth` field is wrapped
 * in `Redacted` on the way in. The `Redacted.value(...)` call inside
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

/**
 * Live repository.
 *
 * `SqlModel.makeRepository(Applicant, ...)` generates the CRUD machinery —
 * `insert` / `findById` / `update` / `delete` — directly from the
 * Applicant Model. The generated `insert` accepts `Applicant.insert.Type`,
 * runs the actual `INSERT ... RETURNING *` against Postgres, decodes the
 * result row through the Model, and hands back a typed `Applicant`.
 *
 * Our service wrapper exists for ONE reason: to confine the
 * `Redacted.value(...)` unwrap to a single line. The wrapped value comes
 * in via `ApplicantInsert.netWorth`, is unwrapped at exactly the call
 * site below, and the resulting plain object is handed to the
 * SqlModel-generated `repo.insert`.
 */
export const ApplicantRepoLive = Layer.effect(
  ApplicantRepo,
  Effect.gen(function* () {
    const repo = yield* SqlModel.makeRepository(Applicant, {
      tableName: "applicants",
      spanPrefix: "Applicant",
      idColumn: "id",
    })
    return ApplicantRepo.of({
      insert: (input) =>
        Effect.gen(function* () {
          const id = yield* Schema.decodeUnknownEffect(ApplicantId)(crypto.randomUUID())
          // ─────────────────────────────────────────────────────────────
          // THE AUDIT BOUNDARY. Redacted.value is called exactly once,
          // right before we hand the insert variant to the typed repo.
          // The SqlModel-generated CRUD takes it from there.
          // ─────────────────────────────────────────────────────────────
          const row = yield* repo.insert({
            id,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            netWorth: Redacted.value(input.netWorth),
          })
          return row.id
        }),
    })
  }),
)
