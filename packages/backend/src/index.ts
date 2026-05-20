import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"
import { AppDevLayer } from "./infra/layers"

const PORT = Number(process.env.PORT ?? 3001)

BunRuntime.runMain(
  Layer.launch(AppDevLayer.pipe(Layer.provide(BunHttpServer.layer({ port: PORT })))),
)
