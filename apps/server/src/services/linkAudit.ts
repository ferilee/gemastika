import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { learningResources } from "../db/schema";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export async function checkLearningResourceLink(urlValue: string, fetcher: Fetcher = fetch) {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return { status: "broken" as const, error: "URL materi tidak valid." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { status: "broken" as const, error: "Hanya tautan HTTP(S) yang dapat diperiksa." };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let response = await fetcher(url.toString(), { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (response.status === 405) response = await fetcher(url.toString(), { method: "GET", redirect: "follow", signal: controller.signal });
    return response.ok ? { status: "ok" as const, httpStatus: response.status } : { status: "broken" as const, httpStatus: response.status, error: `HTTP ${response.status}` };
  } catch {
    return { status: "broken" as const, error: "Tautan tidak dapat dijangkau." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function auditLearningResourceLinks(db: Db, fetcher: Fetcher = fetch) {
  const resources = await db.select().from(learningResources).where(and(eq(learningResources.sourceType, "link"), eq(learningResources.publishStatus, "approved"), eq(learningResources.archivedAt, "")));
  let ok = 0;
  let broken = 0;
  for (const resource of resources) {
    const result = await checkLearningResourceLink(resource.resourceUrl, fetcher);
    if (result.status === "ok") ok += 1;
    else broken += 1;
    await db.update(learningResources).set({ linkCheckedAt: new Date().toISOString(), linkCheckStatus: result.status, linkCheckError: result.error || "" }).where(eq(learningResources.id, resource.id));
  }
  return { checked: resources.length, ok, broken };
}
