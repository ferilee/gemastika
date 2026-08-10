import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import path from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { ensureRuntimeSchema } from "../db/ensure";
import { apiRouter } from "./api";
import { setSession } from "../auth/session";
import { googleAuthRouter } from "../auth/google";
import { agendas, learningResources, members, news, portfolios } from "../db/schema";

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
  const [learningResource] = await db
    .insert(learningResources)
    .values({
      title: "Modul Ajar Aljabar",
      category: "RPP / Modul Ajar",
      description: "Modul ajar aljabar untuk penguatan konsep kelas sepuluh.",
      phase: "Fase E",
      grade: "Kelas X",
      topic: "Aljabar",
      semester: "Ganjil",
      curriculum: "Kurikulum Merdeka",
      sourceType: "link",
      resourceUrl: "https://example.test/modul-aljabar"
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
  app.route("/", googleAuthRouter({ webOrigin: "http://localhost:5173", googleClientId: "", googleClientSecret: "", googleRedirectUri: "", sessionSecret: "test-secret", adminEmails: ["admin@test.local"], db }));

  return { app, db, seed: { agenda, newsRow, portfolio, learningResource } };
}

async function getCookie(app: Hono, kind: LoginKind) {
  const res = await app.request(`http://local/__test/login/${kind}`);
  const setCookie = res.headers.get("set-cookie") || "";
  return setCookie.split(";")[0];
}

describe("api endpoints", () => {
  let app: Hono;
  let db: Awaited<ReturnType<typeof buildTestApp>>["db"];
  let seed: Awaited<ReturnType<typeof buildTestApp>>["seed"];

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    db = ctx.db;
    seed = ctx.seed;
  });

  it("health + members endpoints", async () => {
    expect((await app.request("http://local/api/health")).status).toBe(200);
    const membersRes = await app.request("http://local/api/members");
    expect(membersRes.status).toBe(200);
    const byIdRes = await app.request("http://local/api/members/1");
    expect(byIdRes.status).toBe(200);
  });

  it("refreshes session roles from the database", async () => {
    const pengurusCookie = await getCookie(app, "pengurus");
    await db.update(members).set({ role: "anggota", roles: "anggota" }).where(eq(members.email, "pengurus@test.local"));
    const response = await app.request("http://local/api/auth/me", { headers: { cookie: pengurusCookie } });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { user: { roles: string[]; role: string } };
    expect(payload.user.role).toBe("anggota");
    expect(payload.user.roles).toEqual(["anggota"]);
  });

  it("upload endpoint auth guard", async () => {
    const form = new FormData();
    form.append("scope", "news");
    form.append("file", new File(["abc"], "x.png", { type: "image/png" }));
    expect((await app.request("http://local/api/uploads/image", { method: "POST", body: form })).status).toBe(401);
    const resourceForm = new FormData();
    resourceForm.append("file", new File(["abc"], "materi.pdf", { type: "application/pdf" }));
    expect((await app.request("http://local/api/uploads/resource", { method: "POST", body: resourceForm })).status).toBe(401);
    expect((await app.request("http://local/api/admin/rustfs-check")).status).toBe(403);
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
    expect((await app.request(`http://local/api/news/${createdNews.id}`)).status).toBe(404);
    expect((await app.request(`http://local/api/news/${createdNews.id}`, { headers: { cookie: anggotaCookie } })).status).toBe(200);
    const pengurusCookie = await getCookie(app, "pengurus");
    const adminCookie = await getCookie(app, "admin");
    expect((await app.request(`http://local/api/news/${createdNews.id}`, { headers: { cookie: pengurusCookie } })).status).toBe(200);
    const editPayload = {
      title: "Berita baru diedit",
      category: "Umum",
      author: "Anggota",
      date: "2026-01-03",
      summary: "Ringkasan berita yang sudah diperbarui dan cukup panjang",
      content: "Konten berita yang sudah diperbarui dan cukup panjang untuk lolos validasi",
      imageUrl: "",
      documentUrl: ""
    };
    expect(
      (
        await app.request(`http://local/api/news/${createdNews.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie: pengurusCookie },
          body: JSON.stringify(editPayload)
        })
      ).status
    ).toBe(403);
    expect(
      (
        await app.request(`http://local/api/news/${createdNews.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie: adminCookie },
          body: JSON.stringify(editPayload)
        })
      ).status
    ).toBe(403);
    const editRes = await app.request(`http://local/api/news/${createdNews.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: anggotaCookie },
      body: JSON.stringify(editPayload)
    });
    expect(editRes.status).toBe(200);
    const editedNews = (await editRes.json()) as { title: string; publishStatus: string };
    expect(editedNews.title).toBe("Berita baru diedit");
    expect(editedNews.publishStatus).toBe("pending");
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
    expect((await app.request(`http://local/api/admin/news/${createdNews.id}`, { method: "DELETE", headers: { cookie: pengurusCookie } })).status).toBe(403);
    expect((await app.request(`http://local/api/admin/news/${createdNews.id}`, { method: "DELETE", headers: { cookie: adminCookie } })).status).toBe(200);
    expect((await app.request(`http://local/api/news/${createdNews.id}`)).status).toBe(404);

    expect((await app.request(`http://local/api/admin/portfolios/${seed.portfolio.id}`, { method: "DELETE", headers: { cookie: pengurusCookie } })).status).toBe(403);
    expect((await app.request(`http://local/api/admin/portfolios/${seed.portfolio.id}`, { method: "DELETE", headers: { cookie: adminCookie } })).status).toBe(200);
    const afterDeletePortfolios = await app.request("http://local/api/portfolios?limit=10");
    const rows = (await afterDeletePortfolios.json()) as Array<{ id: number }>;
    expect(rows.some((row) => row.id === seed.portfolio.id)).toBe(false);
  });

  it("learning resource endpoints", async () => {
    expect((await app.request("http://local/api/learning-resources")).status).toBe(200);
    expect((await app.request(`http://local/api/learning-resources/${seed.learningResource.id}`)).status).toBe(200);
    expect((await app.request("http://local/api/admin/learning-resources/operations")).status).toBe(403);
    const initialAdminCookie = await getCookie(app, "admin");
    const operationsRes = await app.request("http://local/api/admin/learning-resources/operations", { headers: { cookie: initialAdminCookie } });
    expect(operationsRes.status).toBe(200);
    expect(((await operationsRes.json()) as { overview: { total: number } }).overview.total).toBeGreaterThan(0);
    expect((await app.request("http://local/api/notifications/review-queue", { headers: { cookie: initialAdminCookie } })).status).toBe(200);
    const anggotaCookie = await getCookie(app, "anggota");
    expect((await app.request("http://local/api/member-activity/visit", { method: "POST" })).status).toBe(401);
    expect((await app.request("http://local/api/member-activity/visit", { method: "POST", headers: { cookie: anggotaCookie } })).status).toBe(200);
    expect((await app.request("http://local/api/member-activity/me")).status).toBe(401);
    const myActivityRes = await app.request("http://local/api/member-activity/me", { headers: { cookie: anggotaCookie } });
    expect(myActivityRes.status).toBe(200);
    expect(((await myActivityRes.json()) as { activeDays: number }).activeDays).toBeGreaterThan(0);
    const guestActivityCookie = await getCookie(app, "guest");
    expect((await app.request("http://local/api/member-activity/visit", { method: "POST", headers: { cookie: guestActivityCookie } })).status).toBe(403);
    expect((await app.request("http://local/api/member-activity/me", { headers: { cookie: guestActivityCookie } })).status).toBe(403);
    expect((await app.request("http://local/api/admin/member-activity")).status).toBe(403);
    const pengurusActivityCookie = await getCookie(app, "pengurus");
    const memberActivityRes = await app.request("http://local/api/admin/member-activity?period=30", { headers: { cookie: pengurusActivityCookie } });
    expect(memberActivityRes.status).toBe(200);
    expect(((await memberActivityRes.json()) as { members: Array<{ visits: { daysActive: number } }> }).members.some((item) => item.visits.daysActive > 0)).toBe(true);
    const resourcePayload = {
      title: "LKPD Persamaan Kuadrat",
      category: "LKPD Interaktif",
      description: "LKPD interaktif untuk eksplorasi persamaan kuadrat di kelas sepuluh.",
      phase: "Fase E",
      grade: "Kelas X",
      topic: "Persamaan Kuadrat",
      semester: "Genap",
      curriculum: "Kurikulum Merdeka",
      sourceType: "link",
      resourceUrl: "https://example.test/lkpd-kuadrat",
      fileName: "",
      thumbnailUrl: ""
    };
    const createRes = await app.request("http://local/api/learning-resources", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: anggotaCookie },
      body: JSON.stringify(resourcePayload)
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: number; publishStatus: string };
    expect(created.publishStatus).toBe("pending");
    expect((await app.request(`http://local/api/learning-resources/${created.id}/versions`)).status).toBe(200);
    expect(
      (
        await app.request(`http://local/api/learning-resources/${created.id}/access`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "view" })
        })
      ).status
    ).toBe(200);
    expect((await app.request(`http://local/api/learning-resource-favorites/${created.id}/toggle`, { method: "POST" })).status).toBe(401);
    expect((await app.request(`http://local/api/learning-resource-favorites/${created.id}/toggle`, { method: "POST", headers: { cookie: anggotaCookie } })).status).toBe(200);
    expect((await app.request(`http://local/api/learning-resource-favorites`, { headers: { cookie: anggotaCookie } })).status).toBe(200);
    expect((await app.request("http://local/api/learning-resource-collections")).status).toBe(200);
    const collectionRes = await app.request("http://local/api/learning-resource-collections", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: anggotaCookie },
      body: JSON.stringify({ name: "Materi Semester Genap" })
    });
    expect(collectionRes.status).toBe(201);
    const collection = (await collectionRes.json()) as { id: number };
    expect((await app.request(`http://local/api/learning-resource-collections/${collection.id}/items/${created.id}/toggle`, { method: "POST", headers: { cookie: anggotaCookie } })).status).toBe(200);
    expect((await app.request("http://local/api/learning-resource-collections", { headers: { cookie: anggotaCookie } })).status).toBe(200);
    expect((await app.request(`http://local/api/learning-resource-ratings?resourceId=${created.id}`)).status).toBe(200);
    expect(
      (
        await app.request("http://local/api/learning-resource-ratings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: anggotaCookie },
          body: JSON.stringify({ resourceId: created.id, rating: 5 })
        })
      ).status
    ).toBe(200);
    expect(
      (
        await app.request("http://local/api/comments", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: anggotaCookie },
          body: JSON.stringify({ targetType: "learning_resource", targetId: created.id, content: "Materi sangat membantu" })
        })
      ).status
    ).toBe(201);
    expect((await app.request(`http://local/api/learning-resources/${created.id}`)).status).toBe(404);
    expect((await app.request(`http://local/api/learning-resources/${created.id}`, { headers: { cookie: anggotaCookie } })).status).toBe(200);

    const pengurusCookie = await getCookie(app, "pengurus");
    expect((await app.request(`http://local/api/learning-resources/${created.id}`, { headers: { cookie: pengurusCookie } })).status).toBe(200);
    expect(
      (
        await app.request(`http://local/api/learning-resources/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie: pengurusCookie },
          body: JSON.stringify(resourcePayload)
        })
      ).status
    ).toBe(403);
    expect(
      (
        await app.request(`http://local/api/admin/learning-resources/${created.id}/review`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: pengurusCookie },
          body: JSON.stringify({ status: "approved", note: "Materi sudah sesuai dan dapat dipublikasikan." })
        })
      ).status
    ).toBe(200);
    expect((await app.request("http://local/api/notifications", { headers: { cookie: anggotaCookie } })).status).toBe(200);
    expect((await app.request(`http://local/api/learning-resources/${created.id}/reports`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Tautan rusak" }) })).status).toBe(401);
    const reportRes = await app.request(`http://local/api/learning-resources/${created.id}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: anggotaCookie },
      body: JSON.stringify({ reason: "Tautan perlu diperiksa", detail: "Halaman sumber tidak dapat dibuka." })
    });
    expect(reportRes.status).toBe(201);
    const report = (await reportRes.json()) as { id: number };
    expect((await app.request("http://local/api/admin/learning-resource-reports")).status).toBe(403);
    expect((await app.request("http://local/api/admin/learning-resource-reports", { headers: { cookie: pengurusCookie } })).status).toBe(200);
    expect((await app.request(`http://local/api/admin/learning-resource-reports/${report.id}/review`, { method: "POST", headers: { "content-type": "application/json", cookie: pengurusCookie }, body: JSON.stringify({ status: "resolved" }) })).status).toBe(200);
    expect((await app.request(`http://local/api/admin/learning-resources/${created.id}/link-check`, { headers: { cookie: anggotaCookie } })).status).toBe(403);
    expect((await app.request(`http://local/api/admin/learning-resources/${created.id}/archive`, { method: "POST", headers: { "content-type": "application/json", cookie: anggotaCookie }, body: JSON.stringify({ reason: "Duplikat" }) })).status).toBe(403);
    expect((await app.request(`http://local/api/admin/learning-resources/${created.id}/archive`, { method: "POST", headers: { "content-type": "application/json", cookie: pengurusCookie }, body: JSON.stringify({ reason: "Perlu perbaikan" }) })).status).toBe(200);
    expect((await app.request(`http://local/api/learning-resources/${created.id}`)).status).toBe(404);
    expect((await app.request(`http://local/api/admin/learning-resources/${created.id}/unarchive`, { method: "POST", headers: { cookie: pengurusCookie } })).status).toBe(200);
    const editForVersion = await app.request(`http://local/api/learning-resources/${created.id}`, { method: "PATCH", headers: { "content-type": "application/json", cookie: anggotaCookie }, body: JSON.stringify({ ...resourcePayload, title: "LKPD Persamaan Kuadrat revisi", changeNote: "Perbaikan instruksi" }) });
    expect(editForVersion.status).toBe(200);
    const guestCookie = await getCookie(app, "guest");
    expect((await app.request(`http://local/api/learning-resources/${created.id}/restore/1`, { method: "POST", headers: { cookie: guestCookie } })).status).toBe(403);
    expect((await app.request(`http://local/api/learning-resources/${created.id}/restore/1`, { method: "POST", headers: { cookie: anggotaCookie } })).status).toBe(200);
    const adminCookie = await getCookie(app, "admin");
    expect((await app.request(`http://local/api/admin/learning-resources/${created.id}`, { method: "DELETE", headers: { cookie: pengurusCookie } })).status).toBe(403);
    expect((await app.request(`http://local/api/admin/learning-resources/${created.id}`, { method: "DELETE", headers: { cookie: adminCookie } })).status).toBe(200);
    expect((await app.request(`http://local/api/learning-resources/${created.id}`)).status).toBe(404);
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
