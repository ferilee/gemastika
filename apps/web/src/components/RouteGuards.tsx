import { Navigate, useLocation } from "react-router-dom";
import type { MemberRole } from "@/types";
import { hasRole, useAuth } from "@/state/AuthContext";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profileRegistered, isApprovedMember, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="h-32 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  if (!user) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  if (!profileRegistered) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  if (!isApprovedMember) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export function RequireRole({ role, children }: { role: MemberRole; children: React.ReactNode }) {
  const { user, profileRegistered, isApprovedMember, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="h-32 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  if (!user) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  if (!profileRegistered) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  if (!isApprovedMember) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  if (!hasRole(user, role)) {
    if (!(role === "pengurus" && hasRole(user, "admin"))) return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
