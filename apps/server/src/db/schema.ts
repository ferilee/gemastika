import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const members = sqliteTable("members", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  school: text("school").notNull().default("-"),
  wa: text("wa").notNull().default(""),
  telegram: text("telegram").notNull().default(""),
  photoUrl: text("photo_url").notNull().default(""),
  profileUrl: text("profile_url").notNull().default(""),
  role: text("role", { enum: ["admin", "pengurus", "anggota"] }).notNull().default("anggota"),
  // Comma-separated roles for multirole (e.g. "admin,pengurus"). When empty, fallback to `role`.
  roles: text("roles").notNull().default(""),
  membershipStatus: text("membership_status", { enum: ["pending", "approved", "rejected"] }).notNull().default("approved"),
  approvedAt: text("approved_at").notNull().default(""),
  newMemberBadge: integer("new_member_badge", { mode: "number" }).notNull().default(0),
  newMemberBadgeSeen: integer("new_member_badge_seen", { mode: "number" }).notNull().default(0),
  xp: integer("xp", { mode: "number" }).notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
});

export const boardMembers = sqliteTable("board_members", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  memberId: integer("member_id", { mode: "number" }).notNull().default(0),
  name: text("name").notNull(),
  title: text("title").notNull(),
  contact: text("contact").notNull().default(""),
  sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
});

export const agendas = sqliteTable("agendas", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  date: text("date").notNull(), // ISO date, ex: 2026-04-08
  time: text("time").notNull().default(""),
  location: text("location").notNull().default(""),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
});

export const attendances = sqliteTable(
  "attendances",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    agendaId: integer("agenda_id", { mode: "number" })
      .notNull()
      .references(() => agendas.id, { onDelete: "cascade" }),
    memberId: integer("member_id", { mode: "number" })
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    xpAwarded: integer("xp_awarded", { mode: "number" }).notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    agendaMemberUnique: uniqueIndex("attendances_agenda_member_unique").on(t.agendaId, t.memberId)
  })
);

export const news = sqliteTable("news", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull().default("Umum"),
  author: text("author").notNull().default("Admin"),
  date: text("date").notNull(), // ISO date
  imageUrl: text("image_url").notNull().default(""),
  summary: text("summary").notNull().default(""),
  content: text("content").notNull().default(""),
  documentUrl: text("document_url").notNull().default(""),
  createdByEmail: text("created_by_email").notNull().default(""),
  publishStatus: text("publish_status", { enum: ["pending", "approved", "rejected"] }).notNull().default("approved"),
  reviewedBy: text("reviewed_by").notNull().default(""),
  reviewedAt: text("reviewed_at").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
});

export const portfolios = sqliteTable("portfolios", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  teacherName: text("teacher_name").notNull(),
  school: text("school").notNull().default("-"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  link: text("link").notNull().default(""),
  photoUrl: text("photo_url").notNull().default(""),
  createdByEmail: text("created_by_email").notNull().default(""),
  publishStatus: text("publish_status", { enum: ["pending", "approved", "rejected"] }).notNull().default("approved"),
  reviewedBy: text("reviewed_by").notNull().default(""),
  reviewedAt: text("reviewed_at").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
});

export const homeQuickLinks = sqliteTable("home_quick_links", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  href: text("href").notNull().default("/"),
  sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
});

export const homeSettings = sqliteTable("home_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default("")
});

export const comments = sqliteTable("comments", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  targetType: text("target_type", { enum: ["news", "portfolio"] }).notNull(),
  targetId: integer("target_id", { mode: "number" }).notNull(),
  parentId: integer("parent_id", { mode: "number" }),
  authorName: text("author_name").notNull().default("Guest"),
  authorEmail: text("author_email").notNull().default(""),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
});

export const reactions = sqliteTable(
  "reactions",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    targetType: text("target_type", { enum: ["news", "portfolio"] }).notNull(),
    targetId: integer("target_id", { mode: "number" }).notNull(),
    reaction: text("reaction").notNull(),
    userKey: text("user_key").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    targetReactionUserUnique: uniqueIndex("reactions_target_reaction_user_unique").on(t.targetType, t.targetId, t.reaction, t.userKey)
  })
);

export const portfolioRatings = sqliteTable(
  "portfolio_ratings",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    portfolioId: integer("portfolio_id", { mode: "number" }).notNull(),
    userKey: text("user_key").notNull(),
    rating: integer("rating", { mode: "number" }).notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`)
  },
  (t) => ({
    portfolioUserUnique: uniqueIndex("portfolio_ratings_portfolio_user_unique").on(t.portfolioId, t.userKey)
  })
);
