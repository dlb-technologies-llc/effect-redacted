import { ApplicantId } from "@effect-redacted/shared/domain/Applicant"
import { Effect, Layer, Schema } from "effect"
import { type ApplicantInsert, ApplicantRepo } from "../../src/db/ApplicantRepo"

/**
 * In-memory stub of `ApplicantRepo` for unit tests. Silently accepts any
 * input (including duplicates) and stores the `Redacted` wrapper intact.
 * Tests that exercise the actual `Redacted.value` audit boundary must use
 * `ApplicantRepoLive` + `FreshDbLayer` against a real Postgres instead.
 */
export const ApplicantRepoStub = Layer.effect(
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
