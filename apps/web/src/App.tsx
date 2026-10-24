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
import { BankPembelajaranPage } from "@/pages/BankPembelajaranPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DashboardAdminPage } from "@/pages/DashboardAdminPage";
import { DashboardPengurusPage } from "@/pages/DashboardPengurusPage";
import { DashboardAnggotaPage } from "@/pages/DashboardAnggotaPage";
import { FeedbackPage } from "@/pages/FeedbackPage";
import { RequireAuth, RequireRole } from "@/components/RouteGuards";
import { hasRole, useAuth } from "@/state/AuthContext";

function RootPage() {
  const { user, profileRegistered, isApprovedMember, loading } = useAuth();
  const isMemberHome = Boolean(
    !loading &&
      user &&
      profileRegistered &&
      isApprovedMember &&
      hasRole(user, "anggota") &&
      !hasRole(user, "admin") &&
      !hasRole(user, "pengurus")
  );

  if (loading) return <div className="min-h-[70vh] animate-pulse rounded-[2rem] bg-slate-100 dark:bg-white/5" />;
  return isMemberHome ? <DashboardAnggotaPage /> : <HomePage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<RootPage />} />
              <Route path="/profil" element={<ProfilPage />} />
              <Route path="/anggota" element={<AnggotaPage />} />
              <Route path="/kegiatan" element={<KegiatanPage />} />
              <Route path="/berita" element={<BeritaPage />} />
              <Route path="/berita/:permalink" element={<BeritaPage />} />
              <Route path="/portofolio" element={<PortofolioPage />} />
              <Route path="/bank-pembelajaran" element={<BankPembelajaranPage />} />
              <Route path="/bank-pembelajaran/:permalink" element={<BankPembelajaranPage />} />
              <Route path="/kritik-saran" element={<FeedbackPage />} />
              <Route path="/testimoni" element={<FeedbackPage />} />

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
                element={<Navigate to="/" replace />}
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppDataProvider>
    </AuthProvider>
  );
}
