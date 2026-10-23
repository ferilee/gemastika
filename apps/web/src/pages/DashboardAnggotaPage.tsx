import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Laptop2,
  MapPin,
  Newspaper,
  Trophy,
  User
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/state/AppDataContext";
import { useAuth } from "@/state/AuthContext";
import { isPast } from "@/lib/mgmp";

const STEPS = [
  { title: "Profil", description: "Pastikan data keanggotaan Anda lengkap.", Icon: User },
  { title: "Kegiatan", description: "Ikuti agenda dan catat kehadiran Anda.", Icon: CalendarDays },
  { title: "Kontribusi", description: "Bagikan karya dan informasi pembelajaran.", Icon: Laptop2 },
  { title: "Progres", description: "Lihat XP dan perkembangan keanggotaan Anda.", Icon: Trophy }
] as const;

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function membershipLabel(status: string, registered: boolean) {
  if (!registered) return "Profil belum lengkap";
  if (status === "approved") return "Anggota aktif";
  if (status === "pending") return "Menunggu persetujuan";
  return "Keanggotaan ditolak";
}

export function DashboardAnggotaPage() {
  const { user, profileRegistered, memberStatus } = useAuth();
  const { members, agendas, news, portfolios } = useAppData();
  const [currentStep, setCurrentStep] = useState(0);
  const storageKey = `mgmp-dashboard-step:${user?.email || user?.sub || "guest"}`;

  const roles = user?.roles?.length ? user.roles : user?.role ? [user.role] : [];
  const currentMember = useMemo(() => {
    const email = (user?.email || "").trim().toLowerCase();
    return members.find((member) => email && member.email.trim().toLowerCase() === email) || null;
  }, [members, user?.email]);
  const memberEmail = (user?.email || "").trim().toLowerCase();
  const myPortfolios = portfolios.filter((item) => item.createdByEmail.trim().toLowerCase() === memberEmail);
  const myNews = news.filter((item) => item.createdByEmail.trim().toLowerCase() === memberEmail);
  const nextAgenda = useMemo(
    () => agendas.filter((agenda) => !isPast(agenda.date)).sort((a, b) => a.date.localeCompare(b.date))[0] || null,
    [agendas]
  );
  const finishedAgendaCount = agendas.filter((agenda) => isPast(agenda.date)).length;
  const memberRank = useMemo(() => {
    if (!currentMember) return 0;
    return [...members].sort((a, b) => (b.xp || 0) - (a.xp || 0)).findIndex((member) => member.id === currentMember.id) + 1;
  }, [currentMember, members]);
  const step = STEPS[currentStep];
  const StepIcon = step.Icon;

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isInteger(saved) && saved >= 0 && saved < STEPS.length) setCurrentStep(saved);
    } catch {
      // Continue from the first step when browser storage is unavailable.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(currentStep));
    } catch {
      // The wizard remains usable without persistence.
    }
  }, [currentStep, storageKey]);

  function nextStep() {
    setCurrentStep((value) => Math.min(STEPS.length - 1, value + 1));
  }

  function previousStep() {
    setCurrentStep((value) => Math.max(0, value - 1));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-extrabold uppercase tracking-widest text-mgmp-primary">Perjalanan Anggota</div>
          <h1 className="mt-2 text-2xl font-extrabold text-mgmp-blue dark:text-white">Halo, {user?.name || user?.email || "Anggota"}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Ikuti langkah singkat untuk melihat aktivitas dan progres Anda.</p>
        </div>
        <Badge variant={memberStatus === "approved" ? "success" : "default"}>{membershipLabel(memberStatus, profileRegistered)}</Badge>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((item, index) => {
              const Icon = item.Icon;
              const completed = index < currentStep;
              const active = index === currentStep;
              return (
                <div key={item.title} className="flex flex-1 items-center gap-2 last:flex-none">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className="group flex min-w-0 items-center gap-2 text-left"
                    aria-current={active ? "step" : undefined}
                  >
                    <span
                      className={[
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-extrabold transition",
                        active
                          ? "border-mgmp-primary bg-mgmp-primary text-white"
                          : completed
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-slate-100 text-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-slate-400"
                      ].join(" ")}
                    >
                      {completed ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="hidden min-w-0 sm:block">
                      <span className={active ? "block truncate text-sm font-extrabold text-mgmp-primary" : "block truncate text-sm font-bold text-slate-600 dark:text-slate-300"}>{item.title}</span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">Langkah {index + 1}</span>
                    </span>
                  </button>
                  {index < STEPS.length - 1 ? <span className={completed ? "mx-1 h-px flex-1 bg-emerald-400" : "mx-1 h-px flex-1 bg-slate-200 dark:bg-white/10"} /> : null}
                </div>
              );
            })}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full rounded-full bg-mgmp-primary transition-all" style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[330px]">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Langkah {currentStep + 1} dari {STEPS.length}</div>
            <CardTitle className="mt-2 inline-flex items-center gap-2 text-mgmp-blue dark:text-white"><StepIcon className="h-5 w-5 text-mgmp-primary" /> {step.title}</CardTitle>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{step.description}</p>
          </div>
          <Badge variant="primary">{currentStep + 1}/{STEPS.length}</Badge>
        </CardHeader>

        <CardContent>
          {currentStep === 0 ? (
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-lg font-extrabold text-slate-800 dark:text-white">{currentMember?.name || user?.name || "Profil anggota"}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentMember?.school || "Lengkapi profil agar informasi anggota tercatat."}</div>
                <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div><span className="text-slate-500 dark:text-slate-400">Email</span><div className="font-bold text-slate-700 dark:text-slate-200">{user?.email || "-"}</div></div>
                  <div><span className="text-slate-500 dark:text-slate-400">Role</span><div className="font-bold capitalize text-slate-700 dark:text-slate-200">{roles.join(", ") || "anggota"}</div></div>
                </div>
              </div>
              <Button asChild className="font-extrabold"><Link to="/profil"><User className="h-4 w-4" /> Buka Profil</Link></Button>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                {nextAgenda ? (
                  <>
                    <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Agenda berikutnya</div>
                    <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-white">{nextAgenda.title}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {formatDate(nextAgenda.date)}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {nextAgenda.location || "-"}</span>
                    </div>
                  </>
                ) : <div className="text-sm text-slate-500 dark:text-slate-400">Belum ada agenda mendatang.</div>}
                <div className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">{finishedAgendaCount} kegiatan telah selesai.</div>
              </div>
              <Button asChild variant="secondary" className="font-extrabold"><Link to="/kegiatan"><CalendarDays className="h-4 w-4" /> Lihat Agenda</Link></Button>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                <Laptop2 className="h-5 w-5 text-emerald-500" />
                <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white">{myPortfolios.length}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Karya di portofolio</div>
                <Button asChild variant="ghost" size="sm" className="mt-3 px-0 font-extrabold"><Link to="/portofolio">Buka Portofolio <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                <Newspaper className="h-5 w-5 text-sky-500" />
                <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white">{myNews.length}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Berita yang dibagikan</div>
                <Button asChild variant="ghost" size="sm" className="mt-3 px-0 font-extrabold"><Link to="/berita">Buka Berita <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5 sm:col-span-2">
                <BookOpen className="h-5 w-5 text-mgmp-primary" />
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Bagikan perangkat ajar dan praktik baik melalui Bank Pembelajaran.</div>
                <Button asChild variant="ghost" size="sm" className="mt-2 px-0 font-extrabold"><Link to="/bank-pembelajaran">Buka Bank Pembelajaran <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
                <div className="text-xs font-extrabold uppercase tracking-widest text-white/70">Total XP</div>
                <div className="mt-2 text-4xl font-extrabold">{currentMember?.xp || 0}</div>
                <div className="mt-1 text-sm text-white/80">Poin keaktifan Anda</div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
                <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Peringkat</div>
                <div className="mt-2 text-4xl font-extrabold text-slate-800 dark:text-white">{memberRank ? `#${memberRank}` : "-"}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Dari {members.length} anggota</div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 md:col-span-2">
                Terus hadir di kegiatan dan berkontribusi untuk meningkatkan progres keanggotaan Anda.
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={previousStep} disabled={currentStep === 0}><ArrowLeft className="h-4 w-4" /> Sebelumnya</Button>
        <div className="flex items-center gap-2">
          {currentStep < STEPS.length - 1 ? <Button variant="ghost" onClick={() => setCurrentStep(STEPS.length - 1)}>Lewati ke Progres</Button> : null}
          <Button onClick={nextStep} disabled={currentStep === STEPS.length - 1}>{currentStep === STEPS.length - 1 ? "Selesai" : "Berikutnya"} {currentStep < STEPS.length - 1 ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</Button>
        </div>
      </div>
    </div>
  );
}
