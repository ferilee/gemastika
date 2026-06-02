import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layout/AppLayout";
import { AppDataProvider } from "@/state/AppDataContext";
import { AuthProvider } from "@/state/AuthContext";
import { HomePage } from "@/pages/HomePage";
import { ProfilPage } from "@/pages/ProfilPage";
import { AnggotaPage } from "@/pages/AnggotaPage";
import { KegiatanPage } from "@/pages/KegiatanPage";
import { BeritaPage } from "@/pages/BeritaPage";
import { PortofolioPage } from "@/pages/PortofolioPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DashboardAdminPage } from "@/pages/DashboardAdminPage";
import { DashboardPengurusPage } from "@/pages/DashboardPengurusPage";
import { DashboardAnggotaPage } from "@/pages/DashboardAnggotaPage";
import { RequireAuth, RequireRole } from "@/components/RouteGuards";

export default function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/profil" element={<ProfilPage />} />
              <Route path="/anggota" element={<AnggotaPage />} />
              <Route path="/kegiatan" element={<KegiatanPage />} />
              <Route path="/berita" element={<BeritaPage />} />
              <Route path="/berita/:permalink" element={<BeritaPage />} />
              <Route path="/portofolio" element={<PortofolioPage />} />

              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/dashboard/admin/*"
                element={
                  <RequireRole role="admin">
                    <DashboardAdminPage />
                  </RequireRole>
                }
              />
              <Route
                path="/dashboard/pengurus"
                element={
                  <RequireRole role="pengurus">
                    <DashboardPengurusPage />
                  </RequireRole>
                }
              />
              <Route
                path="/dashboard/anggota"
                element={
                  <RequireAuth>
                    <DashboardAnggotaPage />
                  </RequireAuth>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppDataProvider>
    </AuthProvider>
  );
}
