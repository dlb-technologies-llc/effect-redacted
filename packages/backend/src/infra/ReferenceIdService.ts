import { Context, Effect, Layer } from "effect"

export class ReferenceIdService extends Context.Service<
  ReferenceIdService,
  {
    readonly next: () => Effect.Effect<string>
  }
>()("@infra/ReferenceIdService") {}

export const ReferenceIdServiceLive = Layer.succeed(
  ReferenceIdService,
  ReferenceIdService.of({
    next: () =>
      Effect.sync(() => `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
  }),
)
