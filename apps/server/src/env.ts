export function getEnv() {
  const port = Number(process.env.PORT || 3000);
  const dbPath = process.env.DB_PATH || "./data/app.db";
  // Resolved relative to compiled file location (apps/server/dist).
  const webDistDir = process.env.WEB_DIST_DIR || "../../web/dist";
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
  const webOrigin = process.env.WEB_ORIGIN || corsOrigin;

  const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  // Must match Google Console "Authorized redirect URIs"
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${webOrigin}/api/auth/google/callback`;

  // Used to sign the session cookie.
  const sessionSecret = process.env.SESSION_SECRET || "dev_insecure_change_me";
  const adminEmails = (process.env.ADMIN_EMAILS || "the.real.ferilee@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return {
    port,
    dbPath,
    webDistDir,
    corsOrigin,
    webOrigin,
    googleClientId,
    googleClientSecret,
    googleRedirectUri,
    sessionSecret,
    adminEmails
  };
}
