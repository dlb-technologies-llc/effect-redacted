import { AppApi } from "@effect-redacted/shared/http/api"
import { Layer } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { IntakeHandlersLive } from "../http/handlers"
import { IntakeServiceLive } from "../services/IntakeService"
import { ReferenceIdServiceLive } from "./ReferenceIdService"
import { TelemetryLive } from "./TelemetryLive"

const CorsLive = HttpRouter.cors({ allowedOrigins: ["http://localhost:4321"] })

const AppLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(IntakeHandlersLive),
  Layer.provide(CorsLive),
)

const ServerLive = HttpRouter.serve(AppLive)

export const AppDevLayer = ServerLive.pipe(
  Layer.provide(IntakeServiceLive),
  Layer.provide(ReferenceIdServiceLive),
  Layer.provide(TelemetryLive),
)
