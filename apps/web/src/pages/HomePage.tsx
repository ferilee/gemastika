import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  FileText,
  Link2,
  MapPin,
  Quote,
  Target,
  Users,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppData } from "@/state/AppDataContext";
import { useAuth } from "@/state/AuthContext";
import { agendaBlock, isPast } from "@/lib/mgmp";
import { MathHero3D } from "@/components/MathHero3D";
import { api } from "@/api/client";
import { useEffect, useState } from "react";
import type { Member } from "@/types";

type ProfileStatus = {
  registered: boolean;
  member: Member | null;
};

export function HomePage() {
  const { members, agendas, news, portfolios, homeContent, loading, error, patchMember } = useAppData();
  const { user } = useAuth();
  const [openProfile, setOpenProfile] = useState(false);
  const [profileData, setProfileData] = useState<Member | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileSchool, setProfileSchool] = useState("");
  const [profileWa, setProfileWa] = useState("");
  const [profileTelegram, setProfileTelegram] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [profileWebsiteUrl, setProfileWebsiteUrl] = useState("");

  const upcomingAgenda = (() => {
    const next = agendas.find((a) => !isPast(a.date));
    return next || agendas[0] || null;
  })();
  const featuredNews = news[0] || null;
  const totalXp = members.reduce((sum, member) => sum + (member.xp || 0), 0);
  const avgXp = members.length ? Math.round(totalXp / members.length) : 0;
  const topMember = members.reduce((best, current) => {
    if (!best) return current;
    return (current.xp || 0) > (best.xp || 0) ? current : best;
  }, null as (typeof members)[number] | null);
  const topMembers = [...members].sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 5);

  function isExternalHref(href: string) {
    return /^https?:\/\//i.test(href);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!user) {
        setProfileData(null);
        return;
      }
      try {
        const res = await api<ProfileStatus>("/api/profile/me");
        if (!cancelled) {
          setProfileData(res.member);
          if (res.member) patchMember(res.member);
        }
      } catch {
        if (!cancelled) setProfileData(null);
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!profileData) return;
    setProfileName(profileData.name || "");
    setProfileSchool(profileData.school || "");
    setProfileWa(profileData.wa || "");
    setProfileTelegram(profileData.telegram || "");
    setProfilePhotoUrl(profileData.photoUrl || "");
    setProfileWebsiteUrl(profileData.profileUrl || "");
  }, [profileData]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await api<ProfileStatus>("/api/profile/me", {
        method: "POST",
        body: JSON.stringify({
          name: profileName.trim(),
          school: profileSchool.trim(),
          wa: profileWa.trim(),
          telegram: profileTelegram.trim(),
          photoUrl: profilePhotoUrl.trim(),
          profileUrl: profileWebsiteUrl.trim()
        })
      });
      setProfileData(res.member);
      if (res.member) patchMember(res.member);
      setEditingProfile(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan profil.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <>
      {error ? (
        <Card className="border-rose-200 dark:border-rose-900">
          <CardHeader>
            <CardTitle className="text-rose-600">Gagal memuat data</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">{error}</CardContent>
        </Card>
      ) : null}

      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#07112a]/55 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_80px_-50px_rgba(56,189,248,0.35)]">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-0 dark:opacity-100 bg-[radial-gradient(circle_at_25%_20%,rgba(56,189,248,0.12),transparent_55%),radial-gradient(circle_at_80%_15%,rgba(168,85,247,0.18),transparent_55%),radial-gradient(circle_at_75%_90%,rgba(29,78,216,0.10),transparent_60%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/5 dark:from-white/5 dark:to-black/30" />
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 px-7 py-10 md:px-10 md:py-12">
          <div className="max-w-xl">
            <div className="text-sm font-extrabold text-slate-600 dark:text-slate-200/80">MGMP Matematika</div>
            <h1 className="mt-4 text-4xl md:text-5xl font-[900] tracking-tight text-slate-900 dark:text-white leading-[1.05]">
              "Wadah kolaborasi, berbagi, dan berkembang bersama."
            </h1>
            <p className="mt-5 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Pantau agenda kegiatan, baca berita, dan akses portofolio perangkat ajar dalam satu dashboard.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {user ? (
                <Button
                  variant="secondary"
                  className="font-extrabold bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400 border border-emerald-500/40"
                  onClick={() => setOpenProfile(true)}
                >
                  Profil
                </Button>
              ) : (
                <Button
                  asChild
                  className="font-extrabold bg-mgmp-primary text-white hover:bg-mgmp-primary/90 shadow-[0_14px_40px_-22px_rgba(59,130,246,0.9)]"
                >
                  <a href="/api/auth/google">
                    Masuk <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                asChild
                variant="secondary"
                className="font-extrabold bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-400 border border-indigo-500/40"
              >
                <Link to="/portofolio">Lihat Karya Guru</Link>
              </Button>
            </div>
          </div>

          <div className="relative min-h-[320px] md:min-h-[380px] lg:min-h-[420px]">
            <div className="absolute inset-0">
              <MathHero3D className="h-full w-full" />
            </div>

            <div className="absolute right-3 bottom-3 md:right-6 md:bottom-6 w-[240px] md:w-[280px]">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/65 backdrop-blur-sm shadow-sm dark:bg-white/5">
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 dark:opacity-100 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_55%),radial-gradient(circle_at_85%_25%,rgba(168,85,247,0.16),transparent_55%)]" />
                <div className="relative p-5">
                  <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-600 dark:text-white/80">
                    Fitur
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    Agenda Terdekat
                  </div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Lihat jadwal kegiatan berikutnya dan detail lokasi.
                  </div>
                  <Button asChild size="sm" className="mt-4 w-full font-extrabold">
                    <Link to="/kegiatan">Buka Agenda</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">

        <Card className="md:row-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-mgmp-blue dark:text-white">
              <CalendarCheck className="h-5 w-5 text-mgmp-primary" /> Agenda
            </CardTitle>
            <Badge variant="success">Terdekat</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : upcomingAgenda ? (
              (() => {
                const b = agendaBlock(upcomingAgenda.date);
                return (
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 dark:opacity-100">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(168,85,247,0.22),transparent_45%),radial-gradient(circle_at_82%_18%,rgba(56,189,248,0.12),transparent_46%)]" />
                    </div>
                    <div className="relative p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-24 flex-shrink-0 rounded-2xl bg-slate-100 dark:bg-black/20 border border-slate-200/70 dark:border-white/10 p-3 text-center">
                          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            {b.monthYear}
                          </div>
                          <div className="mt-2 text-4xl font-extrabold text-mgmp-primary leading-none">{b.day}</div>
                          <div className="mt-1 text-sm font-extrabold text-slate-600 dark:text-slate-300">{b.weekday}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-800 dark:text-slate-100 line-clamp-2">
                            {upcomingAgenda.title}
                          </div>
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" /> {upcomingAgenda.location || "-"}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" /> {upcomingAgenda.time || "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-sm text-slate-500">Belum ada agenda.</div>
            )}
            <Button asChild className="w-full mt-4 font-extrabold text-mgmp-primary dark:text-mgmp-primary" variant="ghost">
              <Link to="/kegiatan">Lihat Semua Agenda</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3 md:contents">
          <Card className="flex items-center justify-center text-center">
            <CardContent className="py-4 md:py-8 px-3 md:px-6">
              <div className="mx-auto mb-2 md:mb-3 h-9 w-9 md:h-12 md:w-12 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex items-center justify-center text-mgmp-primary">
                <Users className="h-5 w-5 md:h-6 md:w-6 dark:text-slate-100" />
              </div>
              <div className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white">{members.length ? `${members.length}+` : "0"}</div>
              <div className="text-[11px] md:text-sm text-slate-500 dark:text-slate-400 font-semibold">Guru Tergabung</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="py-4 md:py-8 px-3 md:px-6 text-center">
              <div className="text-[10px] md:text-xs font-extrabold uppercase tracking-wide md:tracking-widest text-slate-500 dark:text-slate-400">Total XP</div>
              <div className="mt-1 md:mt-2 text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white">{totalXp}</div>
              <div className="mt-1 text-[11px] md:text-sm text-slate-500 dark:text-slate-400 font-semibold">Rata-rata {avgXp}</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-mgmp-accent text-white">
            <div aria-hidden className="absolute -bottom-10 -right-10 h-40 w-40 rounded-3xl bg-white/20 blur-[1px]" />
            <CardContent className="py-4 md:py-8 px-3 md:px-6 text-center">
              <div className="text-2xl md:text-4xl font-extrabold">{`${Math.max(50, portfolios.length)}+`}</div>
              <div className="text-[11px] md:text-sm font-semibold opacity-95">Modul Ajar</div>
              <Button asChild variant="secondary" className="mt-3 bg-white/25 text-white hover:bg-white/35 hidden md:inline-flex">
                <Link to="/portofolio">Akses Bank Data</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-mgmp-blue dark:text-white">Peringkat XP</CardTitle>
            <Badge variant="primary">Live</Badge>
          </CardHeader>
          <CardContent>
            {topMembers.length > 0 ? (
              <div className="space-y-2">
                {topMembers.map((member, index) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200/70 dark:border-white/10 text-xs font-extrabold flex items-center justify-center text-slate-700 dark:text-slate-100">
                        #{index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 dark:text-white truncate">{member.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.school}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-mgmp-primary">{member.xp || 0}</div>
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">XP</div>
                    </div>
                  </div>
                ))}
                <div className="pt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Menampilkan 5 anggota dengan XP tertinggi.</div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Belum ada data XP anggota.</div>
            )}
            {topMember ? (
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                XP tertinggi saat ini: <span className="font-extrabold text-slate-700 dark:text-slate-200">{topMember.name}</span> ({topMember.xp || 0} XP)
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="inline-flex items-center gap-2 text-mgmp-blue dark:text-white">
              <Target className="h-5 w-5 text-mgmp-primary" /> Visi MGMP
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
              Menjadi komunitas guru Matematika SMK Kabupaten Lumajang yang profesional, kolaboratif, inovatif, dan adaptif terhadap
              perkembangan teknologi pembelajaran.
            </p>
            <Button asChild size="sm" className="font-extrabold">
              <Link to="/profil">Lihat Visi & Misi</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="inline-flex items-center gap-2 text-mgmp-blue dark:text-white">
              <Zap className="h-5 w-5 text-mgmp-accent" /> Akses Cepat
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {homeContent.quickLinks.map((item, index) => {
              const commonClassName =
                "relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5";
              const iconClassName =
                index % 2 === 0
                  ? "h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-500/15 border border-rose-200/70 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-200 flex-shrink-0"
                  : "h-10 w-10 rounded-xl bg-sky-100 dark:bg-sky-500/15 border border-sky-200/70 dark:border-sky-500/20 flex items-center justify-center text-sky-700 dark:text-sky-200 flex-shrink-0";
              const inner = (
                <>
                  <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 dark:opacity-100">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(168,85,247,0.18),transparent_42%),radial-gradient(circle_at_88%_20%,rgba(56,189,248,0.12),transparent_48%)]" />
                  </div>
                  <div className="relative p-4 flex items-center gap-3">
                    <div className={iconClassName}>{index % 2 === 0 ? <FileText className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{item.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                    </div>
                  </div>
                </>
              );
              if (isExternalHref(item.href)) {
                return (
                  <a key={item.id} className={commonClassName} href={item.href} target="_blank" rel="noreferrer">
                    {inner}
                  </a>
                );
              }
              return (
                <Link key={item.id} className={commonClassName} to={item.href || "/"}>
                  {inner}
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-[#1d3b7a] to-[#0f1b2d] text-white">
          <div aria-hidden className="absolute -right-8 -top-10 opacity-20">
            <Quote className="h-28 w-28" />
          </div>
          <CardContent className="py-8">
            <div className="text-sm italic leading-relaxed text-white/90">
              "{homeContent.quote.text}"
            </div>
            <div className="mt-4 text-xs font-extrabold uppercase tracking-widest text-white/70">{homeContent.quote.author}</div>
          </CardContent>
        </Card>

        <Card className="p-0 overflow-hidden">
          <Link to="/berita" className="relative block w-full h-full min-h-[200px] text-left group">
            {featuredNews?.imageUrl ? (
              <img
                className="absolute inset-0 h-full w-full object-cover scale-[1.02] group-hover:scale-105 transition duration-700"
                src={featuredNews.imageUrl}
                alt={featuredNews.title}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)] bg-mgmp-blue" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <div className="inline-flex items-center rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
                BERITA
              </div>
              <div className="mt-3 font-extrabold text-white line-clamp-2">{featuredNews ? featuredNews.title : "Belum ada berita"}</div>
              {featuredNews ? <div className="mt-1 text-xs text-white/75">{featuredNews.date}</div> : null}
            </div>
          </Link>
        </Card>
      </div>

      <Dialog open={openProfile} onOpenChange={setOpenProfile}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Profil Pengguna</DialogTitle>
            <DialogDescription>Informasi akun dan data profiling anggota.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl overflow-hidden border border-slate-200/70 dark:border-white/10 bg-slate-100 dark:bg-slate-800">
                  <img
                    src={user?.picture || profileData?.photoUrl || "https://i.ibb.co.com/849tt9RT/Logo-MGMP-1-20260109-201844-0000.png"}
                    alt={profileData?.name || user?.name || "Profil"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 dark:text-white truncate">{profileData?.name || user?.name || "-"}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email || profileData?.email || "-"}</div>
                </div>
              </div>

              {editingProfile ? (
                <div className="mt-4 space-y-3">
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full h-10 rounded-xl border border-slate-300/80 bg-white/90 px-3 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/15 dark:bg-[#0b1220]/70 dark:text-slate-100"
                  />
                  <input
                    value={profileSchool}
                    onChange={(e) => setProfileSchool(e.target.value)}
                    placeholder="Instansi / Sekolah"
                    className="w-full h-10 rounded-xl border border-slate-300/80 bg-white/90 px-3 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/15 dark:bg-[#0b1220]/70 dark:text-slate-100"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={profileWa}
                      onChange={(e) => setProfileWa(e.target.value)}
                      placeholder="Nomor WhatsApp"
                      className="w-full h-10 rounded-xl border border-slate-300/80 bg-white/90 px-3 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/15 dark:bg-[#0b1220]/70 dark:text-slate-100"
                    />
                    <input
                      value={profileTelegram}
                      onChange={(e) => setProfileTelegram(e.target.value)}
                      placeholder="Username Telegram"
                      className="w-full h-10 rounded-xl border border-slate-300/80 bg-white/90 px-3 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/15 dark:bg-[#0b1220]/70 dark:text-slate-100"
                    />
                  </div>
                  <input
                    value={profilePhotoUrl}
                    onChange={(e) => setProfilePhotoUrl(e.target.value)}
                    placeholder="URL Foto Profil (opsional)"
                    className="w-full h-10 rounded-xl border border-slate-300/80 bg-white/90 px-3 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/15 dark:bg-[#0b1220]/70 dark:text-slate-100"
                  />
                  <input
                    value={profileWebsiteUrl}
                    onChange={(e) => setProfileWebsiteUrl(e.target.value)}
                    placeholder="URL Website Profil (opsional)"
                    className="w-full h-10 rounded-xl border border-slate-300/80 bg-white/90 px-3 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/15 dark:bg-[#0b1220]/70 dark:text-slate-100"
                  />
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Instansi</div>
                    <div className="mt-0.5 text-slate-800 dark:text-slate-100">{profileData?.school || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Role</div>
                    <div className="mt-0.5 text-slate-800 dark:text-slate-100">{(profileData?.roles || []).join(", ") || profileData?.role || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">WhatsApp</div>
                    <div className="mt-0.5 text-slate-800 dark:text-slate-100">{profileData?.wa || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Telegram</div>
                    <div className="mt-0.5 text-slate-800 dark:text-slate-100">{profileData?.telegram || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">XP</div>
                    <div className="mt-0.5 text-slate-800 dark:text-slate-100">{profileData?.xp ?? 0}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Website Profil</div>
                    <div className="mt-0.5 text-slate-800 dark:text-slate-100 break-all">{profileData?.profileUrl || "-"}</div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2 justify-end">
                {editingProfile ? (
                  <>
                    <Button variant="secondary" onClick={() => setEditingProfile(false)} disabled={savingProfile}>
                      Batal
                    </Button>
                    <Button onClick={() => void saveProfile()} disabled={savingProfile}>
                      {savingProfile ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={() => setEditingProfile(true)}>
                    Edit Profil
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
