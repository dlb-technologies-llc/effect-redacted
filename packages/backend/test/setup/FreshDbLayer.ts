import { NodeServices } from "@effect/platform-node"
import { PgClient } from "@effect/sql-pg"
import { Effect, Layer, Redacted, String as Str } from "effect"
import { PgContainer } from "./PgContainer"

export const FreshDbLayer = Layer.unwrap(
  Effect.gen(function* () {
    const container = yield* PgContainer
    return PgClient.layer({
      url: Redacted.make(container.getConnectionUri()),
      transformResultNames: Str.snakeToCamel,
      transformQueryNames: Str.camelToSnake,
    })
  }),
).pipe(Layer.provideMerge(NodeServices.layer), Layer.provide(PgContainer.layer))
