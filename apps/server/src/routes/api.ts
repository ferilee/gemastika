import { Hono } from "hono";
import { S3Client } from "bun";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  agendas,
  attendances,
  boardMembers,
  comments,
  homeQuickLinks,
  homeSettings,
  learningResourceCollectionItems,
  learningResourceCollections,
  learningResourceFavorites,
  learningResourceRatings,
  learningResourceReports,
  learningResourceVersions,
  learningResources,
  members,
  news,
  portfolioRatings,
  portfolios,
  reactions,
  userNotifications
} from "../db/schema";
import { getSession } from "../auth/session";
import { getEnv } from "../env";
import { checkLearningResourceLink } from "../services/linkAudit";

const ROLE_VALUES = ["admin", "pengurus", "anggota"] as const;
type RoleValue = (typeof ROLE_VALUES)[number];
const MEMBERSHIP_VALUES = ["pending", "approved", "rejected"] as const;
type MembershipStatus = (typeof MEMBERSHIP_VALUES)[number];
type SchoolItem = { name: string; city: string; province: string };
const SCHOOL_CACHE_TTL_MS = 1000 * 60 * 30;
const ATTENDANCE_XP_DEFAULT = 10;
const PUBLISH_VALUES = ["pending", "approved", "rejected"] as const;
type PublishStatus = (typeof PUBLISH_VALUES)[number];
const LEARNING_RESOURCE_CATEGORIES = ["RPP / Modul Ajar", "Materi Pembelajaran", "Asesmen Interaktif", "LKPD Interaktif", "Bank Soal", "Media Pembelajaran", "Praktik Baik", "Perangkat Administrasi"] as const;
const RESOURCE_SOURCE_TYPES = ["file", "link"] as const;
const REPORT_STATUS_VALUES = ["open", "resolved", "dismissed"] as const;
const learningResourcePayload = z.object({
  title: z.string().trim().min(3).max(180),
  category: z.enum(LEARNING_RESOURCE_CATEGORIES),
  description: z.string().trim().min(10).max(5000),
  phase: z.string().trim().min(1).max(30),
  grade: z.string().trim().min(1).max(60),
  topic: z.string().trim().min(2).max(120),
  semester: z.string().trim().min(1).max(30),
  curriculum: z.string().trim().min(2).max(80),
  sourceType: z.enum(RESOURCE_SOURCE_TYPES),
  resourceUrl: z.string().url(),
  fileName: z.string().trim().max(255).default(""),
  thumbnailUrl: z.string().url().or(z.literal("")).default(""),
  tags: z.string().trim().max(500).default(""),
  storageKey: z.string().trim().max(500).default(""),
  thumbnailStorageKey: z.string().trim().max(500).default(""),
  changeNote: z.string().trim().max(500).default("")
});
const schoolCache = new Map<string, { expiresAt: number; items: SchoolItem[] }>();
const SCHOOL_FALLBACK: SchoolItem[] = [
  { name: "SMK Negeri 1 Lumajang", city: "Kab. Lumajang", province: "Jawa Timur" },
  { name: "SMK Negeri 2 Lumajang", city: "Kab. Lumajang", province: "Jawa Timur" },
  { name: "SMK Negeri Pasirian", city: "Kab. Lumajang", province: "Jawa Timur" },
  { name: "SMK Negeri 1 Jember", city: "Kab. Jember", province: "Jawa Timur" },
  { name: "SMK Negeri 1 Malang", city: "Kota Malang", province: "Jawa Timur" },
  { name: "SMK Negeri 2 Surabaya", city: "Kota Surabaya", province: "Jawa Timur" },
  { name: "SMK Negeri 1 Bandung", city: "Kota Bandung", province: "Jawa Barat" },
  { name: "SMK Negeri 1 Jakarta", city: "Kota Jakarta Pusat", province: "DKI Jakarta" },
  { name: "SMK Negeri Pasirian", city: "Kab. Lumajang", province: "Jawa Timur" },
  { name: "SMK Negeri Klakah", city: "Kab. Lumajang", province: "Jawa Timur" },
  { name: "SMK Muhammadiyah Lumajang", city: "Kab. Lumajang", province: "Jawa Timur" },
  { name: "SMK Negeri 3 Malang", city: "Kota Malang", province: "Jawa Timur" },
  { name: "SMK Negeri 4 Malang", city: "Kota Malang", province: "Jawa Timur" },
  { name: "SMK Negeri 1 Kediri", city: "Kota Kediri", province: "Jawa Timur" },
  { name: "SMK Negeri 2 Kediri", city: "Kota Kediri", province: "Jawa Timur" },
  { name: "SMK Negeri 1 Jombang", city: "Kab. Jombang", province: "Jawa Timur" },
  { name: "SMK Negeri 1 Sidoarjo", city: "Kab. Sidoarjo", province: "Jawa Timur" },
  { name: "SMK Negeri 2 Sidoarjo", city: "Kab. Sidoarjo", province: "Jawa Timur" },
  { name: "SMK Negeri 1 Gresik", city: "Kab. Gresik", province: "Jawa Timur" },
  { name: "SMK Negeri 1 Banyuwangi", city: "Kab. Banyuwangi", province: "Jawa Timur" }
];

function normalizeSchoolText(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\bsmkn\b/g, "smk negeri")
    .replace(/\bsmks\b/g, "smk swasta")
    .replace(/\bsman\b/g, "sma negeri")
    .replace(/\bsman\b/g, "sma negeri")
    .replace(/\bsmpn\b/g, "smp negeri")
    .replace(/\bsd n\b/g, "sd negeri")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSchool(item: SchoolItem, query: string) {
  const searchable = normalizeSchoolText([item.name, item.city, item.province].join(" "));
  const q = normalizeSchoolText(query);
  if (!q) return 0;
  const tokens = q.split(" ").filter(Boolean);
  let score = 0;
  if (searchable.startsWith(q)) score += 120;
  if (searchable.includes(q)) score += 90;
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (searchable.includes(token)) score += 22;
    if (normalizeSchoolText(item.name).includes(token)) score += 14;
    if (normalizeSchoolText(item.city).includes(token)) score += 10;
    if (normalizeSchoolText(item.province).includes(token)) score += 8;
  }
  // Prefer SMK for MGMP Matematika SMK context.
  if (normalizeSchoolText(item.name).includes("smk")) score += 6;
  return score;
}

