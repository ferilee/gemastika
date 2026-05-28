import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import path from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createDb } from "../db/client";
import { ensureRuntimeSchema } from "../db/ensure";
import { apiRouter } from "./api";
import { setSession } from "../auth/session";
import { agendas, members, news, portfolios } from "../db/schema";

type LoginKind = "admin" | "pengurus" | "anggota" | "guest";

function setupEnv() {
  process.env.SESSION_SECRET = "test-secret";
  process.env.WEB_ORIGIN = "http://localhost:5173";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.ADMIN_EMAILS = "admin@test.local";
}

async function buildTestApp() {
  setupEnv();
  const db = createDb(":memory:");
  const migrationsFolder = path.resolve(import.meta.dir, "../../drizzle");
  migrate(db, { migrationsFolder });
  await ensureRuntimeSchema(db);

  await db.insert(members).values([
    {
      name: "Admin User",
      email: "admin@test.local",
      school: "SMK A",
      wa: "08111",
      telegram: "@admin",
      role: "admin",
      roles: "admin,pengurus,anggota",
      membershipStatus: "approved"
    },
    {
      name: "Pengurus User",
      email: "pengurus@test.local",
      school: "SMK B",
      wa: "08222",
      telegram: "@pengurus",
      role: "pengurus",
      roles: "pengurus,anggota",
      membershipStatus: "approved"
    },
    {
      name: "Anggota User",
      email: "anggota@test.local",
      school: "SMK C",
      wa: "08333",
      telegram: "@anggota",
      role: "anggota",
      roles: "anggota",
      membershipStatus: "approved"
    },
    {
      name: "Guest User",
      email: "guest@test.local",
      school: "SMK D",
      wa: "08444",
      telegram: "@guest",
      role: "anggota",
      roles: "anggota",
      membershipStatus: "pending"
    }
  ]);

  const [agenda] = await db
    .insert(agendas)
    .values({ title: "Agenda 1", date: "2026-01-01", time: "10:00", location: "Hall", description: "Desc" })
    .returning();
  const [newsRow] = await db
    .insert(news)
    .values({
      title: "Berita 1",
      category: "Pengumuman",
      author: "Admin",
      date: "2026-01-01",
      summary: "Ringkasan berita yang cukup panjang",
      content: "Isi berita yang cukup panjang untuk validasi endpoint."
    })
    .returning();
  const [portfolio] = await db
    .insert(portfolios)
    .values({
      teacherName: "Anggota User",
      school: "SMK C",
      title: "Karya 1",
      description: "Deskripsi karya yang cukup panjang untuk validasi endpoint."
    })
    .returning();

  const app = new Hono();
  app.get("/__test/login/:kind", async (c) => {
    const kind = c.req.param("kind") as LoginKind;
    const base = {
      sub: `${kind}-sub`,
      email: `${kind}@test.local`,
      name: `${kind} user`
    };
    if (kind === "admin") {
      await setSession(c, { ...base, role: "admin", roles: ["admin", "pengurus", "anggota"], membershipStatus: "approved" }, { secret: "test-secret", secure: false });
    } else if (kind === "pengurus") {
      await setSession(c, { ...base, role: "pengurus", roles: ["pengurus", "anggota"], membershipStatus: "approved" }, { secret: "test-secret", secure: false });
    } else if (kind === "anggota") {
      await setSession(c, { ...base, role: "anggota", roles: ["anggota"], membershipStatus: "approved" }, { secret: "test-secret", secure: false });
    } else {
      await setSession(c, { ...base, role: "anggota", roles: ["anggota"], membershipStatus: "pending", isGuest: true }, { secret: "test-secret", secure: false });
    }
    return c.json({ ok: true });
  });
  app.route("/", apiRouter(db));

  return { app, seed: { agenda, newsRow, portfolio } };
}

async function getCookie(app: Hono, kind: LoginKind) {
  const res = await app.request(`http://local/__test/login/${kind}`);
  const setCookie = res.headers.get("set-cookie") || "";
  return setCookie.split(";")[0];
}

