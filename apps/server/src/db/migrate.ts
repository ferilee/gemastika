import path from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createDb } from "./client";
import { getEnv } from "../env";

const { dbPath } = getEnv();
const db = createDb(dbPath);

const migrationsFolder = path.resolve(import.meta.dir, "../../drizzle");
migrate(db, { migrationsFolder });

console.log(`Migrations applied from ${migrationsFolder}`);

