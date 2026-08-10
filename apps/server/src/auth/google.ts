import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { setSession, getSession, clearSession } from "./session";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { members } from "../db/schema";

type Env = {
  webOrigin: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  sessionSecret: string;
  adminEmails: string[];
  // Optional; when provided it is the authoritative source for roles.
  db?: Db;
};

const STATE_COOKIE = "mgmp_oauth_state";

function isHttps(origin: string) {
  return origin.startsWith("https://");
}

function makeAuthorizeUrl(env: Env, state: string) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", env.googleClientId);
  u.searchParams.set("redirect_uri", env.googleRedirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  return u.toString();
}

export function googleAuthRouter(env: Env) {
  const r = new Hono().basePath("/api/auth");

  r.get("/me", async (c) => {
    const user = await getSession(c, env.sessionSecret);
    if (!user || !env.db || !user.email) return c.json({ user });

    const email = user.email.trim().toLowerCase();
    const row = await env.db
      .select({ role: members.role, roles: members.roles, membershipStatus: members.membershipStatus })
      .from(members)
      .where(eq(members.email, email))
      .get();

    if (!row) return c.json({ user });

    const mergedRoles = new Set<"admin" | "pengurus" | "anggota">();
    if (row.role === "admin" || row.role === "pengurus" || row.role === "anggota") mergedRoles.add(row.role);
    if (row.roles) {
      for (const role of row.roles.split(",").map((v) => v.trim())) {
        if (role === "admin" || role === "pengurus" || role === "anggota") mergedRoles.add(role);
      }
    }
    if (env.adminEmails.includes(email)) mergedRoles.add("admin");

    const membershipStatus =
      row.membershipStatus === "approved" || row.membershipStatus === "pending" || row.membershipStatus === "rejected"
        ? row.membershipStatus
        : "approved";
    const effectiveMembershipStatus = env.adminEmails.includes(email) ? "approved" : membershipStatus;
    const isGuest = effectiveMembershipStatus !== "approved" && !mergedRoles.has("admin") && !mergedRoles.has("pengurus");
    const roles = isGuest ? [] : Array.from(mergedRoles);
    const role: "admin" | "pengurus" | "anggota" = mergedRoles.has("admin")
      ? "admin"
      : mergedRoles.has("pengurus")
        ? "pengurus"
        : "anggota";

    const merged = { ...user, role, roles, membershipStatus: effectiveMembershipStatus, isGuest };
    await setSession(c, merged, { secret: env.sessionSecret, secure: isHttps(env.webOrigin) });
    return c.json({ user: merged });
  });

  r.post("/logout", (c) => {
    clearSession(c, { secure: isHttps(env.webOrigin) });
    return c.json({ ok: true });
  });

  r.get("/google", (c) => {
    if (!env.googleClientId || !env.googleClientSecret) {
      return c.json({ error: "Google OAuth is not configured on the server." }, 500);
    }
    const state = crypto.randomUUID();
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isHttps(env.webOrigin),
      path: "/",
      maxAge: 10 * 60
    });
    return c.redirect(makeAuthorizeUrl(env, state));
  });

  r.get("/google/callback", async (c) => {
    if (!env.googleClientId || !env.googleClientSecret) {
      return c.json({ error: "Google OAuth is not configured on the server." }, 500);
    }

    const code = c.req.query("code") || "";
    const state = c.req.query("state") || "";
    const cookieState = getCookie(c, STATE_COOKIE) || "";
    deleteCookie(c, STATE_COOKIE, { path: "/", secure: isHttps(env.webOrigin), sameSite: "Lax" });

    if (!code) return c.redirect(`${env.webOrigin}/?auth=error&reason=missing_code`);
    if (!state || !cookieState || state !== cookieState) return c.redirect(`${env.webOrigin}/?auth=error&reason=bad_state`);

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: env.googleRedirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenRes.ok) {
      return c.redirect(`${env.webOrigin}/?auth=error&reason=token_exchange`);
    }

    const tokenJson = (await tokenRes.json()) as { id_token?: string };
    if (!tokenJson.id_token) return c.redirect(`${env.webOrigin}/?auth=error&reason=no_id_token`);

    // Verify ID token via Google tokeninfo (simple + dependency-free).
    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenJson.id_token)}`);
    if (!infoRes.ok) return c.redirect(`${env.webOrigin}/?auth=error&reason=tokeninfo`);
    const info = (await infoRes.json()) as {
      aud?: string;
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!info.sub) return c.redirect(`${env.webOrigin}/?auth=error&reason=bad_token`);
    if (info.aud !== env.googleClientId) return c.redirect(`${env.webOrigin}/?auth=error&reason=bad_audience`);

    const email = (info.email || "").toLowerCase();
    const roles = new Set<"admin" | "pengurus" | "anggota">();
    if (env.adminEmails.includes(email)) roles.add("admin");
    let membershipStatus: "pending" | "approved" | "rejected" = env.adminEmails.includes(email) ? "approved" : "pending";

    // Merge role from DB if we have it (keeps role assignment server-side).
    if (env.db && email) {
      const row = await env.db
        .select({ role: members.role, roles: members.roles, membershipStatus: members.membershipStatus })
        .from(members)
        .where(eq(members.email, email))
        .get();
      if (row?.role === "admin" || row?.role === "pengurus" || row?.role === "anggota") roles.add(row.role);
      if (row?.roles) {
        for (const role of row.roles.split(",").map((v) => v.trim())) {
          if (role === "admin" || role === "pengurus" || role === "anggota") roles.add(role);
        }
      }
      if (row?.membershipStatus === "approved" || row?.membershipStatus === "pending" || row?.membershipStatus === "rejected") {
        membershipStatus = row.membershipStatus;
      }
    }

    if (roles.has("admin") || roles.has("pengurus")) membershipStatus = "approved";

    // Primary role used for back-compat UI.
    const role: "admin" | "pengurus" | "anggota" = roles.has("admin") ? "admin" : roles.has("pengurus") ? "pengurus" : "anggota";
    const isGuest = membershipStatus !== "approved" && !roles.has("admin") && !roles.has("pengurus");
    const finalRoles = isGuest ? [] : Array.from(roles);

    await setSession(
      c,
      { sub: info.sub, email: info.email, name: info.name, picture: info.picture, role, roles: finalRoles, membershipStatus, isGuest },
      { secret: env.sessionSecret, secure: isHttps(env.webOrigin) }
    );

    const landingPath = role === "admin" ? "/dashboard/admin" : role === "pengurus" ? "/dashboard/pengurus" : "/";
    return c.redirect(`${env.webOrigin}${landingPath}?auth=success`);
  });

  return r;
}