function rankSchools(items: SchoolItem[], query: string) {
  const seen = new Set<string>();
  const deduped: SchoolItem[] = [];
  for (const item of items) {
    const key = `${item.name}|${item.city}|${item.province}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped
    .map((item) => ({ item, score: scoreSchool(item, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map((row) => row.item)
    .slice(0, 25);
}

function parseRoles(raw: string): RoleValue[] {
  const parts = (raw || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out: RoleValue[] = [];
  for (const p of parts) {
    if ((ROLE_VALUES as readonly string[]).includes(p) && !out.includes(p as RoleValue)) out.push(p as RoleValue);
  }
  return out.length ? out : ["anggota"];
}

function primaryRole(roles: RoleValue[]): RoleValue {
  return roles.includes("admin") ? "admin" : roles.includes("pengurus") ? "pengurus" : "anggota";
}

function hasRole(roles: RoleValue[], role: RoleValue) {
  return roles.includes(role);
}

function parseMembershipStatus(raw: string | undefined): MembershipStatus {
  const value = (raw || "").trim().toLowerCase();
  if (value === "pending" || value === "rejected") return value;
  return "approved";
}

function parsePublishStatus(raw: string | undefined): PublishStatus {
  const value = (raw || "").trim().toLowerCase();
  if (value === "pending" || value === "rejected") return value;
  return "approved";
}

function isReviewer(roles: RoleValue[]) {
  return roles.includes("admin") || roles.includes("pengurus");
}

function filterFallbackSchools(query: string) {
  return rankSchools(SCHOOL_FALLBACK, query);
}

function normalizeWa(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";
  return digits;
}

function isValidWa(raw: string) {
  const cleaned = raw.replace(/[^\d]/g, "");
  return cleaned.length >= 10 && cleaned.length <= 16;
}

function normalizeTelegram(raw: string) {
  const v = raw.trim();
  if (!v) return "";
  return v.startsWith("@") ? v : `@${v}`;
}

function isValidTelegram(raw: string) {
  const value = raw.trim().replace(/^@/, "");
  return /^[a-zA-Z0-9_]{5,32}$/.test(value);
}

function cleanBaseUrl(raw: string) {
  return raw.trim().replace(/\/+$/, "");
}

function guessExt(contentType: string) {
  const c = contentType.toLowerCase();
  if (c.includes("image/jpeg")) return "jpg";
  if (c.includes("image/png")) return "png";
  if (c.includes("image/webp")) return "webp";
  return "bin";
}

function resourceFileExt(file: File) {
  const fromName = file.name.trim().toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || "";
  if (["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(fromName)) return fromName;
  const contentType = file.type.toLowerCase();
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("wordprocessingml")) return "docx";
  if (contentType.includes("msword")) return "doc";
  if (contentType.includes("presentationml")) return "pptx";
  if (contentType.includes("powerpoint")) return "ppt";
  if (contentType.includes("spreadsheetml")) return "xlsx";
  if (contentType.includes("excel")) return "xls";
  return "";
}

const RUSTFS_CHECK_TIMEOUT_MS = 30000;
const RUSTFS_UPLOAD_TIMEOUT_MS = 60000;

export function apiRouter(db: Db) {
  const api = new Hono().basePath("/api");

  api.get("/health", (c) => c.json({ ok: true }));

  api.get("/admin/rustfs-check", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !sessionRoles.includes("admin")) return c.json({ error: "Forbidden" }, 403);

    if (!env.s3Endpoint || !env.s3AccessKey || !env.s3SecretKey || !env.s3Bucket) {
      return c.json({ ok: false, error: "Konfigurasi RustFS belum lengkap di server." }, 500);
    }

    const startedAt = Date.now();
    const pingBase = env.s3Endpoint;
    let pingStatus = 0;
    let pingError = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("timeout"), 8000);
      const pingRes = await fetch(pingBase, { signal: controller.signal });
      clearTimeout(timeout);
      pingStatus = pingRes.status;
    } catch (err) {
      pingError = err instanceof Error ? err.message : String(err);
    }

    const s3 = new S3Client({
      endpoint: env.s3Endpoint,
      accessKeyId: env.s3AccessKey,
      secretAccessKey: env.s3SecretKey,
      bucket: env.s3Bucket,
      region: env.s3Region,
      virtualHostedStyle: !env.s3ForcePathStyle
    });

    const key = `healthchecks/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.txt`;
    let writeDeleteOk = false;
    let writeDeleteError = "";
    try {
      await Promise.race([
        s3.file(key).write("gemastika-rustfs-check"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("write timeout")), RUSTFS_CHECK_TIMEOUT_MS))
      ]);
      await Promise.race([
        s3.file(key).delete(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("delete timeout")), RUSTFS_CHECK_TIMEOUT_MS))
      ]);
      writeDeleteOk = true;
    } catch (err) {
      writeDeleteError = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Date.now() - startedAt;
    const ok = writeDeleteOk;
    return c.json({
      ok,
      bucket: env.s3Bucket,
      endpoint: env.s3Endpoint,
      ping: { status: pingStatus || null, error: pingError || null },
      objectCheck: { ok: writeDeleteOk, error: writeDeleteError || null },
      durationMs
    });
  });

  api.post("/uploads/image", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    if (!session) return c.json({ error: "Silakan masuk terlebih dahulu." }, 401);
    const email = (session.email || "").trim().toLowerCase();
    if (!email) return c.json({ error: "Forbidden" }, 403);
    const me = await db.select().from(members).where(eq(members.email, email)).get();
    const status = parseMembershipStatus(me?.membershipStatus);
    if (!me || status !== "approved") return c.json({ error: "Akses khusus anggota aktif." }, 403);

    if (!env.s3Endpoint || !env.s3AccessKey || !env.s3SecretKey || !env.s3Bucket) {
      return c.json({ error: "Konfigurasi RustFS belum lengkap di server." }, 500);
    }

    const body = await c.req.parseBody();
    const fileLike = body.file;
    const scope = String(body.scope || "misc").trim().toLowerCase();
    const folder = scope === "news" || scope === "portfolio" || scope === "learning-resource" ? scope : "misc";
    const file = Array.isArray(fileLike) ? fileLike[0] : fileLike;
    if (!(file instanceof File)) return c.json({ error: "File gambar tidak ditemukan." }, 400);
    if (!file.type || !["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
      return c.json({ error: "Format gambar harus JPG, PNG, atau WEBP." }, 400);
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) return c.json({ error: "Ukuran gambar maksimal 5MB." }, 400);

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const ext = guessExt(file.type);
    const key = `${folder}/${y}/${m}/${crypto.randomUUID()}.${ext}`;

    const s3 = new S3Client({
      endpoint: env.s3Endpoint,
      accessKeyId: env.s3AccessKey,
      secretAccessKey: env.s3SecretKey,
      bucket: env.s3Bucket,
      region: env.s3Region,
      virtualHostedStyle: !env.s3ForcePathStyle
    });

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await Promise.race([
        s3.file(key).write(bytes, { type: file.type }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timeout ke RustFS.")), RUSTFS_UPLOAD_TIMEOUT_MS))
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal upload ke RustFS.";
      console.error("upload_image_error:", message);
      return c.json({ error: message }, 502);
    }

    const publicBase = cleanBaseUrl(env.s3PublicBaseUrl || (env.s3Endpoint.startsWith("https://") ? env.s3Endpoint : "https://s3.gemastika.or.id"));
    const url = `${publicBase}/${env.s3Bucket}/${key}`;
    return c.json({ key, url }, 201);
  });

  api.post("/uploads/resource", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    if (!session) return c.json({ error: "Silakan masuk terlebih dahulu." }, 401);
    const email = (session.email || "").trim().toLowerCase();
    const me = email ? await db.select().from(members).where(eq(members.email, email)).get() : null;
    if (!me || parseMembershipStatus(me.membershipStatus) !== "approved") return c.json({ error: "Akses khusus anggota aktif." }, 403);
    if (!env.s3Endpoint || !env.s3AccessKey || !env.s3SecretKey || !env.s3Bucket) {
      return c.json({ error: "Konfigurasi RustFS belum lengkap di server." }, 500);
    }

    const body = await c.req.parseBody();
    const fileLike = body.file;
    const file = Array.isArray(fileLike) ? fileLike[0] : fileLike;
    if (!(file instanceof File)) return c.json({ error: "File materi tidak ditemukan." }, 400);
    const ext = resourceFileExt(file);
    if (!ext) return c.json({ error: "Format file harus PDF, DOCX, PPTX, XLSX, DOC, PPT, atau XLS." }, 400);
    if (file.size > 20 * 1024 * 1024) return c.json({ error: "Ukuran file maksimal 20MB." }, 400);

    const now = new Date();
    const key = `bank-pembelajaran/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
    const s3 = new S3Client({
      endpoint: env.s3Endpoint,
      accessKeyId: env.s3AccessKey,
      secretAccessKey: env.s3SecretKey,
      bucket: env.s3Bucket,
      region: env.s3Region,
      virtualHostedStyle: !env.s3ForcePathStyle
    });

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await Promise.race([
        s3.file(key).write(bytes, { type: file.type || "application/octet-stream" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timeout ke RustFS.")), RUSTFS_UPLOAD_TIMEOUT_MS))
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal upload materi ke RustFS.";
      console.error("upload_resource_error:", message);
      return c.json({ error: message }, 502);
    }

    const publicBase = cleanBaseUrl(env.s3PublicBaseUrl || (env.s3Endpoint.startsWith("https://") ? env.s3Endpoint : "https://s3.gemastika.or.id"));
    return c.json({ key, url: `${publicBase}/${env.s3Bucket}/${key}`, fileName: file.name }, 201);
  });

  api.get("/comments", async (c) => {
    const targetType = (c.req.query("targetType") || "").trim().toLowerCase();
    const targetId = Number(c.req.query("targetId") || 0);
    if (!["news", "portfolio"].includes(targetType) || !targetId) return c.json([]);
    const rows = await db
      .select()
      .from(comments)
      .where(and(eq(comments.targetType, targetType as "news" | "portfolio"), eq(comments.targetId, targetId)))
      .orderBy(asc(comments.createdAt), asc(comments.id));
    return c.json(rows);
  });

  api.get("/reactions", async (c) => {
    const targetType = (c.req.query("targetType") || "").trim().toLowerCase();
    const targetId = Number(c.req.query("targetId") || 0);
    if (!["news", "portfolio"].includes(targetType)) return c.json([]);

    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const userKey = (session?.email || session?.sub || "").trim().toLowerCase();

    const rows = await db
      .select({ targetId: reactions.targetId, reaction: reactions.reaction, userKey: reactions.userKey })
      .from(reactions)
      .where(
        and(
          eq(reactions.targetType, targetType as "news" | "portfolio"),
          targetId ? eq(reactions.targetId, targetId) : undefined
        )
      );

    const map = new Map<string, { targetId: number; reaction: string; count: number; reacted: boolean }>();
    for (const row of rows) {
      const key = `${row.targetId}::${row.reaction}`;
      const prev = map.get(key) || { targetId: row.targetId, reaction: row.reaction, count: 0, reacted: false };
      prev.count += 1;
      if (userKey && row.userKey === userKey) prev.reacted = true;
      map.set(key, prev);
    }
    return c.json(Array.from(map.values()));
  });

  api.post(
    "/comments",
    zValidator(
      "json",
      z.object({
        targetType: z.enum(["news", "portfolio", "learning_resource"]),
        targetId: z.number().int().positive(),
        parentId: z.number().int().positive().nullable().optional(),
        content: z.string().min(2).max(2000)
      })
    ),
    async (c) => {
      const body = c.req.valid("json");
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      if (!session) return c.json({ error: "Silakan masuk untuk berkomentar." }, 401);
      const email = (session?.email || "").trim().toLowerCase();
      const member = email ? await db.select().from(members).where(eq(members.email, email)).get() : null;
      const authorName = (member?.name || session?.name || "Pengguna").trim() || "Pengguna";

      if (body.targetType === "news") {
        const exists = await db.select({ id: news.id }).from(news).where(eq(news.id, body.targetId)).get();
        if (!exists) return c.json({ error: "Berita tidak ditemukan." }, 404);
      } else if (body.targetType === "portfolio") {
        const exists = await db.select({ id: portfolios.id }).from(portfolios).where(eq(portfolios.id, body.targetId)).get();
        if (!exists) return c.json({ error: "Portofolio tidak ditemukan." }, 404);
      } else {
        const exists = await db.select({ id: learningResources.id }).from(learningResources).where(eq(learningResources.id, body.targetId)).get();
        if (!exists) return c.json({ error: "Materi tidak ditemukan." }, 404);
      }

      if (body.parentId) {
        const parent = await db.select().from(comments).where(eq(comments.id, body.parentId)).get();
        if (!parent || parent.targetType !== body.targetType || parent.targetId !== body.targetId) {
          return c.json({ error: "Komentar induk tidak valid." }, 400);
        }
      }

      const [inserted] = await db
        .insert(comments)
        .values({
          targetType: body.targetType,
          targetId: body.targetId,
          parentId: body.parentId ?? null,
          content: body.content.trim(),
          authorName,
          authorEmail: email
        })
        .returning();
      return c.json(inserted, 201);
    }
  );

  api.post(
    "/reactions/toggle",
    zValidator(
      "json",
      z.object({
        targetType: z.enum(["news", "portfolio"]),
        targetId: z.number().int().positive(),
        reaction: z.string().min(1).max(16)
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      if (!session) return c.json({ error: "Silakan masuk untuk memberi reaksi." }, 401);
      const userKey = (session.email || session.sub || "").trim().toLowerCase();
      if (!userKey) return c.json({ error: "Identitas akun tidak valid." }, 400);

      const body = c.req.valid("json");
      if (body.targetType === "news") {
        const exists = await db.select({ id: news.id }).from(news).where(eq(news.id, body.targetId)).get();
        if (!exists) return c.json({ error: "Berita tidak ditemukan." }, 404);
      } else {
        const exists = await db.select({ id: portfolios.id }).from(portfolios).where(eq(portfolios.id, body.targetId)).get();
        if (!exists) return c.json({ error: "Portofolio tidak ditemukan." }, 404);
      }

      const existing = await db
        .select()
        .from(reactions)
        .where(
          and(
            eq(reactions.targetType, body.targetType),
            eq(reactions.targetId, body.targetId),
            eq(reactions.reaction, body.reaction),
            eq(reactions.userKey, userKey)
          )
        )
        .get();

      if (existing) {
        await db.delete(reactions).where(eq(reactions.id, existing.id));
        return c.json({ active: false });
      }

      await db.insert(reactions).values({
        targetType: body.targetType,
        targetId: body.targetId,
        reaction: body.reaction,
        userKey
      });
      return c.json({ active: true });
    }
  );

  api.get("/portfolio-ratings", async (c) => {
    const portfolioId = Number(c.req.query("portfolioId") || 0);
    if (!portfolioId) return c.json({ average: 0, count: 0, myRating: 0 });
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const userKey = (session?.email || session?.sub || "").trim().toLowerCase();

    const rows = await db.select().from(portfolioRatings).where(eq(portfolioRatings.portfolioId, portfolioId));
    const count = rows.length;
    const total = rows.reduce((sum, row) => sum + row.rating, 0);
    const average = count ? Number((total / count).toFixed(2)) : 0;
    const myRating = userKey ? rows.find((row) => row.userKey === userKey)?.rating || 0 : 0;
    return c.json({ average, count, myRating });
  });

  api.post(
    "/portfolio-ratings",
    zValidator(
      "json",
      z.object({
        portfolioId: z.number().int().positive(),
        rating: z.number().int().min(1).max(5)
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      if (!session) return c.json({ error: "Silakan masuk untuk memberi rating." }, 401);
      const userKey = (session.email || session.sub || "").trim().toLowerCase();
      if (!userKey) return c.json({ error: "Identitas akun tidak valid." }, 400);
      const body = c.req.valid("json");
      const exists = await db.select({ id: portfolios.id }).from(portfolios).where(eq(portfolios.id, body.portfolioId)).get();
      if (!exists) return c.json({ error: "Portofolio tidak ditemukan." }, 404);

      await db
        .insert(portfolioRatings)
        .values({ portfolioId: body.portfolioId, userKey, rating: body.rating })
        .onConflictDoUpdate({
          target: [portfolioRatings.portfolioId, portfolioRatings.userKey],
          set: { rating: body.rating }
        });

      const rows = await db.select().from(portfolioRatings).where(eq(portfolioRatings.portfolioId, body.portfolioId));
      const count = rows.length;
      const total = rows.reduce((sum, row) => sum + row.rating, 0);
      const average = count ? Number((total / count).toFixed(2)) : 0;
      return c.json({ average, count, myRating: body.rating });
    }
  );

  api.get("/home-content", async (c) => {
    const quickLinks = await db.select().from(homeQuickLinks).orderBy(asc(homeQuickLinks.sortOrder), asc(homeQuickLinks.id));
    const settings = await db
      .select({ key: homeSettings.key, value: homeSettings.value })
      .from(homeSettings)
      .where(or(eq(homeSettings.key, "home_quote_text"), eq(homeSettings.key, "home_quote_author")));
    const map = new Map(settings.map((s) => [s.key, s.value]));
    return c.json({
      quickLinks,
      quote: {
        text: map.get("home_quote_text") || "Mathematics is the language with which God has written the universe.",
        author: map.get("home_quote_author") || "Galileo Galilei"
      }
    });
  });

  api.post(
    "/admin/home-content",
    zValidator(
      "json",
      z.object({
        quickLinks: z.array(
          z.object({
            title: z.string().min(3),
            subtitle: z.string().min(2),
            href: z.string().min(1)
          })
        ),
        quote: z.object({
          text: z.string().min(8),
          author: z.string().min(3)
        })
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
      if (!session || !sessionRoles.includes("admin")) return c.json({ error: "Forbidden" }, 403);

      const payload = c.req.valid("json");
      const quickLinks = payload.quickLinks
        .map((item, index) => ({
          title: item.title.trim(),
          subtitle: item.subtitle.trim(),
          href: item.href.trim() || "/",
          sortOrder: index + 1
        }))
        .filter((item) => item.title.length >= 3 && item.subtitle.length >= 2);

      await db.transaction(async (tx) => {
        await tx.delete(homeQuickLinks);
        if (quickLinks.length) await tx.insert(homeQuickLinks).values(quickLinks);

        await tx
          .insert(homeSettings)
          .values({ key: "home_quote_text", value: payload.quote.text.trim() })
          .onConflictDoUpdate({ target: homeSettings.key, set: { value: payload.quote.text.trim() } });
        await tx
          .insert(homeSettings)
          .values({ key: "home_quote_author", value: payload.quote.author.trim() })
          .onConflictDoUpdate({ target: homeSettings.key, set: { value: payload.quote.author.trim() } });
      });

      const updatedQuickLinks = await db.select().from(homeQuickLinks).orderBy(asc(homeQuickLinks.sortOrder), asc(homeQuickLinks.id));
      return c.json({
        quickLinks: updatedQuickLinks,
        quote: { text: payload.quote.text.trim(), author: payload.quote.author.trim() }
      });
    }
  );

  api.get("/members", async (c) => {
    const q = (c.req.query("q") || "").trim().toLowerCase();
    const role = (c.req.query("role") || "").trim().toLowerCase();
    const rows = await db
      .select()
      .from(members)
      .where(
        and(
          q
            ? or(
                like(members.name, `%${q}%`),
                like(members.school, `%${q}%`),
                like(members.role, `%${q}%`),
                like(members.roles, `%${q}%`)
              )
            : undefined,
          role && ["admin", "pengurus", "anggota"].includes(role) ? eq(members.role, role as "admin" | "pengurus" | "anggota") : undefined
        )
      )
      .orderBy(asc(members.role), asc(members.name));
    const out = rows.map((r) => {
      const roles = parseRoles(r.roles || r.role);
      return { ...r, role: primaryRole(roles), roles };
    });
    return c.json(out);
  });

  api.get("/members/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const row = await db.select().from(members).where(eq(members.id, id)).get();
    if (!row) return c.json({ error: "Not found" }, 404);
    const roles = parseRoles(row.roles || row.role);
    return c.json({ ...row, role: primaryRole(roles), roles });
  });

  api.post(
    "/admin/members/:id/roles",
    zValidator(
      "json",
      z.object({
        roles: z.array(z.enum(ROLE_VALUES)).min(1)
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
      if (!session || !sessionRoles.includes("admin")) return c.json({ error: "Forbidden" }, 403);

      const id = Number(c.req.param("id"));
      const { roles } = c.req.valid("json");
      const normalized = Array.from(new Set(roles.map((r) => r.toLowerCase() as RoleValue)));
      const csv = normalized.join(",");
      const primary = primaryRole(normalized);

      await db.update(members).set({ roles: csv, role: primary }).where(eq(members.id, id));
      const updated = await db.select().from(members).where(eq(members.id, id)).get();
      if (!updated) return c.json({ error: "Not found" }, 404);
      const rolesList = parseRoles(updated.roles || updated.role);
      return c.json({ ...updated, role: primaryRole(rolesList), roles: rolesList });
    }
  );

  api.post(
    "/admin/members/:id/approval",
    zValidator(
      "json",
      z.object({
        status: z.enum(MEMBERSHIP_VALUES)
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
      if (!session || (!sessionRoles.includes("admin") && !sessionRoles.includes("pengurus"))) return c.json({ error: "Forbidden" }, 403);

      const id = Number(c.req.param("id"));
      const { status } = c.req.valid("json");
      const existing = await db.select().from(members).where(eq(members.id, id)).get();
      if (!existing) return c.json({ error: "Not found" }, 404);

      const prevStatus = parseMembershipStatus(existing.membershipStatus);
      const patch: Partial<typeof existing> = {
        membershipStatus: status
      };

      if (status === "approved") {
        patch.approvedAt = new Date().toISOString();
        if (prevStatus !== "approved") {
          patch.xp = (existing.xp || 0) + 10;
          patch.newMemberBadge = 1;
          patch.newMemberBadgeSeen = 0;
        }
      }

      await db.update(members).set(patch).where(eq(members.id, id));
      const updated = await db.select().from(members).where(eq(members.id, id)).get();
      if (!updated) return c.json({ error: "Not found" }, 404);
      const rolesList = parseRoles(updated.roles || updated.role);
      return c.json({ ...updated, role: primaryRole(rolesList), roles: rolesList });
    }
  );

  api.delete("/admin/members/:id", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !sessionRoles.includes("admin")) return c.json({ error: "Forbidden" }, 403);

    const id = Number(c.req.param("id"));
    const member = await db.select().from(members).where(eq(members.id, id)).get();
    if (!member) return c.json({ error: "Not found" }, 404);
    if ((member.email || "").trim().toLowerCase() === (session.email || "").trim().toLowerCase()) {
      return c.json({ error: "Tidak dapat menghapus akun sendiri." }, 400);
    }
    await db.delete(members).where(eq(members.id, id));
    return c.json({ ok: true });
  });

  api.get("/profile/me", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const email = (session.email || "").trim().toLowerCase();
    if (!email) return c.json({ registered: false, member: null });
    const member = await db.select().from(members).where(eq(members.email, email)).get();
    if (!member) return c.json({ registered: false, member: null });
    const roles = parseRoles(member.roles || member.role);
    const registered = member.name.trim().length >= 3 && member.school.trim().length >= 3 && (!!member.wa.trim() || !!member.telegram.trim());
    return c.json({ registered, member: { ...member, role: primaryRole(roles), roles } });
  });

  api.post(
    "/profile/me",
    zValidator(
      "json",
      z.object({
        name: z.string().min(3),
        school: z.string().min(3),
        wa: z.string().trim().default(""),
        telegram: z.string().trim().default(""),
        photoUrl: z.string().url().or(z.literal("")).default(""),
        profileUrl: z.string().url().or(z.literal("")).default("")
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      if (!session) return c.json({ error: "Unauthorized" }, 401);
      const email = (session.email || "").trim().toLowerCase();
      if (!email) return c.json({ error: "Email akun tidak tersedia" }, 400);

      const body = c.req.valid("json");
      const wa = normalizeWa(body.wa);
      const telegram = normalizeTelegram(body.telegram);
      if (!wa && !telegram) return c.json({ error: "Isi minimal WhatsApp atau Telegram" }, 400);
      if (wa && !isValidWa(wa)) return c.json({ error: "Format WhatsApp tidak valid" }, 400);
      if (telegram && !isValidTelegram(telegram)) return c.json({ error: "Format username Telegram tidak valid" }, 400);
      const photoUrl = body.photoUrl.trim();
      const profileUrl = body.profileUrl.trim();

      const existing = await db.select().from(members).where(eq(members.email, email)).get();
      const shouldAutoApprove = env.adminEmails.includes(email);
      if (existing) {
        const mergedRoles = parseRoles(existing.roles || existing.role);
        const primary = primaryRole(mergedRoles);
        const status: MembershipStatus = shouldAutoApprove ? "approved" : parseMembershipStatus(existing.membershipStatus);
        await db
          .update(members)
          .set({
            name: body.name,
            school: body.school,
            wa,
            telegram,
            photoUrl,
            profileUrl,
            role: primary,
            roles: mergedRoles.join(","),
            membershipStatus: status,
            approvedAt: status === "approved" ? existing.approvedAt || new Date().toISOString() : ""
          })
          .where(eq(members.id, existing.id));
      } else {
        const status: MembershipStatus = shouldAutoApprove ? "approved" : "pending";
        await db.insert(members).values({
          name: body.name,
          email,
          school: body.school,
          wa,
          telegram,
          photoUrl,
          profileUrl,
          role: "anggota",
          roles: "anggota",
          membershipStatus: status,
          approvedAt: status === "approved" ? new Date().toISOString() : ""
        });
      }

      const updated = await db.select().from(members).where(eq(members.email, email)).get();
      if (!updated) return c.json({ error: "Gagal menyimpan profil" }, 500);
      const roles = parseRoles(updated.roles || updated.role);
      return c.json({ registered: true, member: { ...updated, role: primaryRole(roles), roles } });
    }
  );

  api.post("/profile/me/badge-ack", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const email = (session.email || "").trim().toLowerCase();
    if (!email) return c.json({ error: "Email akun tidak tersedia" }, 400);
    const existing = await db.select().from(members).where(eq(members.email, email)).get();
    if (!existing) return c.json({ ok: true });
    await db.update(members).set({ newMemberBadgeSeen: 1 }).where(eq(members.id, existing.id));
    return c.json({ ok: true });
  });

  api.get("/schools", async (c) => {
    const q = (c.req.query("q") || "").trim();
    if (q.length < 2) return c.json({ items: [] });
    const cacheKey = q.toLowerCase();
    const now = Date.now();
    const fromCache = schoolCache.get(cacheKey);
    if (fromCache && fromCache.expiresAt > now) return c.json({ items: fromCache.items, source: "cache" });

    try {
      const res = await fetch(`https://api-sekolah-indonesia.vercel.app/sekolah?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const fallback = filterFallbackSchools(q);
        return c.json({ items: fallback, source: "fallback" });
      }
      const json = (await res.json()) as {
        dataSekolah?: Array<{ sekolah?: string; kabupaten_kota?: string; propinsi?: string }>;
      };
      const items = (json.dataSekolah || [])
        .map((s) => ({
          name: (s.sekolah || "").trim(),
          city: (s.kabupaten_kota || "").trim(),
          province: (s.propinsi || "").trim()
        }))
        .filter((s) => s.name.length > 0)
        .slice(0, 20);
      const rankedRemote = rankSchools(items, q);
      const rankedFallback = filterFallbackSchools(q);
      const finalItems = [...rankedRemote, ...rankedFallback].slice(0, 25);
      schoolCache.set(cacheKey, { expiresAt: now + SCHOOL_CACHE_TTL_MS, items: finalItems });
      return c.json({ items: finalItems, source: rankedRemote.length ? "remote+ranked" : "fallback" });
    } catch {
      const fallback = filterFallbackSchools(q);
      return c.json({ items: fallback, source: "fallback" });
    }
  });

  api.get("/agendas", async (c) => {
    const rows = await db.select().from(agendas).orderBy(asc(agendas.date), asc(agendas.time));
    return c.json(rows);
  });

  api.post(
    "/agendas",
    zValidator(
      "json",
      z.object({
        title: z.string().min(3),
        date: z.string().min(10),
        time: z.string().trim().default(""),
        location: z.string().trim().default(""),
        description: z.string().trim().default("")
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      const sessionRoles = parseRoles((session?.roles || []).join(",") || session?.role || "anggota");
      if (!session || !hasRole(sessionRoles, "admin")) return c.json({ error: "Forbidden" }, 403);

      const body = c.req.valid("json");
      const [inserted] = await db.insert(agendas).values(body).returning();
      return c.json(inserted, 201);
    }
  );

  api.patch(
    "/agendas/:id",
    zValidator(
      "json",
      z.object({
        title: z.string().min(3),
        date: z.string().min(10),
        time: z.string().trim().default(""),
        location: z.string().trim().default(""),
        description: z.string().trim().default("")
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      const sessionRoles = parseRoles((session?.roles || []).join(",") || session?.role || "anggota");
      if (!session || !hasRole(sessionRoles, "admin")) return c.json({ error: "Forbidden" }, 403);

      const id = Number(c.req.param("id"));
      const body = c.req.valid("json");
      await db.update(agendas).set(body).where(eq(agendas.id, id));
      const updated = await db.select().from(agendas).where(eq(agendas.id, id)).get();
      if (!updated) return c.json({ error: "Not found" }, 404);
      return c.json(updated);
    }
  );

  api.delete("/agendas/:id", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = parseRoles((session?.roles || []).join(",") || session?.role || "anggota");
    if (!session || !hasRole(sessionRoles, "admin")) return c.json({ error: "Forbidden" }, 403);

    const id = Number(c.req.param("id"));
    await db.delete(agendas).where(eq(agendas.id, id));
    return c.json({ ok: true });
  });

  api.get("/board", async (c) => {
    const rows = await db.select().from(boardMembers).orderBy(asc(boardMembers.sortOrder), asc(boardMembers.id));
    return c.json(rows);
  });

  api.post(
    "/admin/board",
    zValidator(
      "json",
      z.object({
        items: z.array(
          z.object({
            memberId: z.number().int().positive(),
            title: z.string().min(3),
            contact: z.string().min(3)
          })
        )
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
      if (!session || !sessionRoles.includes("admin")) return c.json({ error: "Forbidden" }, 403);

      const { items } = c.req.valid("json");
      const memberMap = new Map((await db.select({ id: members.id, name: members.name }).from(members)).map((m) => [m.id, m.name]));
      await db.transaction(async (tx) => {
        await tx.delete(boardMembers);
        if (items.length) {
          await tx.insert(boardMembers).values(
            items.map((it, idx) => ({
              memberId: it.memberId,
              name: memberMap.get(it.memberId) || "Anggota",
              title: it.title.trim(),
              contact: it.contact.trim(),
              sortOrder: idx + 1
            }))
          );
        }
      });

      const rows = await db.select().from(boardMembers).orderBy(asc(boardMembers.sortOrder), asc(boardMembers.id));
      return c.json(rows);
    }
  );

  api.get("/agendas/:id/attendance", async (c) => {
    const agendaId = Number(c.req.param("id"));
    const rows = await db
      .select({
        id: attendances.id,
        agendaId: attendances.agendaId,
        memberId: attendances.memberId,
        memberName: members.name,
        memberSchool: members.school,
        memberRole: members.role,
        xpAwarded: attendances.xpAwarded,
        createdAt: attendances.createdAt
      })
      .from(attendances)
      .innerJoin(members, eq(attendances.memberId, members.id))
      .where(eq(attendances.agendaId, agendaId))
      .orderBy(desc(attendances.id));
    return c.json(rows);
  });

  api.post(
    "/agendas/:id/attendance",
    zValidator(
      "json",
      z.object({
        memberId: z.number().int().positive().optional(),
        xp: z.number().int().min(0).max(1000).optional()
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      if (!session) return c.json({ error: "Unauthorized" }, 401);
      const sessionRoles = parseRoles((session.roles || []).join(",") || session.role || "anggota");
      const canManageAttendance = hasRole(sessionRoles, "admin") || hasRole(sessionRoles, "pengurus");

      const agendaId = Number(c.req.param("id"));
      const body = c.req.valid("json");
      const xp = canManageAttendance ? (body.xp ?? ATTENDANCE_XP_DEFAULT) : ATTENDANCE_XP_DEFAULT;

      let memberId = body.memberId ?? 0;
      if (canManageAttendance) {
        if (!memberId) return c.json({ error: "Member wajib dipilih" }, 400);
      } else {
        const email = (session.email || "").trim().toLowerCase();
        if (!email) return c.json({ error: "Email akun tidak tersedia" }, 400);
        const me = await db
          .select({ id: members.id, membershipStatus: members.membershipStatus })
          .from(members)
          .where(eq(members.email, email))
          .get();
        if (!me) return c.json({ error: "Profil anggota belum terdaftar" }, 400);
        if (parseMembershipStatus(me.membershipStatus) !== "approved") return c.json({ error: "Akses kehadiran khusus anggota aktif." }, 403);
        memberId = me.id;
      }

      // Ensure agenda and member exist (fast checks).
      const agenda = await db.select({ id: agendas.id }).from(agendas).where(eq(agendas.id, agendaId)).get();
      if (!agenda) return c.json({ error: "Agenda not found" }, 404);
      const member = await db.select({ id: members.id, xp: members.xp }).from(members).where(eq(members.id, memberId)).get();
      if (!member) return c.json({ error: "Member not found" }, 404);

      const result = await db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: attendances.id, xpAwarded: attendances.xpAwarded })
          .from(attendances)
          .where(and(eq(attendances.agendaId, agendaId), eq(attendances.memberId, memberId)))
          .get();

        if (existing) {
          const updatedMember = await tx.select().from(members).where(eq(members.id, memberId)).get();
          return { already: true as const, attendance: existing, member: updatedMember };
        }

        const [inserted] = await tx
          .insert(attendances)
          .values({ agendaId, memberId, xpAwarded: xp })
          .returning();

        // Atomic increment
        await tx.update(members).set({ xp: sql`${members.xp} + ${xp}` }).where(eq(members.id, memberId));
        const updatedMember = await tx.select().from(members).where(eq(members.id, memberId)).get();
        return { already: false as const, attendance: inserted, member: updatedMember };
      });

      return c.json(result, 201);
    }
  );

  api.get("/news", async (c) => {
    const q = (c.req.query("q") || "").trim().toLowerCase();
    const category = (c.req.query("category") || "").trim().toLowerCase();
    const includeAll = c.req.query("includeAll") === "1";
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    const canReview = isReviewer(sessionRoles);
    const viewerEmail = (session?.email || "").trim().toLowerCase();
    const visibilityWhere =
      includeAll && canReview
        ? undefined
        : viewerEmail
          ? or(eq(news.publishStatus, "approved"), and(eq(news.publishStatus, "pending"), eq(news.createdByEmail, viewerEmail)))
          : eq(news.publishStatus, "approved");
    const where = and(q ? like(news.title, `%${q}%`) : undefined, category && category !== "all" ? like(news.category, `%${category}%`) : undefined, visibilityWhere);
    const rows = await db.select().from(news).where(where).orderBy(desc(news.date), desc(news.id));
    return c.json(rows);
  });

  api.get("/news/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const row = await db.select().from(news).where(eq(news.id, id)).get();
    if (!row) return c.json({ error: "Not found" }, 404);

    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    const canReview = sessionRoles.includes("admin") || sessionRoles.includes("pengurus");
    const viewerEmail = (session?.email || "").trim().toLowerCase();
    const isOwner = Boolean(viewerEmail && (row.createdByEmail || "").trim().toLowerCase() === viewerEmail);
    if (parsePublishStatus(row.publishStatus) !== "approved" && !canReview && !isOwner) return c.json({ error: "Not found" }, 404);

    return c.json(row);
  });

  api.post(
    "/news",
    zValidator(
      "json",
      z.object({
        title: z.string().min(3),
        category: z.string().min(2).default("Umum"),
        author: z.string().min(2).default("Admin"),
        date: z.string().min(10),
        imageUrl: z.string().url().or(z.literal("")).default(""),
        summary: z.string().min(10),
        content: z.string().min(10),
        documentUrl: z.string().url().or(z.literal("")).default("")
      })
    ),
    async (c) => {
      const body = c.req.valid("json");
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      if (!session) return c.json({ error: "Unauthorized" }, 401);
      const email = (session.email || "").trim().toLowerCase();
      if (!email) return c.json({ error: "Forbidden" }, 403);
      const me = await db.select().from(members).where(eq(members.email, email)).get();
      const status = parseMembershipStatus(me?.membershipStatus);
      if (!me || status !== "approved") return c.json({ error: "Akses khusus anggota aktif." }, 403);
      const [inserted] = await db
        .insert(news)
        .values({ ...body, createdByEmail: email, publishStatus: "pending", reviewedBy: "", reviewedAt: "" })
        .returning();
      return c.json(inserted, 201);
    }
  );

  api.patch(
    "/news/:id",
    zValidator(
      "json",
      z.object({
        title: z.string().min(3),
        category: z.string().min(2).default("Umum"),
        author: z.string().min(2).default("Admin"),
        date: z.string().min(10),
        imageUrl: z.string().url().or(z.literal("")).default(""),
        summary: z.string().min(10),
        content: z.string().min(10),
        documentUrl: z.string().url().or(z.literal("")).default("")
      })
    ),
    async (c) => {
      const body = c.req.valid("json");
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      if (!session) return c.json({ error: "Unauthorized" }, 401);
      const email = (session.email || "").trim().toLowerCase();
      if (!email) return c.json({ error: "Forbidden" }, 403);

      const id = Number(c.req.param("id"));
      const existing = await db.select().from(news).where(eq(news.id, id)).get();
      if (!existing) return c.json({ error: "Not found" }, 404);
      if ((existing.createdByEmail || "").trim().toLowerCase() !== email) return c.json({ error: "Hanya penulis berita yang bisa mengedit." }, 403);

      const me = await db.select().from(members).where(eq(members.email, email)).get();
      const status = parseMembershipStatus(me?.membershipStatus);
      if (!me || status !== "approved") return c.json({ error: "Akses khusus anggota aktif." }, 403);

      await db
        .update(news)
        .set({ ...body, publishStatus: "pending", reviewedBy: "", reviewedAt: "" })
        .where(eq(news.id, id));
      const updated = await db.select().from(news).where(eq(news.id, id)).get();
      return c.json(updated);
    }
  );

  api.post(
    "/admin/news/:id/review",
    zValidator(
      "json",
      z.object({
        status: z.enum(PUBLISH_VALUES)
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
      if (!session || (!sessionRoles.includes("admin") && !sessionRoles.includes("pengurus"))) return c.json({ error: "Forbidden" }, 403);
      const id = Number(c.req.param("id"));
      const { status } = c.req.valid("json");
      await db
        .update(news)
        .set({ publishStatus: status, reviewedBy: (session.email || session.name || "").trim(), reviewedAt: new Date().toISOString() })
        .where(eq(news.id, id));
      const updated = await db.select().from(news).where(eq(news.id, id)).get();
      if (!updated) return c.json({ error: "Not found" }, 404);
      return c.json(updated);
    }
  );

  api.delete("/admin/news/:id", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !sessionRoles.includes("admin")) return c.json({ error: "Forbidden" }, 403);

    const id = Number(c.req.param("id"));
    const existing = await db.select({ id: news.id }).from(news).where(eq(news.id, id)).get();
    if (!existing) return c.json({ error: "Not found" }, 404);

    await db.transaction(async (tx) => {
      await tx.delete(comments).where(and(eq(comments.targetType, "news"), eq(comments.targetId, id)));
      await tx.delete(reactions).where(and(eq(reactions.targetType, "news"), eq(reactions.targetId, id)));
      await tx.delete(news).where(eq(news.id, id));
    });

    return c.json({ ok: true, id });
  });

  api.get("/portfolios", async (c) => {
    const q = (c.req.query("q") || "").trim().toLowerCase();
    const limit = Math.min(Number(c.req.query("limit") || 6), 60);
    const includeAll = c.req.query("includeAll") === "1";
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    const canReview = sessionRoles.includes("admin") || sessionRoles.includes("pengurus");
    const viewerEmail = (session?.email || "").trim().toLowerCase();
    const visibilityWhere =
      includeAll && canReview
        ? undefined
        : viewerEmail
          ? or(eq(portfolios.publishStatus, "approved"), and(eq(portfolios.publishStatus, "pending"), eq(portfolios.createdByEmail, viewerEmail)))
          : eq(portfolios.publishStatus, "approved");
    const rows = await db
      .select()
      .from(portfolios)
      .where(
        and(
          q
            ? or(
                like(portfolios.title, `%${q}%`),
                like(portfolios.teacherName, `%${q}%`),
                like(portfolios.school, `%${q}%`)
              )
            : undefined,
          visibilityWhere
        )
      )
      .orderBy(desc(portfolios.id))
      .limit(limit);
    return c.json(rows);
  });

  api.post(
    "/portfolios",
    zValidator(
      "json",
      z.object({
        teacherName: z.string().min(3),
        school: z.string().min(2).default("-"),
        title: z.string().min(3),
        description: z.string().min(10),
        link: z.string().url().or(z.literal("")).default(""),
        photoUrl: z.string().url().or(z.literal("")).default("")
      })
    ),
    async (c) => {
      const body = c.req.valid("json");
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      if (!session) return c.json({ error: "Unauthorized" }, 401);
      const email = (session.email || "").trim().toLowerCase();
      if (!email) return c.json({ error: "Forbidden" }, 403);
      const me = await db.select().from(members).where(eq(members.email, email)).get();
      const status = parseMembershipStatus(me?.membershipStatus);
      if (!me || status !== "approved") return c.json({ error: "Akses khusus anggota aktif." }, 403);
      const [inserted] = await db
        .insert(portfolios)
        .values({ ...body, createdByEmail: email, publishStatus: "pending", reviewedBy: "", reviewedAt: "" })
        .returning();
      return c.json(inserted, 201);
    }
  );

  api.post(
    "/admin/portfolios/:id/review",
    zValidator(
      "json",
      z.object({
        status: z.enum(PUBLISH_VALUES)
      })
    ),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
      if (!session || (!sessionRoles.includes("admin") && !sessionRoles.includes("pengurus"))) return c.json({ error: "Forbidden" }, 403);
      const id = Number(c.req.param("id"));
      const { status } = c.req.valid("json");
      await db
        .update(portfolios)
        .set({ publishStatus: status, reviewedBy: (session.email || session.name || "").trim(), reviewedAt: new Date().toISOString() })
        .where(eq(portfolios.id, id));
      const updated = await db.select().from(portfolios).where(eq(portfolios.id, id)).get();
      if (!updated) return c.json({ error: "Not found" }, 404);
      return c.json(updated);
    }
  );

  api.delete("/admin/portfolios/:id", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !sessionRoles.includes("admin")) return c.json({ error: "Forbidden" }, 403);

    const id = Number(c.req.param("id"));
    const existing = await db.select({ id: portfolios.id }).from(portfolios).where(eq(portfolios.id, id)).get();
    if (!existing) return c.json({ error: "Not found" }, 404);

    await db.transaction(async (tx) => {
      await tx.delete(comments).where(and(eq(comments.targetType, "portfolio"), eq(comments.targetId, id)));
      await tx.delete(reactions).where(and(eq(reactions.targetType, "portfolio"), eq(reactions.targetId, id)));
      await tx.delete(portfolioRatings).where(eq(portfolioRatings.portfolioId, id));
      await tx.delete(portfolios).where(eq(portfolios.id, id));
    });

    return c.json({ ok: true, id });
  });

  api.get("/learning-resources", async (c) => {
    const q = (c.req.query("q") || "").trim().toLowerCase();
    const category = (c.req.query("category") || "").trim();
    const phase = (c.req.query("phase") || "").trim();
    const includeAll = c.req.query("includeAll") === "1";
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    const canReview = sessionRoles.includes("admin") || sessionRoles.includes("pengurus");
    const viewerEmail = (session?.email || "").trim().toLowerCase();
    const visibilityWhere =
      includeAll && canReview
        ? undefined
        : viewerEmail
          ? or(eq(learningResources.publishStatus, "approved"), and(eq(learningResources.publishStatus, "pending"), eq(learningResources.createdByEmail, viewerEmail)))
          : eq(learningResources.publishStatus, "approved");
    const rows = await db
      .select()
      .from(learningResources)
      .where(
        and(
          q
            ? or(
                like(learningResources.title, `%${q}%`),
                like(learningResources.topic, `%${q}%`),
                like(learningResources.description, `%${q}%`)
              )
            : undefined,
          category && category !== "All" ? eq(learningResources.category, category) : undefined,
          phase && phase !== "All" ? eq(learningResources.phase, phase) : undefined,
          includeAll && canReview ? undefined : eq(learningResources.archivedAt, ""),
          visibilityWhere
        )
      )
      .orderBy(desc(learningResources.createdAt), desc(learningResources.id));
    return c.json(rows);
  });

  api.get("/admin/learning-resources/operations", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const roles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !roles.includes("admin")) return c.json({ error: "Forbidden" }, 403);

    const [resources, openReports] = await Promise.all([
      db.select().from(learningResources).orderBy(desc(learningResources.createdAt)),
      db.select().from(learningResourceReports).where(eq(learningResourceReports.status, "open")).orderBy(desc(learningResourceReports.createdAt))
    ]);
    const countStatus = (status: PublishStatus) => resources.filter((item) => item.publishStatus === status && !item.archivedAt).length;
    const byCategory = Array.from(
      resources.reduce((map, item) => map.set(item.category, (map.get(item.category) || 0) + 1), new Map<string, number>())
    ).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
    const topResources = [...resources]
      .filter((item) => !item.archivedAt && item.publishStatus === "approved")
      .sort((a, b) => (b.viewCount + b.downloadCount) - (a.viewCount + a.downloadCount) || b.id - a.id)
      .slice(0, 5)
      .map((item) => ({ id: item.id, title: item.title, category: item.category, viewCount: item.viewCount, downloadCount: item.downloadCount }));
    const now = Date.now();
    const staleLinks = resources.filter((item) => item.sourceType === "link" && !item.archivedAt && now - new Date(item.createdAt).getTime() > 1000 * 60 * 60 * 24 * 90).length;
    return c.json({
      overview: {
        total: resources.length,
        approved: countStatus("approved"),
        pending: countStatus("pending"),
        rejected: countStatus("rejected"),
        archived: resources.filter((item) => Boolean(item.archivedAt)).length,
        files: resources.filter((item) => item.sourceType === "file").length,
        links: resources.filter((item) => item.sourceType === "link").length,
        views: resources.reduce((total, item) => total + item.viewCount, 0),
        downloads: resources.reduce((total, item) => total + item.downloadCount, 0),
        openReports: openReports.length,
        staleLinks,
        brokenLinks: resources.filter((item) => item.linkCheckStatus === "broken" && !item.archivedAt).length
      },
      byCategory,
      topResources,
      openReports: openReports.slice(0, 8)
    });
  });

  api.get("/learning-resources/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const row = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
    if (!row) return c.json({ error: "Not found" }, 404);

    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    const canReview = isReviewer(sessionRoles);
    const viewerEmail = (session?.email || "").trim().toLowerCase();
    const isOwner = Boolean(viewerEmail && (row.createdByEmail || "").trim().toLowerCase() === viewerEmail);
    if ((parsePublishStatus(row.publishStatus) !== "approved" || row.archivedAt) && !canReview && !isOwner) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  });

  api.post("/learning-resources", zValidator("json", learningResourcePayload), async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const email = (session.email || "").trim().toLowerCase();
    const me = email ? await db.select().from(members).where(eq(members.email, email)).get() : null;
    if (!me || parseMembershipStatus(me.membershipStatus) !== "approved") return c.json({ error: "Akses khusus anggota aktif." }, 403);

    const { changeNote, ...payload } = c.req.valid("json");
    const [inserted] = await db
      .insert(learningResources)
      .values({ ...payload, createdByEmail: email, publishStatus: "pending", reviewedBy: "", reviewedAt: "" })
      .returning();
    await db.insert(learningResourceVersions).values({
      resourceId: inserted.id,
      version: 1,
      resourceUrl: inserted.resourceUrl,
      fileName: inserted.fileName,
      storageKey: inserted.storageKey,
      changeNote: changeNote || "Versi awal",
      createdByEmail: email
    });
    return c.json(inserted, 201);
  });

  api.patch("/learning-resources/:id", zValidator("json", learningResourcePayload), async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const email = (session.email || "").trim().toLowerCase();
    const id = Number(c.req.param("id"));
    const existing = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (!email || (existing.createdByEmail || "").trim().toLowerCase() !== email) return c.json({ error: "Hanya kontributor yang bisa mengedit materi." }, 403);

    const me = await db.select().from(members).where(eq(members.email, email)).get();
    if (!me || parseMembershipStatus(me.membershipStatus) !== "approved") return c.json({ error: "Akses khusus anggota aktif." }, 403);
    const { changeNote, ...payload } = c.req.valid("json");
    const latest = await db.select({ version: learningResourceVersions.version }).from(learningResourceVersions).where(eq(learningResourceVersions.resourceId, id)).orderBy(desc(learningResourceVersions.version)).get();
    await db
      .update(learningResources)
      .set({ ...payload, publishStatus: "pending", reviewedBy: "", reviewedAt: "", reviewNote: "" })
      .where(eq(learningResources.id, id));
    const updated = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
    if (!updated) return c.json({ error: "Not found" }, 404);
    await db.insert(learningResourceVersions).values({ resourceId: id, version: (latest?.version || 0) + 1, resourceUrl: updated.resourceUrl, fileName: updated.fileName, storageKey: updated.storageKey, changeNote: changeNote || "Pembaruan materi", createdByEmail: email });
    return c.json(updated);
  });

  api.post(
    "/admin/learning-resources/:id/review",
    zValidator("json", z.object({ status: z.enum(PUBLISH_VALUES), note: z.string().trim().max(1000).default("") })),
    async (c) => {
      const env = getEnv();
      const session = await getSession(c, env.sessionSecret);
      const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
      if (!session || !isReviewer(sessionRoles)) return c.json({ error: "Forbidden" }, 403);
      const id = Number(c.req.param("id"));
      const body = c.req.valid("json");
      if (body.status === "rejected" && !body.note) return c.json({ error: "Catatan reviewer wajib diisi saat menolak materi." }, 400);
      await db
        .update(learningResources)
        .set({ publishStatus: body.status, reviewedBy: (session.email || session.name || "").trim(), reviewedAt: new Date().toISOString(), reviewNote: body.note })
        .where(eq(learningResources.id, id));
      const updated = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
      if (!updated) return c.json({ error: "Not found" }, 404);
      const recipientKey = updated.createdByEmail.trim().toLowerCase();
      if (recipientKey) {
        const approved = body.status === "approved";
        await db.insert(userNotifications).values({
          recipientKey,
          type: "learning_resource_review",
          title: approved ? "Materi disetujui" : body.status === "rejected" ? "Materi perlu diperbaiki" : "Status materi diperbarui",
          message: body.note || (approved ? `“${updated.title}” sudah dipublikasikan.` : `“${updated.title}” menunggu tindak lanjut.`),
          href: `/bank-pembelajaran/${updated.id}`
        });
      }
      return c.json(updated);
    }
  );

  api.get("/learning-resources/:id/versions", async (c) => {
    const id = Number(c.req.param("id"));
    const exists = await db.select({ id: learningResources.id }).from(learningResources).where(eq(learningResources.id, id)).get();
    if (!exists) return c.json({ error: "Not found" }, 404);
    return c.json(await db.select().from(learningResourceVersions).where(eq(learningResourceVersions.resourceId, id)).orderBy(desc(learningResourceVersions.version)));
  });

  api.post("/learning-resources/:id/access", zValidator("json", z.object({ type: z.enum(["view", "download"]) })), async (c) => {
    const id = Number(c.req.param("id"));
    const field = c.req.valid("json").type === "download" ? { downloadCount: sql`${learningResources.downloadCount} + 1` } : { viewCount: sql`${learningResources.viewCount} + 1` };
    await db.update(learningResources).set(field).where(eq(learningResources.id, id));
    const updated = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  });

  api.get("/learning-resource-favorites", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const userKey = (session?.email || session?.sub || "").trim().toLowerCase();
    if (!userKey) return c.json([]);
    const rows = await db.select({ resourceId: learningResourceFavorites.resourceId }).from(learningResourceFavorites).where(eq(learningResourceFavorites.userKey, userKey));
    return c.json(rows.map((row) => row.resourceId));
  });

  api.get("/learning-resource-collections", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const ownerKey = (session?.email || session?.sub || "").trim().toLowerCase();
    if (!ownerKey) return c.json([]);
    const rows = await db.select().from(learningResourceCollections).where(eq(learningResourceCollections.ownerKey, ownerKey)).orderBy(desc(learningResourceCollections.id));
    const result = await Promise.all(rows.map(async (row) => ({ ...row, resourceIds: (await db.select({ resourceId: learningResourceCollectionItems.resourceId }).from(learningResourceCollectionItems).where(eq(learningResourceCollectionItems.collectionId, row.id))).map((item) => item.resourceId) })));
    return c.json(result);
  });

  api.post("/learning-resource-collections", zValidator("json", z.object({ name: z.string().trim().min(2).max(80) })), async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const ownerKey = (session?.email || session?.sub || "").trim().toLowerCase();
    if (!ownerKey) return c.json({ error: "Silakan masuk untuk membuat koleksi." }, 401);
    const [created] = await db.insert(learningResourceCollections).values({ ownerKey, name: c.req.valid("json").name }).returning();
    return c.json({ ...created, resourceIds: [] }, 201);
  });

  api.post("/learning-resource-collections/:id/items/:resourceId/toggle", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const ownerKey = (session?.email || session?.sub || "").trim().toLowerCase();
    if (!ownerKey) return c.json({ error: "Silakan masuk terlebih dahulu." }, 401);
    const collectionId = Number(c.req.param("id")); const resourceId = Number(c.req.param("resourceId"));
    const collection = await db.select().from(learningResourceCollections).where(and(eq(learningResourceCollections.id, collectionId), eq(learningResourceCollections.ownerKey, ownerKey))).get();
    if (!collection) return c.json({ error: "Koleksi tidak ditemukan." }, 404);
    const existing = await db.select().from(learningResourceCollectionItems).where(and(eq(learningResourceCollectionItems.collectionId, collectionId), eq(learningResourceCollectionItems.resourceId, resourceId))).get();
    if (existing) { await db.delete(learningResourceCollectionItems).where(eq(learningResourceCollectionItems.id, existing.id)); return c.json({ active: false }); }
    await db.insert(learningResourceCollectionItems).values({ collectionId, resourceId }); return c.json({ active: true });
  });

  api.post("/learning-resource-favorites/:id/toggle", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const userKey = (session?.email || session?.sub || "").trim().toLowerCase();
    if (!userKey) return c.json({ error: "Silakan masuk untuk menyimpan materi." }, 401);
    const resourceId = Number(c.req.param("id"));
    const existing = await db.select().from(learningResourceFavorites).where(and(eq(learningResourceFavorites.resourceId, resourceId), eq(learningResourceFavorites.userKey, userKey))).get();
    if (existing) { await db.delete(learningResourceFavorites).where(eq(learningResourceFavorites.id, existing.id)); return c.json({ active: false }); }
    await db.insert(learningResourceFavorites).values({ resourceId, userKey });
    return c.json({ active: true });
  });

  api.get("/learning-resource-ratings", async (c) => {
    const resourceId = Number(c.req.query("resourceId") || 0);
    if (!resourceId) return c.json({ average: 0, count: 0, myRating: 0 });
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const userKey = (session?.email || session?.sub || "").trim().toLowerCase();
    const rows = await db.select().from(learningResourceRatings).where(eq(learningResourceRatings.resourceId, resourceId));
    return c.json({ average: rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : 0, count: rows.length, myRating: rows.find((row) => row.userKey === userKey)?.rating || 0 });
  });

  api.post("/learning-resource-ratings", zValidator("json", z.object({ resourceId: z.number().int().positive(), rating: z.number().int().min(1).max(5) })), async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const userKey = (session?.email || session?.sub || "").trim().toLowerCase();
    if (!userKey) return c.json({ error: "Silakan masuk untuk memberi rating." }, 401);
    const { resourceId, rating } = c.req.valid("json");
    await db.insert(learningResourceRatings).values({ resourceId, userKey, rating }).onConflictDoUpdate({ target: [learningResourceRatings.resourceId, learningResourceRatings.userKey], set: { rating } });
    const rows = await db.select().from(learningResourceRatings).where(eq(learningResourceRatings.resourceId, resourceId));
    return c.json({ average: rows.reduce((sum, row) => sum + row.rating, 0) / rows.length, count: rows.length, myRating: rating });
  });

  api.post("/learning-resources/:id/reports", zValidator("json", z.object({ reason: z.string().trim().min(3).max(120), detail: z.string().trim().max(1000).default("") })), async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const reporterKey = (session?.email || session?.sub || "").trim().toLowerCase();
    if (!reporterKey) return c.json({ error: "Silakan masuk untuk melaporkan materi." }, 401);
    const resourceId = Number(c.req.param("id"));
    const resource = await db.select({ id: learningResources.id }).from(learningResources).where(eq(learningResources.id, resourceId)).get();
    if (!resource) return c.json({ error: "Materi tidak ditemukan." }, 404);
    const duplicate = await db.select({ id: learningResourceReports.id }).from(learningResourceReports).where(and(eq(learningResourceReports.resourceId, resourceId), eq(learningResourceReports.reporterKey, reporterKey), eq(learningResourceReports.status, "open"))).get();
    if (duplicate) return c.json({ error: "Laporan Anda untuk materi ini masih ditinjau." }, 409);
    const [report] = await db.insert(learningResourceReports).values({ resourceId, reporterKey, ...c.req.valid("json") }).returning();
    return c.json(report, 201);
  });

  api.get("/admin/learning-resource-reports", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const roles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !isReviewer(roles)) return c.json({ error: "Forbidden" }, 403);
    const status = c.req.query("status");
    const rows = await db.select().from(learningResourceReports).where((REPORT_STATUS_VALUES as readonly string[]).includes(status || "") ? eq(learningResourceReports.status, status as "open" | "resolved" | "dismissed") : undefined).orderBy(desc(learningResourceReports.createdAt));
    return c.json(rows);
  });

  api.post("/admin/learning-resource-reports/:id/review", zValidator("json", z.object({ status: z.enum(["resolved", "dismissed"] as const) })), async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const roles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !isReviewer(roles)) return c.json({ error: "Forbidden" }, 403);
    const id = Number(c.req.param("id"));
    await db.update(learningResourceReports).set({ status: c.req.valid("json").status, reviewedBy: (session.email || session.name || "").trim(), reviewedAt: new Date().toISOString() }).where(eq(learningResourceReports.id, id));
    const updated = await db.select().from(learningResourceReports).where(eq(learningResourceReports.id, id)).get();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  });

  api.post("/admin/learning-resources/:id/archive", zValidator("json", z.object({ reason: z.string().trim().max(1000).default("") })), async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const roles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !isReviewer(roles)) return c.json({ error: "Forbidden" }, 403);
    const id = Number(c.req.param("id"));
    await db.update(learningResources).set({ archivedAt: new Date().toISOString(), archiveReason: c.req.valid("json").reason }).where(eq(learningResources.id, id));
    const updated = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  });

  api.post("/admin/learning-resources/:id/unarchive", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const roles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !isReviewer(roles)) return c.json({ error: "Forbidden" }, 403);
    const id = Number(c.req.param("id"));
    await db.update(learningResources).set({ archivedAt: "", archiveReason: "" }).where(eq(learningResources.id, id));
    const updated = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  });

  api.post("/learning-resources/:id/restore/:versionId", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const roles = (session.roles?.length ? session.roles : session.role ? [session.role] : []) as RoleValue[];
    const email = (session.email || "").trim().toLowerCase();
    const id = Number(c.req.param("id"));
    const resource = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
    if (!resource) return c.json({ error: "Not found" }, 404);
    if (!isReviewer(roles) && resource.createdByEmail.trim().toLowerCase() !== email) return c.json({ error: "Hanya kontributor atau reviewer yang dapat memulihkan versi." }, 403);
    const version = await db.select().from(learningResourceVersions).where(and(eq(learningResourceVersions.id, Number(c.req.param("versionId"))), eq(learningResourceVersions.resourceId, id))).get();
    if (!version) return c.json({ error: "Versi tidak ditemukan." }, 404);
    const latest = await db.select({ version: learningResourceVersions.version }).from(learningResourceVersions).where(eq(learningResourceVersions.resourceId, id)).orderBy(desc(learningResourceVersions.version)).get();
    await db.update(learningResources).set({ resourceUrl: version.resourceUrl, fileName: version.fileName, storageKey: version.storageKey, publishStatus: "pending", reviewedBy: "", reviewedAt: "", reviewNote: "" }).where(eq(learningResources.id, id));
    await db.insert(learningResourceVersions).values({ resourceId: id, version: (latest?.version || 0) + 1, resourceUrl: version.resourceUrl, fileName: version.fileName, storageKey: version.storageKey, changeNote: `Dipulihkan dari versi ${version.version}`, createdByEmail: email || resource.createdByEmail });
    const updated = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
    return c.json(updated);
  });

  api.get("/admin/learning-resources/:id/link-check", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const roles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !isReviewer(roles)) return c.json({ error: "Forbidden" }, 403);
    const resource = await db.select().from(learningResources).where(eq(learningResources.id, Number(c.req.param("id")))).get();
    if (!resource) return c.json({ error: "Not found" }, 404);
    const result = await checkLearningResourceLink(resource.resourceUrl);
    const checkedAt = new Date().toISOString();
    await db.update(learningResources).set({ linkCheckedAt: checkedAt, linkCheckStatus: result.status, linkCheckError: result.error || "" }).where(eq(learningResources.id, resource.id));
    return c.json({ ok: result.status === "ok", status: result.httpStatus, error: result.error, checkedAt });
  });

  api.get("/notifications", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const recipientKey = (session?.email || session?.sub || "").trim().toLowerCase();
    if (!recipientKey) return c.json([]);
    return c.json(await db.select().from(userNotifications).where(eq(userNotifications.recipientKey, recipientKey)).orderBy(desc(userNotifications.createdAt), desc(userNotifications.id)).limit(30));
  });

  api.post("/notifications/:id/read", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const recipientKey = (session?.email || session?.sub || "").trim().toLowerCase();
    if (!recipientKey) return c.json({ error: "Unauthorized" }, 401);
    await db.update(userNotifications).set({ readAt: new Date().toISOString() }).where(and(eq(userNotifications.id, Number(c.req.param("id"))), eq(userNotifications.recipientKey, recipientKey)));
    return c.json({ ok: true });
  });

  api.delete("/admin/learning-resources/:id", async (c) => {
    const env = getEnv();
    const session = await getSession(c, env.sessionSecret);
    const sessionRoles = (session?.roles?.length ? session.roles : session?.role ? [session.role] : []) as RoleValue[];
    if (!session || !sessionRoles.includes("admin")) return c.json({ error: "Forbidden" }, 403);
    const id = Number(c.req.param("id"));
    const existing = await db.select().from(learningResources).where(eq(learningResources.id, id)).get();
    if (!existing) return c.json({ error: "Not found" }, 404);
    const versions = await db.select({ storageKey: learningResourceVersions.storageKey }).from(learningResourceVersions).where(eq(learningResourceVersions.resourceId, id));
    await db.transaction(async (tx) => {
      await tx.delete(comments).where(and(eq(comments.targetType, "learning_resource"), eq(comments.targetId, id)));
      await tx.delete(learningResourceFavorites).where(eq(learningResourceFavorites.resourceId, id));
      await tx.delete(learningResourceRatings).where(eq(learningResourceRatings.resourceId, id));
      await tx.delete(learningResourceReports).where(eq(learningResourceReports.resourceId, id));
      await tx.delete(learningResourceVersions).where(eq(learningResourceVersions.resourceId, id));
      await tx.delete(learningResources).where(eq(learningResources.id, id));
    });
    if (env.s3Endpoint && env.s3AccessKey && env.s3SecretKey && env.s3Bucket) {
      const keys = new Set([existing.storageKey, existing.thumbnailStorageKey, ...versions.map((version) => version.storageKey)].filter(Boolean));
      const s3 = new S3Client({ endpoint: env.s3Endpoint, accessKeyId: env.s3AccessKey, secretAccessKey: env.s3SecretKey, bucket: env.s3Bucket, region: env.s3Region, virtualHostedStyle: !env.s3ForcePathStyle });
      await Promise.all(Array.from(keys).map((key) => s3.file(key).delete().catch((error) => console.warn("delete_resource_object_error:", String(error)))));
    }
    return c.json({ ok: true, id });
  });

  return api;
}
