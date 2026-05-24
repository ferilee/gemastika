import path from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { createDb } from "./db/client";
import { apiRouter } from "./routes/api";
import { getEnv } from "./env";
import { seedIfEmpty } from "./db/seed";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { googleAuthRouter } from "./auth/google";
import { ensureRuntimeSchema } from "./db/ensure";

const env = getEnv();
const db = createDb(env.dbPath);

// Auto-migrate + seed on boot (safe for SQLite file-based dev/prod).
const migrationsFolder = path.resolve(import.meta.dir, "../drizzle");
try {
  migrate(db, { migrationsFolder });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const causeMessage =
    typeof error === "object" && error !== null && "cause" in error
      ? String((error as { cause?: unknown }).cause ?? "")
      : "";
  const mergedMessage = `${message} ${causeMessage}`.toLowerCase();
  // Backward-compatible startup: allow boot when a migration tries to add
  // a column that already exists (can happen after runtime ensure).
  if (!mergedMessage.includes("duplicate column name")) throw error;
  console.warn(`[migrate] skipped duplicate-column migration: ${message}`);
}
await ensureRuntimeSchema(db);
await seedIfEmpty(db);

const app = new Hono();
app.use(
  "/api/*",
  cors({
    origin: env.corsOrigin,
    credentials: true
  })
);
app.route("/", apiRouter(db));
app.route("/", googleAuthRouter({ ...env, db }));

// Serve built web app (Vite output) in production.
const webRoot = path.resolve(import.meta.dir, env.webDistDir);
app.use("/assets/*", serveStatic({ root: webRoot }));
app.get("/*", serveStatic({ root: webRoot, path: "index.html" }));

Bun.serve({
  port: env.port,
  fetch: app.fetch
});

console.log(`Server listening on http://localhost:${env.port}`);
