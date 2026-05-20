import { ApplicantId } from "@effect-redacted/shared/domain/Applicant"
import { Effect, Layer, Schema } from "effect"
import { type ApplicantInsert, ApplicantRepo } from "../../src/db/ApplicantRepo"

/**
 * In-memory stub of `ApplicantRepo`. Test-only; lives under `test/setup/`
 * so it doesn't pollute the production package. Renamed from
 * `ApplicantRepoTest` to make the non-fidelity explicit — this layer
 * silently accepts any input (including duplicates) and stores the
 * `Redacted` wrapper intact. Tests that exercise the actual
 * `Redacted.value` audit boundary must use `ApplicantRepoLive` +
 * `FreshDbLayer` instead.
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
