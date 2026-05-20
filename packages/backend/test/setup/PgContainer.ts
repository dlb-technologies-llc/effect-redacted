import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { Context, Effect, Layer } from "effect"
import { ContainerError } from "./errors"

export class PgContainer extends Context.Service<PgContainer>()("@services/PgContainer", {
  make: Effect.acquireRelease(
    Effect.tryPromise({
      try: () => new PostgreSqlContainer("postgres:16-alpine").start(),
      catch: (cause) => new ContainerError({ cause }),
    }),
    (container) => Effect.promise(() => container.stop()),
  ),
}) {
  static readonly layer: Layer.Layer<PgContainer, ContainerError> = Layer.effect(this)(this.make)
}