describe("api endpoints", () => {
  let app: Hono;
  let seed: Awaited<ReturnType<typeof buildTestApp>>["seed"];

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    seed = ctx.seed;
  });

  it("health + members endpoints", async () => {
    expect((await app.request("http://local/api/health")).status).toBe(200);
    const membersRes = await app.request("http://local/api/members");
    expect(membersRes.status).toBe(200);
    const byIdRes = await app.request("http://local/api/members/1");
    expect(byIdRes.status).toBe(200);
  });

  it("admin member management endpoints", async () => {
    expect((await app.request("http://local/api/admin/members/2/roles", { method: "POST", body: JSON.stringify({ roles: ["anggota"] }), headers: { "content-type": "application/json" } })).status).toBe(403);
    const adminCookie = await getCookie(app, "admin");
    expect(
      (
        await app.request("http://local/api/admin/members/2/roles", {
          method: "POST",
          body: JSON.stringify({ roles: ["anggota", "pengurus"] }),
          headers: { "content-type": "application/json", cookie: adminCookie }
        })
      ).status
    ).toBe(200);
    expect(
      (
        await app.request("http://local/api/admin/members/4/approval", {
          method: "POST",
          body: JSON.stringify({ status: "approved" }),
          headers: { "content-type": "application/json", cookie: adminCookie }
        })
      ).status
    ).toBe(200);
    expect((await app.request("http://local/api/admin/members/3", { method: "DELETE", headers: { cookie: adminCookie } })).status).toBe(200);
  });

  it("profile endpoints", async () => {
    expect((await app.request("http://local/api/profile/me")).status).toBe(401);
    const anggotaCookie = await getCookie(app, "anggota");
    expect((await app.request("http://local/api/profile/me", { headers: { cookie: anggotaCookie } })).status).toBe(200);
    expect(
      (
        await app.request("http://local/api/profile/me", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: anggotaCookie },
          body: JSON.stringify({
            name: "Anggota User",
            school: "SMK C",
            wa: "081234567890",
            telegram: "",
            photoUrl: "",
            profileUrl: ""
          })
        })
      ).status
    ).toBe(200);
    expect((await app.request("http://local/api/profile/me/badge-ack", { method: "POST", headers: { cookie: anggotaCookie } })).status).toBe(200);
  });

  it("schools + home content endpoints", async () => {
    expect((await app.request("http://local/api/schools?q=s")).status).toBe(200);
    expect((await app.request("http://local/api/home-content")).status).toBe(200);
    const adminCookie = await getCookie(app, "admin");
    expect(
      (
        await app.request("http://local/api/admin/home-content", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: adminCookie },
          body: JSON.stringify({
            quickLinks: [{ title: "Akses X", subtitle: "Sub X", href: "/portofolio" }],
            quote: { text: "Quote content panjang", author: "Author X" }
          })
        })
      ).status
    ).toBe(200);
  });

  it("agenda + board endpoints", async () => {
    expect((await app.request("http://local/api/agendas")).status).toBe(200);
    expect((await app.request("http://local/api/board")).status).toBe(200);
    const adminCookie = await getCookie(app, "admin");
    expect(
      (
        await app.request("http://local/api/agendas", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: adminCookie },
          body: JSON.stringify({ title: "Agenda 2", date: "2026-01-02", time: "08:00", location: "Ruang 1", description: "Agenda desc" })
        })
      ).status
    ).toBe(201);
    expect(
      (
        await app.request(`http://local/api/agendas/${seed.agenda.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie: adminCookie },
          body: JSON.stringify({ title: "Agenda 1 edit", date: "2026-01-03", time: "09:00", location: "Ruang 2", description: "Edited" })
        })
      ).status
    ).toBe(200);
    expect((await app.request(`http://local/api/agendas/${seed.agenda.id}`, { method: "DELETE", headers: { cookie: adminCookie } })).status).toBe(200);
    expect(
      (
        await app.request("http://local/api/admin/board", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: adminCookie },
          body: JSON.stringify({ items: [{ memberId: 2, title: "Ketua", contact: "WA: 08222" }] })
        })
      ).status
    ).toBe(200);
  });

  it("attendance endpoints", async () => {
    expect((await app.request(`http://local/api/agendas/${seed.agenda.id}/attendance`)).status).toBe(200);
    const anggotaCookie = await getCookie(app, "anggota");
    expect(
      (
        await app.request(`http://local/api/agendas/${seed.agenda.id}/attendance`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: anggotaCookie },
          body: JSON.stringify({})
        })
      ).status
    ).toBe(201);
    const pengurusCookie = await getCookie(app, "pengurus");
    expect(
      (
        await app.request(`http://local/api/agendas/${seed.agenda.id}/attendance`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: pengurusCookie },
          body: JSON.stringify({ memberId: 2, xp: 15 })
        })
      ).status
    ).toBe(201);
  });

  it("news + portfolio endpoints", async () => {
    expect((await app.request("http://local/api/news")).status).toBe(200);
    expect((await app.request(`http://local/api/news/${seed.newsRow.id}`)).status).toBe(200);
    expect((await app.request("http://local/api/portfolios?limit=10")).status).toBe(200);
    const anggotaCookie = await getCookie(app, "anggota");
    const newsCreateRes = await app.request("http://local/api/news", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: anggotaCookie },
      body: JSON.stringify({
        title: "Berita baru",
        category: "Umum",
        author: "Anggota",
        date: "2026-01-02",
        summary: "Ringkasan berita yang cukup panjang untuk lolos validasi",
        content: "Konten berita yang cukup panjang untuk lolos validasi",
        imageUrl: "",
        documentUrl: ""
      })
    });
    expect(newsCreateRes.status).toBe(201);
    const createdNews = (await newsCreateRes.json()) as { id: number };
    expect(
      (
        await app.request("http://local/api/portfolios", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: anggotaCookie },
          body: JSON.stringify({
            teacherName: "Anggota User",
            school: "SMK C",
            title: "Karya Baru",
            description: "Deskripsi karya sangat panjang agar lolos validasi.",
            link: "",
            photoUrl: ""
          })
        })
      ).status
    ).toBe(201);

    expect((await app.request(`http://local/api/admin/news/${createdNews.id}`, { method: "DELETE", headers: { cookie: anggotaCookie } })).status).toBe(403);
    const pengurusCookie = await getCookie(app, "pengurus");
    expect((await app.request(`http://local/api/admin/news/${createdNews.id}`, { method: "DELETE", headers: { cookie: pengurusCookie } })).status).toBe(200);
    expect((await app.request(`http://local/api/news/${createdNews.id}`)).status).toBe(404);
  });

  it("comment + reaction endpoints", async () => {
    expect((await app.request(`http://local/api/comments?targetType=news&targetId=${seed.newsRow.id}`)).status).toBe(200);
    expect(
      (
        await app.request("http://local/api/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetType: "news", targetId: seed.newsRow.id, content: "Komentar" })
        })
      ).status
    ).toBe(401);

    const anggotaCookie = await getCookie(app, "anggota");
    const commentRes = await app.request("http://local/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: anggotaCookie },
      body: JSON.stringify({ targetType: "news", targetId: seed.newsRow.id, content: "Komentar utama" })
    });
    expect(commentRes.status).toBe(201);
    const comment = (await commentRes.json()) as { id: number };
    expect(
      (
        await app.request("http://local/api/comments", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: anggotaCookie },
          body: JSON.stringify({ targetType: "news", targetId: seed.newsRow.id, parentId: comment.id, content: "Balasan komentar" })
        })
      ).status
    ).toBe(201);

    expect((await app.request(`http://local/api/reactions?targetType=news&targetId=${seed.newsRow.id}`)).status).toBe(200);
    expect(
      (
        await app.request("http://local/api/reactions/toggle", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetType: "news", targetId: seed.newsRow.id, reaction: "👍" })
        })
      ).status
    ).toBe(401);
    expect(
      (
        await app.request("http://local/api/reactions/toggle", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: anggotaCookie },
          body: JSON.stringify({ targetType: "news", targetId: seed.newsRow.id, reaction: "👍" })
        })
      ).status
    ).toBe(200);
    expect(
      (
        await app.request("http://local/api/reactions/toggle", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: anggotaCookie },
          body: JSON.stringify({ targetType: "portfolio", targetId: seed.portfolio.id, reaction: "❤️" })
        })
      ).status
    ).toBe(200);
  });
});
