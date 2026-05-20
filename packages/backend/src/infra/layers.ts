import * as os from "node:os"
import { NodeServices } from "@effect/platform-node"
import { PgMigrator } from "@effect/sql-pg"
import { AppApi } from "@effect-redacted/shared/http/api"
import { Layer } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { ApplicantRepoLive } from "../db/ApplicantRepo"
import { IntakeHandlersLive } from "../http/handlers"
import { IntakeServiceLive } from "../services/IntakeService"
import { DatabaseLive } from "./DatabaseService"
import { migrationsDir } from "./migrationsDir"
import { TelemetryLive } from "./TelemetryLive"

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:4321")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

const CorsLive = HttpRouter.cors({ allowedOrigins })

const AppLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(IntakeHandlersLive),
  Layer.provide(CorsLive),
)

const ServerLive = HttpRouter.serve(AppLive)

// Runs the migrator on layer build so a fresh `DATABASE_URL` is brought
// up to schema before the server accepts requests. Layer.effectDiscard
// turns the side-effecting `PgMigrator.run` into a Layer that produces
// nothing — its purpose is the side effect.
const MigrationsLive = PgMigrator.layer({
  schemaDirectory: `${os.tmpdir()}/effect-redacted-schema`,
  loader: PgMigrator.fromFileSystem(migrationsDir),
})

export const AppDevLayer = Layer.mergeAll(ServerLive, MigrationsLive).pipe(
  Layer.provide(IntakeServiceLive),
  Layer.provide(ApplicantRepoLive),
  Layer.provide(DatabaseLive),
  Layer.provide(NodeServices.layer),
  Layer.provide(TelemetryLive),
)
