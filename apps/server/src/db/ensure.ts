import { sql } from "drizzle-orm";
import type { Db } from "./client";

type TableInfoRow = {
  name: string;
};

export async function ensureRuntimeSchema(db: Db) {
  const rows = (await db.all(sql`PRAGMA table_info(members)`)) as TableInfoRow[];
  const columns = new Set(rows.map((row) => row.name));

  if (!columns.has("role")) {
    await db.run(sql`ALTER TABLE members ADD role text DEFAULT 'anggota' NOT NULL`);
  }

  if (!columns.has("email")) {
    await db.run(sql`ALTER TABLE members ADD email text DEFAULT '' NOT NULL`);
  }

  if (!columns.has("telegram")) {
    await db.run(sql`ALTER TABLE members ADD telegram text DEFAULT '' NOT NULL`);
  }

  if (!columns.has("roles")) {
    await db.run(sql`ALTER TABLE members ADD roles text DEFAULT '' NOT NULL`);
  }

  if (!columns.has("membership_status")) {
    await db.run(sql`ALTER TABLE members ADD membership_status text DEFAULT 'approved' NOT NULL`);
  }

  if (!columns.has("approved_at")) {
    await db.run(sql`ALTER TABLE members ADD approved_at text DEFAULT '' NOT NULL`);
  }

  if (!columns.has("new_member_badge")) {
    await db.run(sql`ALTER TABLE members ADD new_member_badge integer DEFAULT 0 NOT NULL`);
  }

  if (!columns.has("new_member_badge_seen")) {
    await db.run(sql`ALTER TABLE members ADD new_member_badge_seen integer DEFAULT 0 NOT NULL`);
  }

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS board_members (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      name text NOT NULL,
      title text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      created_at text NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(sql`
    INSERT INTO board_members (name, title, sort_order)
    SELECT 'Ferilee', 'Ketua MGMP', 1
    WHERE NOT EXISTS (SELECT 1 FROM board_members)
  `);

  const boardRows = (await db.all(sql`PRAGMA table_info(board_members)`)) as TableInfoRow[];
  const boardColumns = new Set(boardRows.map((row) => row.name));
  if (!boardColumns.has("member_id")) {
    await db.run(sql`ALTER TABLE board_members ADD member_id integer DEFAULT 0 NOT NULL`);
  }
  if (!boardColumns.has("contact")) {
    await db.run(sql`ALTER TABLE board_members ADD contact text DEFAULT '' NOT NULL`);
  }

  await db.run(sql`
    UPDATE members
    SET role = 'admin',
        email = CASE WHEN email = '' THEN 'the.real.ferilee@gmail.com' ELSE email END,
        membership_status = 'approved'
    WHERE lower(email) = 'the.real.ferilee@gmail.com'
       OR lower(name) = 'ferilee'
  `);

  await db.run(sql`
    UPDATE members
    SET membership_status = 'approved'
    WHERE membership_status IS NULL OR membership_status = ''
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS home_quick_links (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      title text NOT NULL,
      subtitle text NOT NULL DEFAULT '',
      href text NOT NULL DEFAULT '/',
      sort_order integer NOT NULL DEFAULT 0,
      created_at text NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS home_settings (
      key text PRIMARY KEY NOT NULL,
      value text NOT NULL DEFAULT ''
    )
  `);

  await db.run(sql`
    INSERT INTO home_quick_links (title, subtitle, href, sort_order)
    SELECT 'Modul Ajar Fase E', 'Logaritma & Eksponen', '/portofolio', 1
    WHERE NOT EXISTS (SELECT 1 FROM home_quick_links)
  `);

  await db.run(sql`
    INSERT INTO home_quick_links (title, subtitle, href, sort_order)
    SELECT 'Bank Soal SAS', 'Semester Ganjil 2024', '/portofolio', 2
    WHERE NOT EXISTS (SELECT 1 FROM home_quick_links WHERE sort_order = 2)
  `);

  await db.run(sql`
    INSERT INTO home_settings (key, value)
    SELECT 'home_quote_text', 'Mathematics is the language with which God has written the universe.'
    WHERE NOT EXISTS (SELECT 1 FROM home_settings WHERE key = 'home_quote_text')
  `);

  await db.run(sql`
    INSERT INTO home_settings (key, value)
    SELECT 'home_quote_author', 'Galileo Galilei'
    WHERE NOT EXISTS (SELECT 1 FROM home_settings WHERE key = 'home_quote_author')
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS comments (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      target_type text NOT NULL,
      target_id integer NOT NULL,
      parent_id integer,
      author_name text NOT NULL DEFAULT 'Guest',
      author_email text NOT NULL DEFAULT '',
      content text NOT NULL,
      created_at text NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS reactions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      target_type text NOT NULL,
      target_id integer NOT NULL,
      reaction text NOT NULL,
      user_key text NOT NULL,
      created_at text NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS reactions_target_reaction_user_unique
    ON reactions (target_type, target_id, reaction, user_key)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS portfolio_ratings (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      portfolio_id integer NOT NULL,
      user_key text NOT NULL,
      rating integer NOT NULL,
      created_at text NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS portfolio_ratings_portfolio_user_unique
    ON portfolio_ratings (portfolio_id, user_key)
  `);

  const newsRows = (await db.all(sql`PRAGMA table_info(news)`)) as TableInfoRow[];
  const newsColumns = new Set(newsRows.map((row) => row.name));
  if (!newsColumns.has("publish_status")) {
    await db.run(sql`ALTER TABLE news ADD publish_status text DEFAULT 'approved' NOT NULL`);
  }
  if (!newsColumns.has("reviewed_by")) {
    await db.run(sql`ALTER TABLE news ADD reviewed_by text DEFAULT '' NOT NULL`);
  }
  if (!newsColumns.has("reviewed_at")) {
    await db.run(sql`ALTER TABLE news ADD reviewed_at text DEFAULT '' NOT NULL`);
  }
  if (!newsColumns.has("created_by_email")) {
    await db.run(sql`ALTER TABLE news ADD created_by_email text DEFAULT '' NOT NULL`);
  }

  const portfolioRows = (await db.all(sql`PRAGMA table_info(portfolios)`)) as TableInfoRow[];
  const portfolioColumns = new Set(portfolioRows.map((row) => row.name));
  if (!portfolioColumns.has("publish_status")) {
    await db.run(sql`ALTER TABLE portfolios ADD publish_status text DEFAULT 'approved' NOT NULL`);
  }
  if (!portfolioColumns.has("reviewed_by")) {
    await db.run(sql`ALTER TABLE portfolios ADD reviewed_by text DEFAULT '' NOT NULL`);
  }
  if (!portfolioColumns.has("reviewed_at")) {
    await db.run(sql`ALTER TABLE portfolios ADD reviewed_at text DEFAULT '' NOT NULL`);
  }
  if (!portfolioColumns.has("created_by_email")) {
    await db.run(sql`ALTER TABLE portfolios ADD created_by_email text DEFAULT '' NOT NULL`);
  }

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS learning_resources (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      title text NOT NULL,
      category text NOT NULL DEFAULT 'RPP / Modul Ajar',
      description text NOT NULL DEFAULT '',
      phase text NOT NULL DEFAULT '',
      grade text NOT NULL DEFAULT '',
      topic text NOT NULL DEFAULT '',
      semester text NOT NULL DEFAULT '',
      curriculum text NOT NULL DEFAULT 'Kurikulum Merdeka',
      source_type text NOT NULL DEFAULT 'file',
      resource_url text NOT NULL DEFAULT '',
      file_name text NOT NULL DEFAULT '',
      thumbnail_url text NOT NULL DEFAULT '',
      created_by_email text NOT NULL DEFAULT '',
      publish_status text NOT NULL DEFAULT 'approved',
      reviewed_by text NOT NULL DEFAULT '',
      reviewed_at text NOT NULL DEFAULT '',
      created_at text NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const resourceRows = (await db.all(sql`PRAGMA table_info(learning_resources)`)) as TableInfoRow[];
  const resourceColumns = new Set(resourceRows.map((row) => row.name));
  if (!resourceColumns.has("tags")) await db.run(sql`ALTER TABLE learning_resources ADD tags text DEFAULT '' NOT NULL`);
  if (!resourceColumns.has("storage_key")) await db.run(sql`ALTER TABLE learning_resources ADD storage_key text DEFAULT '' NOT NULL`);
  if (!resourceColumns.has("thumbnail_storage_key")) await db.run(sql`ALTER TABLE learning_resources ADD thumbnail_storage_key text DEFAULT '' NOT NULL`);
  if (!resourceColumns.has("view_count")) await db.run(sql`ALTER TABLE learning_resources ADD view_count integer DEFAULT 0 NOT NULL`);
  if (!resourceColumns.has("download_count")) await db.run(sql`ALTER TABLE learning_resources ADD download_count integer DEFAULT 0 NOT NULL`);
  if (!resourceColumns.has("review_note")) await db.run(sql`ALTER TABLE learning_resources ADD review_note text DEFAULT '' NOT NULL`);
  if (!resourceColumns.has("archived_at")) await db.run(sql`ALTER TABLE learning_resources ADD archived_at text DEFAULT '' NOT NULL`);
  if (!resourceColumns.has("archive_reason")) await db.run(sql`ALTER TABLE learning_resources ADD archive_reason text DEFAULT '' NOT NULL`);
  if (!resourceColumns.has("link_checked_at")) await db.run(sql`ALTER TABLE learning_resources ADD link_checked_at text DEFAULT '' NOT NULL`);
  if (!resourceColumns.has("link_check_status")) await db.run(sql`ALTER TABLE learning_resources ADD link_check_status text DEFAULT 'unknown' NOT NULL`);
  if (!resourceColumns.has("link_check_error")) await db.run(sql`ALTER TABLE learning_resources ADD link_check_error text DEFAULT '' NOT NULL`);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS learning_resource_versions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      resource_id integer NOT NULL,
      version integer NOT NULL,
      resource_url text NOT NULL DEFAULT '',
      file_name text NOT NULL DEFAULT '',
      storage_key text NOT NULL DEFAULT '',
      change_note text NOT NULL DEFAULT '',
      created_by_email text NOT NULL DEFAULT '',
      created_at text NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS learning_resource_favorites (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      resource_id integer NOT NULL,
      user_key text NOT NULL,
      created_at text NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS learning_resource_favorites_resource_user_unique ON learning_resource_favorites (resource_id, user_key)`);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS learning_resource_ratings (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      resource_id integer NOT NULL,
      user_key text NOT NULL,
      rating integer NOT NULL,
      created_at text NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS learning_resource_ratings_resource_user_unique ON learning_resource_ratings (resource_id, user_key)`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS learning_resource_collections (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, owner_key text NOT NULL, name text NOT NULL, created_at text NOT NULL DEFAULT (datetime('now')))`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS learning_resource_collection_items (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, collection_id integer NOT NULL, resource_id integer NOT NULL, created_at text NOT NULL DEFAULT (datetime('now')))`);
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS learning_resource_collection_items_collection_resource_unique ON learning_resource_collection_items (collection_id, resource_id)`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS learning_resource_reports (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, resource_id integer NOT NULL, reporter_key text NOT NULL, reason text NOT NULL, detail text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open', reviewed_by text NOT NULL DEFAULT '', reviewed_at text NOT NULL DEFAULT '', created_at text NOT NULL DEFAULT (datetime('now')))`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS learning_resource_reports_status_created_at ON learning_resource_reports (status, created_at)`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS user_notifications (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, recipient_key text NOT NULL, type text NOT NULL, title text NOT NULL, message text NOT NULL DEFAULT '', href text NOT NULL DEFAULT '', read_at text NOT NULL DEFAULT '', created_at text NOT NULL DEFAULT (datetime('now')))`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS user_notifications_recipient_created_at ON user_notifications (recipient_key, created_at)`);
}
