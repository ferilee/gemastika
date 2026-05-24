import { Link } from "react-router-dom";
import { CalendarDays, Laptop2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/state/AuthContext";

export function DashboardAnggotaPage() {
  const { user } = useAuth();
  const roles = user?.roles?.length ? user.roles : user?.role ? [user.role] : [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">Anggota</h1>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{user?.name || user?.email || "-"}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{roles.join(", ")}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-mgmp-blue dark:text-white">Profil</CardTitle>
            <User className="h-5 w-5 text-mgmp-primary" />
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full font-extrabold">
              <Link to="/profil">Buka Profil</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-mgmp-blue dark:text-white">Kegiatan</CardTitle>
            <CalendarDays className="h-5 w-5 text-sky-500" />
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full font-extrabold">
              <Link to="/kegiatan">Lihat Agenda</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-mgmp-blue dark:text-white">Karya</CardTitle>
            <Laptop2 className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full font-extrabold">
              <Link to="/portofolio">Buka Portofolio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

