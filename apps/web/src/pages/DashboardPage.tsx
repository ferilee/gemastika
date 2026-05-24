import { Link, useNavigate } from "react-router-dom";
import { LogOut, Shield, Users, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hasRole, useAuth } from "@/state/AuthContext";

export function DashboardPage() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" } });
    } finally {
      await refresh();
      nav("/", { replace: true });
    }
  }

  const roles = user?.roles?.length ? user.roles : user?.role ? [user.role] : [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">Dashboard</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {roles.map((r) => (
              <Badge key={r} variant={r === "admin" ? "accent" : r === "pengurus" ? "primary" : "success"}>
                {r}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="secondary" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" /> Keluar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card asChild className="cursor-pointer">
          <Link to="/dashboard/anggota">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-mgmp-blue dark:text-white">Anggota</CardTitle>
              <User className="h-5 w-5 text-mgmp-primary" />
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">
              Profil, XP, dan akses cepat.
            </CardContent>
          </Link>
        </Card>

        {hasRole(user, "pengurus") ? (
          <Card asChild className="cursor-pointer">
            <Link to="/dashboard/pengurus">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-mgmp-blue dark:text-white">Pengurus</CardTitle>
                <Users className="h-5 w-5 text-sky-500" />
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-300">
                Operasional agenda, kehadiran, dan konten.
              </CardContent>
            </Link>
          </Card>
        ) : null}

        {hasRole(user, "admin") ? (
          <Card asChild className="cursor-pointer">
            <Link to="/dashboard/admin">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-mgmp-blue dark:text-white">Admin</CardTitle>
                <Shield className="h-5 w-5 text-rose-500" />
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-300">
                Kelola role dan akses sistem.
              </CardContent>
            </Link>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

