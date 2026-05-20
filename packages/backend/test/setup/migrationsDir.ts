import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
// test/setup/ → ../../ → packages/backend/ → src/migrations
export const migrationsDir = join(here, "..", "..", "src", "migrations")
