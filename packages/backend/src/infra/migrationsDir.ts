import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
// src/infra/ → ../ → src/ → migrations
export const migrationsDir = join(here, "..", "migrations")
