import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { BookOpen, CalendarDays, Laptop2, Newspaper, Users, User, Shield, AlertCircle, Bell, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Heart, MapPin, Mail, Instagram, Facebook, Youtube } from "lucide-react";
import { hasRole, useAuth } from "@/state/AuthContext";
import { ProfileOnboardingModal } from "@/components/ProfileOnboardingModal";
import { InstallAppButton } from "@/components/InstallAppButton";
import { GlobalAlertDialog } from "@/components/GlobalAlertDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/api/client";
import type { Member, UserNotification } from "@/types";
import { useAppData } from "@/state/AppDataContext";

type ReviewQueueItem = { count: number; title: string; message: string; href: string };

function NavItem({
  to,
  label,
  showDot
}: {
  to: string;
  label: string;
  showDot?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "hover:text-mgmp-primary dark:hover:text-white transition-colors",
          isActive ? "text-mgmp-primary dark:text-white" : "text-slate-600 dark:text-slate-200/80"
        ].join(" ")
      }
      end={to === "/"}
    >
      <span className="relative inline-flex items-center">
        {label}
        {showDot ? <span className="absolute -right-2 -top-1.5 h-2 w-2 rounded-full bg-rose-500" /> : null}
      </span>
    </NavLink>
  );
}

function BottomItem({
  to,
  label,
  Icon
}: {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        [
          "relative flex h-full flex-col items-center justify-center",
          isActive ? "text-mgmp-primary dark:text-white" : "text-slate-500 dark:text-slate-300/70"
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={["transition-all duration-300 ease-out", isActive ? "h-5 w-5 -translate-y-1.5" : "h-[18px] w-[18px]"].join(" ")} />
          <span
            className={[
              "absolute bottom-[5px] text-[10px] font-extrabold transition-all duration-300 ease-out",
              isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
            ].join(" ")}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const { user, profileRegistered, memberStatus, refresh } = useAuth();
  const { homeContent } = useAppData();
  const showAdminBottomItem = hasRole(user, "admin");
  const showDashboardNav = hasRole(user, "admin") || hasRole(user, "pengurus");
  const isReviewer = hasRole(user, "admin") || hasRole(user, "pengurus");
  const showNotifBell = Boolean(user);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [openWelcome, setOpenWelcome] = useState(false);
  const [welcomeActivity, setWelcomeActivity] = useState({ activeDays: 0, totalVisits: 0, activeToday: false });
  const dashboardLink = hasRole(user, "admin")
    ? "/dashboard/admin"
    : hasRole(user, "pengurus")
      ? "/dashboard/pengurus"
      : "/dashboard";
  const [openBadgeModal, setOpenBadgeModal] = useState(false);
  const [newBadgeMember, setNewBadgeMember] = useState<Member | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setOpenBadgeModal(false);
        setNewBadgeMember(null);
        return;
      }
      try {
        const res = await api<{ registered: boolean; member: Member | null }>("/api/profile/me");
        if (cancelled) return;
        if (res.member && res.member.membershipStatus === "approved" && res.member.newMemberBadge === 1 && res.member.newMemberBadgeSeen === 0) {
          setNewBadgeMember(res.member);
          setOpenBadgeModal(true);
        } else {
          setOpenBadgeModal(false);
        }
      } catch {
        if (!cancelled) setOpenBadgeModal(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void api("/api/member-activity/visit", { method: "POST" }).catch(() => undefined);
  }, [user?.email, user?.sub]);

  useEffect(() => {
    if (!user || memberStatus !== "approved") { setOpenWelcome(false); return; }
    const memberKey = (user.email || user.sub || "").toLowerCase();
    const today = new Date().toLocaleDateString("en-CA");
    const storageKey = `mgmp-welcome:${memberKey}:${today}`;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {
      // Continue without a persistence marker if browser storage is unavailable.
    }
    let cancelled = false;
    void api<{ activeDays: number; totalVisits: number; activeToday: boolean }>("/api/member-activity/me")
      .then((activity) => {
        if (cancelled) return;
        setWelcomeActivity(activity);
        setOpenWelcome(true);
        try { localStorage.setItem(storageKey, "1"); } catch { /* no-op */ }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [memberStatus, user?.email, user?.sub]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !isReviewer) {
        setPendingApprovalCount(0);
        setReviewQueue([]);
        return;
      }
      try {
        const queue = await api<ReviewQueueItem[]>("/api/notifications/review-queue");
        if (cancelled) return;
        setReviewQueue(queue);
        setPendingApprovalCount(queue.reduce((total, item) => total + item.count, 0));
      } catch {
        if (!cancelled) { setPendingApprovalCount(0); setReviewQueue([]); }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReviewer, realtimeTick, user]);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await api<UserNotification[]>("/api/notifications");
        if (!cancelled) setNotifications(rows);
      } catch {
        if (!cancelled) setNotifications([]);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [realtimeTick, user]);

  useEffect(() => {
    if (!user) return;
    const source = new EventSource("/api/notifications/stream");
    source.addEventListener("notification", () => setRealtimeTick((value) => value + 1));
    return () => source.close();
  }, [user?.email, user?.sub]);

  async function openNotification(notification: UserNotification) {
    if (!notification.readAt) {
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      try { await api(`/api/notifications/${notification.id}/read`, { method: "POST" }); } catch { /* optimistic state is sufficient */ }
    }
    setOpenNotifications(false);
    navigate(notification.href || "/bank-pembelajaran");
  }

  async function closeBadgeModal() {
    setOpenBadgeModal(false);
    try {
      await api("/api/profile/me/badge-ack", { method: "POST" });
    } catch {
      // ignore
    }
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" } });
    } finally {
      await refresh();
      navigate("/", { replace: true });
    }
  }

  const unreadNotificationCount = notifications.filter((item) => !item.readAt).length;
  const notificationCount = pendingApprovalCount + unreadNotificationCount;

  return (
    <div className="min-h-screen pb-20 md:pb-0 bg-mgmp-surface text-slate-800 dark:bg-[#0b1220] dark:text-slate-200">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden dark:block">
        <div className="absolute -top-44 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(29,78,216,0.35),transparent_60%)] blur-3xl" />
        <div className="absolute top-28 right-[-220px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.22),transparent_60%)] blur-3xl" />
        <div className="absolute bottom-[-240px] left-[-220px] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_60%)] blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-gradient-to-b dark:from-[#0b1220]/95 dark:to-[#0b1220]/70 backdrop-blur">
        <div className="container h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="https://i.ibb.co.com/849tt9RT/Logo-MGMP-1-20260109-201844-0000.png"
              alt="Logo MGMP"
              className="h-11 w-11 object-contain"
            />
            <div className="leading-tight">
              <div className="font-extrabold text-mgmp-blue dark:text-white">MGMP Matematika</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">SMK Kab. Lumajang</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-extrabold">
            <NavItem to="/" label="Beranda" />
            <NavItem to="/profil" label="Profil" />
            <NavItem to="/anggota" label="Anggota" />
            <NavItem to="/kegiatan" label="Kegiatan" />
            <NavItem to="/berita" label="Berita" />
            <NavItem to="/portofolio" label="Portofolio" />
            <NavItem to="/bank-pembelajaran" label="Bank Pembelajaran" />
            {user && showDashboardNav ? <NavItem to={dashboardLink} label="Dashboard" showDot={pendingApprovalCount > 0} /> : null}
            {user && !profileRegistered ? (
              <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                <AlertCircle className="h-3.5 w-3.5" /> Profil
              </div>
            ) : null}
            {user && showNotifBell ? (
              <button
                type="button"
                onClick={() => setOpenNotifications(true)}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/70 bg-white/70 text-slate-600 hover:text-mgmp-primary dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                title="Notifikasi"
                aria-label="Notifikasi"
              >
                <Bell className="h-4 w-4" />
                {notificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            {user ? <button type="button" onClick={() => void signOut()} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/70 bg-white/70 text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-rose-400/40 dark:hover:text-rose-300" title="Keluar" aria-label="Keluar"><LogOut className="h-4 w-4" /></button> : null}
            <InstallAppButton />
            <ThemeToggle />
          </nav>

          <div className="md:hidden flex items-center gap-2">
            {user && !profileRegistered ? (
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                <AlertCircle className="h-4 w-4" />
              </div>
            ) : null}
            {user && showNotifBell ? (
              <button
                type="button"
                onClick={() => setOpenNotifications(true)}
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                title="Notifikasi"
                aria-label="Notifikasi"
              >
                <Bell className="h-4 w-4" />
                {notificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            {user ? <button type="button" onClick={() => void signOut()} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200" title="Keluar" aria-label="Keluar"><LogOut className="h-4 w-4" /></button> : null}
            <InstallAppButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 z-40 w-full h-16 md:hidden border-t border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0b1220]/80 backdrop-blur">
        <div className={["grid h-full text-[10px] font-extrabold", showAdminBottomItem ? "grid-cols-7" : "grid-cols-6"].join(" ")}>
          <BottomItem to="/" label="Beranda" Icon={CalendarDays} />
          <BottomItem to="/profil" label="Profil" Icon={User} />
          <BottomItem to="/anggota" label="Anggota" Icon={Users} />
          <BottomItem to="/berita" label="Berita" Icon={Newspaper} />
          <BottomItem to="/portofolio" label="Karya" Icon={Laptop2} />
          <BottomItem to="/bank-pembelajaran" label="Bank" Icon={BookOpen} />
          {showAdminBottomItem ? <BottomItem to="/dashboard/admin" label="Admin" Icon={Shield} /> : null}
        </div>
      </nav>

      <main className="container pt-10 pb-16">
        {user && memberStatus !== "approved" ? (
          <div className="mb-4 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
            Akun Anda sedang dalam mode tamu ({memberStatus}). Menunggu persetujuan admin untuk akses penuh anggota.
          </div>
        ) : null}
        <Outlet />
      </main>

      <ProfileOnboardingModal />
      <GlobalAlertDialog />

      <Dialog open={openNotifications} onOpenChange={setOpenNotifications}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Notifikasi</DialogTitle><DialogDescription>Pembaruan untuk materi dan aktivitas Anda.</DialogDescription></DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto px-6 pb-6">
            {reviewQueue.map((item) => <button type="button" key={item.title} onClick={() => { setOpenNotifications(false); navigate(item.href); }} className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left transition hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"><div className="flex items-center justify-between gap-3"><div className="text-sm font-extrabold text-slate-800 dark:text-white">{item.title}</div><span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-extrabold text-white">{item.count}</span></div><div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.count} {item.message}</div></button>)}
            {notifications.map((notification) => <button type="button" key={notification.id} onClick={() => void openNotification(notification)} className={["w-full rounded-lg border p-3 text-left transition", notification.readAt ? "border-slate-200/70 bg-white/50 dark:border-white/10 dark:bg-white/5" : "border-mgmp-primary/30 bg-mgmp-primary/5 dark:bg-mgmp-primary/10"].join(" ")}><div className="text-sm font-extrabold text-slate-800 dark:text-white">{notification.title}</div>{notification.message ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.message}</div> : null}</button>)}
            {!reviewQueue.length && !notifications.length ? <div className="py-8 text-center text-sm text-slate-500">Belum ada notifikasi baru.</div> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openWelcome} onOpenChange={setOpenWelcome}>
        <DialogContent className="max-w-md overflow-hidden">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, index) => <span key={index} className="welcome-confetti" style={{ left: `${6 + ((index * 17) % 88)}%`, animationDelay: `${(index % 6) * 0.12}s` }} />)}
          </div>
          <DialogHeader className="relative"><DialogTitle>Selamat datang, {user?.name || "Anggota"}</DialogTitle><DialogDescription>{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</DialogDescription></DialogHeader>
          <div className="relative space-y-4 px-6 pb-6"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/25 dark:bg-emerald-500/10"><div className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">{welcomeActivity.activeToday ? "Aktif hari ini" : "Mulai aktivitas hari ini"}</div><div className="mt-1 text-sm text-emerald-700 dark:text-emerald-100">{welcomeActivity.activeDays} hari aktif dalam 7 hari terakhir.</div></div><blockquote className="border-l-4 border-mgmp-accent pl-4 text-sm leading-6 text-slate-700 dark:text-slate-200">“{homeContent.quote.text}”<footer className="mt-2 text-xs font-extrabold text-mgmp-primary">{homeContent.quote.author}</footer></blockquote><Button className="w-full" onClick={() => setOpenWelcome(false)}>Mulai</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={openBadgeModal} onOpenChange={setOpenBadgeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selamat! Lencana Anggota Baru</DialogTitle>
            <DialogDescription>
              Akun Anda telah disetujui admin. Anda memperoleh +10 XP dan lencana anggota baru.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 flex justify-center">
              <iframe
                title="Lencana Anggota Baru"
                src="https://lottie.host/embed/4db68bbd-31f6-4cd8-84eb-189de081159a/IGmMCqhzpt.lottie"
                className="h-40 w-40 border-0"
              />
            </div>
            <div className="text-center text-sm text-slate-600 dark:text-slate-300">
              {newBadgeMember?.name || "Anggota"} sekarang resmi menjadi anggota MGMP.
            </div>
            <Button onClick={() => void closeBadgeModal()} className="w-full font-extrabold">
              Lanjutkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="hidden md:block mt-10 bg-gradient-to-b from-mgmp-blue to-[#081224] border-t border-slate-200/70 dark:border-white/10">
        <div className="container pt-14 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src="https://i.ibb.co.com/849tt9RT/Logo-MGMP-1-20260109-201844-0000.png"
                  alt="Logo MGMP"
                  className="h-10 w-10 object-contain"
                />
                <div className="leading-tight">
                  <div className="font-extrabold text-white">MGMP Matematika</div>
                  <div className="text-[11px] text-white/70 font-semibold">SMK Kab. Lumajang</div>
                </div>
              </div>
              <p className="mt-4 text-sm text-white/80 leading-relaxed max-w-sm">
                Organisasi profesi guru Matematika SMK Kabupaten Lumajang. Mewujudkan pendidik yang profesional, inovatif,
                dan melek teknologi.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <a
                  className="h-10 w-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
                  href="#"
                  aria-label="Instagram"
                  title="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  className="h-10 w-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
                  href="#"
                  aria-label="Facebook"
                  title="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
                <a
                  className="h-10 w-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
                  href="#"
                  aria-label="YouTube"
                  title="YouTube"
                >
                  <Youtube className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div>
              <div className="font-extrabold text-white">Tautan</div>
              <div className="mt-4 space-y-2 text-sm text-white/80">
                <Link className="block hover:text-white transition" to="/profil">
                  Tentang Kami
                </Link>
                <Link className="block hover:text-white transition" to="/anggota">
                  Struktur Organisasi
                </Link>
                <Link className="block hover:text-white transition" to="/kegiatan">
                  Program Kerja
                </Link>
                <Link className="block hover:text-white transition" to="/berita">
                  Berita Kedinasan
                </Link>
              </div>
            </div>

            <div>
              <div className="font-extrabold text-white">Kontak</div>
              <div className="mt-4 space-y-3 text-sm text-white/80">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-white/80 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Sekretariat: SMK Negeri Pasirian</div>
                    <div className="text-white/70">Jl. Raya Condro Pasirian</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-white/80 flex-shrink-0 mt-0.5" />
                  <div className="font-semibold">mgmpmtksmklmj@gmail.com</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/70">
            © 2024 MGMP Matematika SMK Kab. Lumajang. Created with{" "}
            <Heart className="inline h-3.5 w-3.5 text-rose-300 align-[-2px]" fill="currentColor" /> for Education.
          </div>
        </div>
      </footer>
    </div>
  );
}
