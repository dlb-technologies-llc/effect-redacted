import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Absolute path to `packages/backend/src/migrations`, anchored to this
 * file's own location so it resolves correctly regardless of the
 * runner's CWD.
 */
const here = dirname(fileURLToPath(import.meta.url))
export const migrationsDir = join(here, "..", "migrations")
