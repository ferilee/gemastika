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
  const s3Endpoint = process.env.S3_ENDPOINT || "";
  const s3AccessKey = process.env.S3_ACCESS_KEY || "";
  const s3SecretKey = process.env.S3_SECRET_KEY || "";
  const s3Bucket = process.env.S3_BUCKET || "gemastika-assets";
  const s3Region = process.env.S3_REGION || "us-east-1";
  const s3ForcePathStyle = (process.env.S3_FORCE_PATH_STYLE || "true").toLowerCase() === "true";
  const s3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL || "";
  const linkAuditIntervalMinutes = Math.max(0, Number(process.env.LINK_AUDIT_INTERVAL_MINUTES || 360));

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
    adminEmails,
    s3Endpoint,
    s3AccessKey,
    s3SecretKey,
    s3Bucket,
    s3Region,
    s3ForcePathStyle,
    s3PublicBaseUrl,
    linkAuditIntervalMinutes
  };
}
