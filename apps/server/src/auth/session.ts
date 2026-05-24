import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

type SessionUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  // Back-compat: `role` is a single string; prefer `roles` for multirole.
  role?: "admin" | "pengurus" | "anggota";
  roles?: Array<"admin" | "pengurus" | "anggota">;
  membershipStatus?: "pending" | "approved" | "rejected";
  isGuest?: boolean;
};

const COOKIE_NAME = "mgmp_session";

function b64urlEncode(bytes: Uint8Array) {
  // btoa expects latin1 string
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecodeToBytes(b64url: string) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSign(secret: string, payload: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64urlEncode(new Uint8Array(sig));
}

export async function setSession(c: Context, user: SessionUser, opts: { secret: string; secure: boolean }) {
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(user)));
  const sig = await hmacSign(opts.secret, payload);
  const value = `${payload}.${sig}`;
  setCookie(c, COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "Lax",
    secure: opts.secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
}

export async function getSession(c: Context, secret: string): Promise<SessionUser | null> {
  const value = getCookie(c, COOKIE_NAME);
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacSign(secret, payload);
  if (sig !== expected) return null;
  try {
    const bytes = b64urlDecodeToBytes(payload);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as SessionUser;
  } catch {
    return null;
  }
}

export function clearSession(c: Context, opts: { secure: boolean }) {
  deleteCookie(c, COOKIE_NAME, { path: "/", secure: opts.secure, sameSite: "Lax" });
}
