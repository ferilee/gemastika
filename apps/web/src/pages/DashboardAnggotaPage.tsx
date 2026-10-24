import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Laptop2,
  Mail,
  MapPin,
  Newspaper,
  School,
  Sparkles,
  Trophy,
  User,
  UserCheck,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAppData } from "@/state/AppDataContext";
import { useAuth } from "@/state/AuthContext";
import { isPast } from "@/lib/mgmp";

const STEPS = [
  { title: "Profil", shortTitle: "Profil", description: "Data keanggotaan", Icon: User },
  { title: "Kegiatan", shortTitle: "Agenda", description: "Agenda dan hadir", Icon: CalendarDays },
  { title: "Kontribusi", shortTitle: "Karya", description: "Karya dan berbagi", Icon: Laptop2 },
  { title: "Progres", shortTitle: "Progres", description: "XP dan peringkat", Icon: Trophy }
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

function WizardChoice({
  Icon,
  title,
  description,
  meta,
  active = false,
  onClick
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  meta?: string;
  active?: boolean;
  onClick: () => void;
}) {
  const className = [
    "group relative flex min-h-[142px] flex-col justify-between rounded-2xl border p-4 text-left transition-all",
    active
      ? "border-mgmp-primary bg-blue-50 shadow-[0_10px_24px_-16px_rgba(29,78,216,0.75)] dark:border-blue-400 dark:bg-blue-500/10"
      : "border-slate-200 bg-white/75 hover:-translate-y-0.5 hover:border-mgmp-primary/50 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-blue-400/50"
  ].join(" ");
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={["inline-flex h-11 w-11 items-center justify-center rounded-xl", active ? "bg-mgmp-primary text-white" : "bg-slate-100 text-mgmp-primary dark:bg-white/10 dark:text-blue-300"].join(" ")}>
          <Icon className="h-5 w-5" />
        </span>
        {active ? <CheckCircle2 className="h-5 w-5 text-mgmp-primary" /> : <ArrowRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 dark:text-slate-500" />}
      </div>
      <div className="mt-4">
        <div className="font-extrabold text-slate-800 dark:text-white">{title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</div>
        {meta ? <div className="mt-3 text-[11px] font-extrabold text-mgmp-primary dark:text-blue-300">{meta}</div> : null}
      </div>
    </>
  );

  return <button type="button" onClick={onClick} className={className}>{content}</button>;
}

type MemberModal = "profile" | "identity" | "agenda" | "history" | "portfolio" | "news" | "learning" | "xp" | "rank" | null;

const learningCategories = ["RPP / Modul Ajar", "Materi Pembelajaran", "Asesmen Interaktif", "LKPD Interaktif", "Bank Soal", "Media Pembelajaran", "Praktik Baik", "Perangkat Administrasi"] as const;

export function DashboardAnggotaPage() {
  const { user, profileRegistered, memberStatus } = useAuth();
  const { members, agendas, news, portfolios, addNews, addPortfolio, patchMember } = useAppData();
  const [currentStep, setCurrentStep] = useState(0);
  const [openModal, setOpenModal] = useState<MemberModal>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<number, boolean>>({});
  const [savingAttendanceId, setSavingAttendanceId] = useState<number | null>(null);
  const [attendanceNotice, setAttendanceNotice] = useState("");
  const [savingForm, setSavingForm] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", school: "", wa: "", telegram: "", photoUrl: "", profileUrl: "" });
  const [portfolioForm, setPortfolioForm] = useState({ teacherName: "", school: "", title: "", description: "", link: "", photoUrl: "" });
  const [newsForm, setNewsForm] = useState({ title: "", category: "Kegiatan", author: "", date: new Date().toISOString().slice(0, 10), imageUrl: "", summary: "", content: "", documentUrl: "" });
  const [learningForm, setLearningForm] = useState({ title: "", category: "RPP / Modul Ajar" as (typeof learningCategories)[number], description: "", phase: "Fase E", grade: "", topic: "", semester: "", curriculum: "Kurikulum Merdeka", resourceUrl: "", tags: "", changeNote: "" });
  const [learningFile, setLearningFile] = useState<File | null>(null);
  const [learningUploadMessage, setLearningUploadMessage] = useState("");
  const storageKey = `mgmp-dashboard-step:${user?.email || user?.sub || "guest"}`;

  const memberEmail = (user?.email || "").trim().toLowerCase();
  const currentMember = useMemo(() => {
    return members.find((member) => memberEmail && member.email.trim().toLowerCase() === memberEmail) || null;
  }, [memberEmail, members]);
  const myPortfolios = portfolios.filter((item) => item.createdByEmail.trim().toLowerCase() === memberEmail);
  const myNews = news.filter((item) => item.createdByEmail.trim().toLowerCase() === memberEmail);
  const nextAgenda = useMemo(
    () => agendas.filter((agenda) => !isPast(agenda.date)).sort((a, b) => a.date.localeCompare(b.date))[0] || null,
    [agendas]
  );
  const upcomingAgendas = useMemo(
    () => agendas.filter((agenda) => !isPast(agenda.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [agendas]
  );
  const finishedAgendas = useMemo(
    () => agendas.filter((agenda) => isPast(agenda.date)).sort((a, b) => b.date.localeCompare(a.date)),
    [agendas]
  );
  const finishedAgendaCount = agendas.filter((agenda) => isPast(agenda.date)).length;
  const memberRank = useMemo(() => {
    if (!currentMember) return 0;
    return [...members].sort((a, b) => (b.xp || 0) - (a.xp || 0)).findIndex((member) => member.id === currentMember.id) + 1;
  }, [currentMember, members]);
  const activeStep = STEPS[currentStep] ?? STEPS[0];
  const totalContributions = myPortfolios.length + myNews.length;
  const knowledgeNote = totalContributions > 0
    ? `Anda sudah membagikan ${totalContributions} kontribusi. Terima kasih sudah menghidupkan ruang berbagi MGMP.`
    : "Satu karya atau berita yang Anda bagikan dapat membantu anggota lain belajar lebih cepat.";

  function openProfileModal() {
    setProfileForm({
      name: currentMember?.name || user?.name || "",
      school: currentMember?.school || "",
      wa: currentMember?.wa || "",
      telegram: currentMember?.telegram || "",
      photoUrl: currentMember?.photoUrl || "",
      profileUrl: currentMember?.profileUrl || ""
    });
    setOpenModal("profile");
  }

  function openPortfolioModal() {
    setPortfolioForm({ teacherName: currentMember?.name || user?.name || "", school: currentMember?.school || "", title: "", description: "", link: "", photoUrl: "" });
    setOpenModal("portfolio");
  }

  function openNewsModal() {
    setNewsForm({ title: "", category: "Kegiatan", author: currentMember?.name || user?.name || "Anggota MGMP", date: new Date().toISOString().slice(0, 10), imageUrl: "", summary: "", content: "", documentUrl: "" });
    setOpenModal("news");
  }

  function openLearningModal() {
    setLearningForm({ title: "", category: "RPP / Modul Ajar", description: "", phase: "Fase E", grade: "", topic: "", semester: "", curriculum: "Kurikulum Merdeka", resourceUrl: "", tags: "", changeNote: "" });
    setLearningFile(null);
    setLearningUploadMessage("");
    setOpenModal("learning");
  }

  async function chooseLearningFile(file: File) {
    if (file.type.toLowerCase() !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      setLearningFile(null);
      setLearningUploadMessage("Materi hanya boleh berupa file PDF.");
      return;
    }
    const signature = new TextDecoder().decode(new Uint8Array(await file.slice(0, 5).arrayBuffer()));
    if (signature !== "%PDF-") {
      setLearningFile(null);
      setLearningUploadMessage("Isi file tidak terdeteksi sebagai PDF yang valid.");
      return;
    }
    setLearningFile(file);
    setLearningUploadMessage(`${file.name} siap dikirim.`);
  }

  async function saveProfile() {
    setSavingForm(true);
    try {
      const result = await api<{ member: import("@/types").Member }>("/api/profile/me", { method: "POST", body: JSON.stringify(profileForm) });
      patchMember(result.member);
      setOpenModal(null);
      alert("Profil anggota berhasil diperbarui.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Profil belum dapat disimpan.");
    } finally {
      setSavingForm(false);
    }
  }

  async function savePortfolio() {
    setSavingForm(true);
    try {
      const created = await api<import("@/types").Portfolio>("/api/portfolios", { method: "POST", body: JSON.stringify(portfolioForm) });
      addPortfolio(created);
      setOpenModal(null);
      alert("Portofolio dikirim dan menunggu pemeriksaan pengurus.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Portofolio belum dapat disimpan.");
    } finally {
      setSavingForm(false);
    }
  }

  async function saveNews() {
    setSavingForm(true);
    try {
      const created = await api<import("@/types").News>("/api/news", { method: "POST", body: JSON.stringify(newsForm) });
      addNews(created);
      setOpenModal(null);
      alert("Berita dikirim dan menunggu pemeriksaan pengurus.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Berita belum dapat disimpan.");
    } finally {
      setSavingForm(false);
    }
  }

  async function saveLearningResource() {
    if (!learningFile) {
      alert("Pilih file PDF terlebih dahulu.");
      return;
    }
    setSavingForm(true);
    try {
      const uploadBody = new FormData();
      uploadBody.append("file", learningFile);
      const uploadResponse = await fetch("/api/uploads/resource", { method: "POST", body: uploadBody, credentials: "include" });
      const uploadRaw = await uploadResponse.text();
      const uploadResult = JSON.parse(uploadRaw) as { url?: string; fileName?: string; key?: string; error?: string };
      if (!uploadResponse.ok || !uploadResult.url || !uploadResult.key) throw new Error(uploadResult.error || "Gagal mengunggah PDF.");
      await api("/api/learning-resources", { method: "POST", body: JSON.stringify({ ...learningForm, sourceType: "file", resourceUrl: uploadResult.url, fileName: uploadResult.fileName || learningFile.name, thumbnailUrl: "", storageKey: uploadResult.key, thumbnailStorageKey: "" }) });
      setOpenModal(null);
      alert("Materi dikirim dan menunggu pemeriksaan pengurus.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Materi belum dapat disimpan.");
    } finally {
      setSavingForm(false);
    }
  }

  function attendanceState(agenda: typeof agendas[number]) {
    if (!agenda.attendanceOpenAt || !agenda.attendanceCloseAt) return "not_configured" as const;
    const open = new Date(agenda.attendanceOpenAt).getTime();
    const close = new Date(agenda.attendanceCloseAt).getTime();
    const now = Date.now();
    if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) return "not_configured" as const;
    if (now < open) return "not_open" as const;
    if (now > close) return "closed" as const;
    return "open" as const;
  }

  async function markAttendance(agendaId: number) {
    if (!currentMember || savingAttendanceId) return;
    setSavingAttendanceId(agendaId);
    setAttendanceNotice("");
    try {
      const result = await api<{ already: boolean; attendance?: { xpAwarded: number } }>(`/api/agendas/${agendaId}/attendance`, { method: "POST", body: JSON.stringify({}) });
      setAttendanceStatus((items) => ({ ...items, [agendaId]: true }));
      setAttendanceNotice(result.already ? "Kehadiran Anda sudah tercatat sebelumnya." : `Kehadiran berhasil dicatat. XP +${result.attendance?.xpAwarded ?? 10}.`);
    } catch (error) {
      setAttendanceNotice(error instanceof Error ? error.message : "Kehadiran belum dapat dicatat.");
    } finally {
      setSavingAttendanceId(null);
    }
  }

  useEffect(() => {
    if (openModal !== "agenda" || !currentMember || !upcomingAgendas.length) return;
    let cancelled = false;
    void Promise.all(upcomingAgendas.map(async (agenda) => {
      try {
        const rows = await api<Array<{ memberId: number }>>(`/api/agendas/${agenda.id}/attendance`);
        return [agenda.id, rows.some((row) => row.memberId === currentMember.id)] as const;
      } catch {
        return [agenda.id, false] as const;
      }
    })).then((entries) => {
      if (!cancelled) setAttendanceStatus((items) => ({ ...items, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [currentMember, openModal, upcomingAgendas]);

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
      <div>
        <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-mgmp-primary">Dashboard anggota</div>
        <h1 className="mt-2 text-2xl font-extrabold text-mgmp-blue dark:text-white">Ruang perjalanan Anda</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Ikuti langkahnya untuk melihat aktivitas, kontribusi, dan perkembangan keanggotaan.</p>
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-[0_22px_70px_-36px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0b1220]/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_28px_80px_-38px_rgba(29,78,216,0.55)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-100">
          <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-500/10" />
          <div className="absolute -bottom-48 left-1/3 h-96 w-96 rounded-full bg-amber-100/50 blur-3xl dark:bg-amber-500/10" />
        </div>

        <div className="relative grid min-h-[650px] lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200/80 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-[#080e1a]/60 lg:border-b-0 lg:border-r lg:p-7">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {user?.picture ? (
                  <img src={user.picture} alt="" className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm dark:border-white/10" />
                ) : (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mgmp-primary text-sm font-extrabold text-white">{(user?.name || user?.email || "A").slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-slate-800 dark:text-white">{user?.name || "Anggota MGMP"}</div>
                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{user?.email || "-"}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ThemeToggle />
                <Link to="/dashboard" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-mgmp-primary dark:hover:bg-white/10" aria-label="Tutup dashboard anggota" title="Kembali ke dashboard">
                  <X className="h-5 w-5" />
                </Link>
              </div>
            </div>

            <div className="mt-8 hidden lg:block">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Perjalanan anggota</div>
              <div className="mt-2 text-xl font-extrabold text-slate-800 dark:text-white">Satu langkah pada satu waktu.</div>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Kenali ruang Anda di MGMP dan temukan cara untuk ikut berkontribusi.</p>
            </div>

            <nav className="relative mt-6 grid grid-cols-4 gap-2 lg:mt-10 lg:block lg:space-y-2" aria-label="Langkah dashboard anggota">
              <div aria-hidden className="absolute left-5 top-7 hidden h-[calc(100%-3.5rem)] w-px bg-slate-200 dark:bg-white/10 lg:block" />
              {STEPS.map((item, index) => {
                const completed = index < currentStep;
                const active = index === currentStep;
                const Icon = item.Icon;
                return (
                  <button key={item.title} type="button" onClick={() => setCurrentStep(index)} className="group relative z-10 flex w-full flex-col items-center gap-2 text-center lg:flex-row lg:gap-3 lg:rounded-xl lg:p-2 lg:text-left" aria-current={active ? "step" : undefined}>
                    <span className={["inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-slate-50 text-xs font-extrabold transition dark:border-[#080e1a]", active ? "bg-mgmp-primary text-white shadow-[0_0_0_4px_rgba(29,78,216,0.15)]" : completed ? "bg-emerald-500 text-white" : "bg-white text-slate-400 dark:bg-slate-800 dark:text-slate-400"].join(" ")}>
                      {completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 lg:block">
                      <span className={["block truncate text-[11px] font-extrabold sm:text-xs lg:text-sm", active ? "text-mgmp-primary dark:text-blue-300" : "text-slate-500 dark:text-slate-400"].join(" ")}>{item.title}</span>
                      <span className="hidden text-[11px] text-slate-400 lg:block dark:text-slate-500">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-8 hidden rounded-2xl border border-blue-100 bg-blue-50/80 p-4 dark:border-blue-400/20 dark:bg-blue-500/10 lg:block">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-mgmp-primary dark:text-blue-300">Tahukah Anda?</div>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{knowledgeNote}</p>
              <Link to="/bank-pembelajaran" className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-mgmp-primary hover:underline dark:text-blue-300">Jelajahi Bank Pembelajaran <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Langkah {currentStep + 1} dari {STEPS.length}</div>
                <h2 className="mt-3 max-w-2xl text-2xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-3xl">{currentStep === 0 ? "Bagaimana status profil keanggotaan Anda?" : null}{currentStep === 1 ? "Kegiatan apa yang ingin Anda lihat lebih dulu?" : null}{currentStep === 2 ? "Bagaimana Anda ingin berkontribusi?" : null}{currentStep === 3 ? "Bagaimana progres Anda saat ini?" : null}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{activeStep.description}. Pilih kartu untuk membuka halaman terkait.</p>
              </div>
              <Badge variant={memberStatus === "approved" ? "success" : "default"} className="hidden shrink-0 sm:inline-flex">{membershipLabel(memberStatus, profileRegistered)}</Badge>
            </div>

            <div className="mt-8 flex-1">
              {currentStep === 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <WizardChoice
                    Icon={profileRegistered ? CheckCircle2 : User}
                    title={profileRegistered ? "Profil sudah terdaftar" : "Lengkapi profil anggota"}
                    description={currentMember?.school || "Isi informasi sekolah dan data kontak agar profil Anda siap digunakan."}
                    meta={membershipLabel(memberStatus, profileRegistered)}
                    active={profileRegistered}
                    onClick={openProfileModal}
                  />
                  <WizardChoice
                    Icon={User}
                    title="Lihat identitas publik"
                    description="Periksa bagaimana nama dan sekolah Anda ditampilkan di daftar anggota MGMP."
                    meta={currentMember?.name || user?.name || "Anggota MGMP"}
                    onClick={() => setOpenModal("identity")}
                  />
                </div>
              ) : null}

              {currentStep === 1 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <WizardChoice
                    Icon={CalendarDays}
                    title={nextAgenda?.title || "Belum ada agenda mendatang"}
                    description={nextAgenda ? `${formatDate(nextAgenda.date)}${nextAgenda.time ? ` · ${nextAgenda.time}` : ""}` : "Lihat seluruh agenda dan kegiatan yang telah selesai."}
                    meta={nextAgenda ? `${nextAgenda.location || "Lokasi belum diatur"}` : `${finishedAgendaCount} kegiatan selesai`}
                    active={Boolean(nextAgenda)}
                    onClick={() => setOpenModal("agenda")}
                  />
                  <WizardChoice
                    Icon={CheckCircle2}
                    title="Riwayat kegiatan"
                    description="Buka daftar kegiatan yang telah berlangsung dan lihat laporan kehadiran."
                    meta={`${finishedAgendaCount} kegiatan selesai`}
                    onClick={() => setOpenModal("history")}
                  />
                  {nextAgenda ? <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 sm:col-span-2"><MapPin className="h-4 w-4 text-mgmp-primary" /> Agenda berikutnya berlangsung di {nextAgenda.location || "lokasi yang akan diumumkan"}.</div> : null}
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <WizardChoice Icon={Laptop2} title="Portofolio" description="Tampilkan karya, inovasi, dan praktik baik yang pernah Anda buat." meta={`${myPortfolios.length} karya tersimpan`} onClick={openPortfolioModal} />
                  <WizardChoice Icon={Newspaper} title="Berita" description="Bagikan kegiatan atau informasi yang bermanfaat bagi anggota." meta={`${myNews.length} berita dibagikan`} onClick={openNewsModal} />
                  <WizardChoice Icon={BookOpen} title="Bank Pembelajaran" description="Temukan atau bagikan modul ajar, perangkat, dan materi pembelajaran." meta="Buka ruang berbagi" onClick={openLearningModal} />
                </div>
              ) : null}

              {currentStep === 3 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <button type="button" onClick={() => setOpenModal("xp")} className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-left text-white shadow-lg shadow-blue-900/10 transition hover:-translate-y-0.5 hover:shadow-xl">
                    <div className="flex items-center justify-between"><div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/70">Total XP</div><Sparkles className="h-5 w-5 text-amber-300" /></div>
                    <div className="mt-7 text-5xl font-extrabold">{currentMember?.xp || 0}</div>
                    <div className="mt-2 text-sm text-white/75">Poin keaktifan Anda di MGMP.</div>
                  </button>
                  <button type="button" onClick={() => setOpenModal("rank")} className="rounded-2xl border border-slate-200 bg-white/75 p-5 text-left dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex items-center justify-between"><div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Peringkat anggota</div><Trophy className="h-5 w-5 text-amber-500" /></div>
                    <div className="mt-7 text-5xl font-extrabold text-slate-900 dark:text-white">{memberRank ? `#${memberRank}` : "-"}</div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Dari {members.length} anggota terdata.</div>
                  </button>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100 md:col-span-2">
                    <div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0" /><span>Terus hadir di kegiatan dan bagikan praktik baik untuk meningkatkan progres keanggotaan Anda.</span></div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-5 dark:border-white/10">
              <Button variant="ghost" onClick={previousStep} disabled={currentStep === 0}><ArrowLeft className="h-4 w-4" /> Sebelumnya</Button>
              {currentStep < STEPS.length - 1 ? (
                <Button onClick={nextStep} className="min-w-32 font-extrabold">Langkah berikutnya <ArrowRight className="h-4 w-4" /></Button>
              ) : (
                <Button asChild className="min-w-32 font-extrabold"><Link to="/dashboard">Selesai <CheckCircle2 className="h-4 w-4" /></Link></Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <Dialog open={Boolean(openModal)} onOpenChange={(open) => { if (!open) setOpenModal(null); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          {openModal === "profile" ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit profil anggota</DialogTitle>
                <DialogDescription>Perbarui data yang digunakan untuk aktivitas dan keanggotaan MGMP.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4 px-6 pb-6" onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
                <div className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-400/20 dark:bg-blue-500/10">
                  {user?.picture ? <img src={user.picture} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-mgmp-primary text-2xl font-extrabold text-white">{(currentMember?.name || user?.name || "A").slice(0, 1).toUpperCase()}</span>}
                  <div className="min-w-0"><div className="text-lg font-extrabold text-slate-900 dark:text-white">{currentMember?.name || user?.name || "Anggota MGMP"}</div><div className="mt-1 truncate text-sm text-slate-500 dark:text-slate-300">{currentMember?.school || "Sekolah belum tercatat"}</div><Badge variant="success" className="mt-2">{membershipLabel(memberStatus, profileRegistered)}</Badge></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nama lengkap<input required minLength={3} value={profileForm.name} onChange={(event) => setProfileForm((form) => ({ ...form, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Sekolah<input required minLength={3} value={profileForm.school} onChange={(event) => setProfileForm((form) => ({ ...form, school: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><Mail className="h-4 w-4" /> Email akun</div><div className="mt-1 break-all text-sm font-bold text-slate-800 dark:text-white">{user?.email || currentMember?.email || "-"}</div></div>
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">WhatsApp<input value={profileForm.wa} onChange={(event) => setProfileForm((form) => ({ ...form, wa: event.target.value }))} placeholder="08..." className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Telegram<input value={profileForm.telegram} onChange={(event) => setProfileForm((form) => ({ ...form, telegram: event.target.value }))} placeholder="@username" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">URL foto profil<input type="url" value={profileForm.photoUrl} onChange={(event) => setProfileForm((form) => ({ ...form, photoUrl: event.target.value }))} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-mgmp-primary dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Isi minimal salah satu kontak: WhatsApp atau Telegram.</p>
                <Button type="submit" className="w-full font-extrabold" disabled={savingForm}>{savingForm ? "Menyimpan..." : "Simpan perubahan"}</Button>
              </form>
            </>
          ) : null}

          {openModal === "identity" ? (
            <>
              <DialogHeader><DialogTitle>Identitas anggota</DialogTitle><DialogDescription>Data ringkas yang tampil pada ruang anggota MGMP.</DialogDescription></DialogHeader>
              <div className="space-y-4 px-6 pb-6">
                <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10"><div className="text-2xl font-extrabold text-slate-900 dark:text-white">{currentMember?.name || user?.name || "Anggota MGMP"}</div><div className="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><School className="h-4 w-4" /> {currentMember?.school || "Sekolah belum tercatat"}</div><div className="mt-4 flex flex-wrap gap-2"><Badge variant="primary">Anggota</Badge>{currentMember?.roles?.map((role) => <Badge key={role} variant="default">{role}</Badge>)}</div></div>
                <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">Profil ini digunakan untuk mengenali kontribusi Anda pada kegiatan, portofolio, berita, dan ruang pembelajaran MGMP.</div>
              </div>
            </>
          ) : null}

          {openModal === "agenda" ? (
            <>
              <DialogHeader><DialogTitle>Agenda mendatang</DialogTitle><DialogDescription>Kegiatan yang masih dapat Anda ikuti.</DialogDescription></DialogHeader>
              <div className="space-y-3 px-6 pb-6">
                {upcomingAgendas.length ? upcomingAgendas.slice(0, 8).map((agenda) => {
                  const windowState = attendanceState(agenda);
                  const marked = attendanceStatus[agenda.id] === true;
                  const canAttend = windowState === "open" && !marked;
                  const statusLabel = marked ? "Hadir tercatat" : windowState === "open" ? "Hadir" : windowState === "not_open" ? "Belum dibuka" : windowState === "closed" ? "Ditutup" : "Belum diatur";
                  return <div key={agenda.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10"><div className="flex items-start justify-between gap-3"><div className="font-extrabold text-slate-900 dark:text-white">{agenda.title}</div><Button size="sm" variant={marked ? "secondary" : "default"} disabled={!canAttend || savingAttendanceId === agenda.id} onClick={() => void markAttendance(agenda.id)}><UserCheck className="h-4 w-4" />{savingAttendanceId === agenda.id ? "Menyimpan..." : statusLabel}</Button></div><div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(agenda.date)}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {agenda.time || "Waktu belum ditentukan"}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {agenda.location || "Lokasi belum ditentukan"}</span></div></div>;
                }) : <div className="py-8 text-center text-sm text-slate-500">Belum ada agenda mendatang.</div>}
                {attendanceNotice ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100">{attendanceNotice}</div> : null}
              </div>
            </>
          ) : null}

          {openModal === "history" ? (
            <>
              <DialogHeader><DialogTitle>Riwayat kegiatan</DialogTitle><DialogDescription>Daftar kegiatan yang telah selesai.</DialogDescription></DialogHeader>
              <div className="space-y-3 px-6 pb-6">
                {finishedAgendas.length ? finishedAgendas.slice(0, 8).map((agenda) => <div key={agenda.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10"><div className="flex items-start justify-between gap-3"><div className="font-extrabold text-slate-900 dark:text-white">{agenda.title}</div><Badge variant="success">Selesai</Badge></div><div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(agenda.date)}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {agenda.location || "Lokasi tidak tercatat"}</span></div></div>) : <div className="py-8 text-center text-sm text-slate-500">Belum ada riwayat kegiatan.</div>}
              </div>
            </>
          ) : null}

          {openModal === "portfolio" ? (
            <>
              <DialogHeader><DialogTitle>Portofolio saya</DialogTitle><DialogDescription>Karya dan praktik baik yang dibuat menggunakan akun ini.</DialogDescription></DialogHeader>
              <div className="space-y-3 px-6 pb-6">
                {myPortfolios.length ? myPortfolios.map((portfolio) => <div key={portfolio.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10"><div className="font-extrabold text-slate-900 dark:text-white">{portfolio.title}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{portfolio.school || "Sekolah belum tercatat"}</div><div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{portfolio.description || "Belum ada deskripsi karya."}</div><div className="mt-3"><Badge variant={portfolio.publishStatus === "approved" ? "success" : "default"}>{portfolio.publishStatus}</Badge></div></div>) : <div className="py-8 text-center text-sm text-slate-500">Belum ada karya di portofolio Anda.</div>}
                <form className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-400/20 dark:bg-blue-500/10" onSubmit={(event) => { event.preventDefault(); void savePortfolio(); }}>
                  <div className="text-sm font-extrabold text-slate-800 dark:text-white">Tambah portofolio</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input required minLength={3} value={portfolioForm.title} onChange={(event) => setPortfolioForm((form) => ({ ...form, title: event.target.value }))} placeholder="Judul karya" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
                    <input value={portfolioForm.school} onChange={(event) => setPortfolioForm((form) => ({ ...form, school: event.target.value }))} placeholder="Sekolah" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
                  </div>
                  <textarea required minLength={10} value={portfolioForm.description} onChange={(event) => setPortfolioForm((form) => ({ ...form, description: event.target.value }))} placeholder="Deskripsi karya, inovasi, atau praktik baik" rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
                  <div className="grid gap-3 sm:grid-cols-2"><input type="url" value={portfolioForm.link} onChange={(event) => setPortfolioForm((form) => ({ ...form, link: event.target.value }))} placeholder="Tautan karya (opsional)" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /><input type="url" value={portfolioForm.photoUrl} onChange={(event) => setPortfolioForm((form) => ({ ...form, photoUrl: event.target.value }))} placeholder="Tautan gambar (opsional)" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>
                  <Button type="submit" className="w-full font-extrabold" disabled={savingForm}>{savingForm ? "Mengirim..." : "Kirim portofolio"}</Button>
                </form>
              </div>
            </>
          ) : null}

          {openModal === "news" ? (
            <>
              <DialogHeader><DialogTitle>Berita yang dibagikan</DialogTitle><DialogDescription>Informasi dan kegiatan yang dibuat menggunakan akun ini.</DialogDescription></DialogHeader>
              <div className="space-y-3 px-6 pb-6">
                {myNews.length ? myNews.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10"><div className="font-extrabold text-slate-900 dark:text-white">{item.title}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.category} · {formatDate(item.date)}</div><div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.summary || "Belum ada ringkasan berita."}</div><div className="mt-3"><Badge variant={item.publishStatus === "approved" ? "success" : "default"}>{item.publishStatus}</Badge></div></div>) : <div className="py-8 text-center text-sm text-slate-500">Belum ada berita yang dibagikan.</div>}
                <form className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-400/20 dark:bg-blue-500/10" onSubmit={(event) => { event.preventDefault(); void saveNews(); }}>
                  <div className="text-sm font-extrabold text-slate-800 dark:text-white">Tulis berita</div>
                  <div className="grid gap-3 sm:grid-cols-2"><input required minLength={3} value={newsForm.title} onChange={(event) => setNewsForm((form) => ({ ...form, title: event.target.value }))} placeholder="Judul berita" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /><input value={newsForm.category} onChange={(event) => setNewsForm((form) => ({ ...form, category: event.target.value }))} placeholder="Kategori" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>
                  <div className="grid gap-3 sm:grid-cols-2"><input type="date" required value={newsForm.date} onChange={(event) => setNewsForm((form) => ({ ...form, date: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /><input type="url" value={newsForm.imageUrl} onChange={(event) => setNewsForm((form) => ({ ...form, imageUrl: event.target.value }))} placeholder="Tautan gambar (opsional)" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>
                  <input required minLength={10} value={newsForm.summary} onChange={(event) => setNewsForm((form) => ({ ...form, summary: event.target.value }))} placeholder="Ringkasan berita" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
                  <textarea required minLength={10} value={newsForm.content} onChange={(event) => setNewsForm((form) => ({ ...form, content: event.target.value }))} placeholder="Isi berita" rows={5} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
                  <input type="url" value={newsForm.documentUrl} onChange={(event) => setNewsForm((form) => ({ ...form, documentUrl: event.target.value }))} placeholder="Tautan dokumen (opsional)" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
                  <Button type="submit" className="w-full font-extrabold" disabled={savingForm}>{savingForm ? "Mengirim..." : "Kirim berita"}</Button>
                </form>
              </div>
            </>
          ) : null}

          {openModal === "learning" ? (
            <>
              <DialogHeader><DialogTitle>Bank Pembelajaran</DialogTitle><DialogDescription>Ruang berbagi modul ajar dan praktik baik untuk anggota MGMP.</DialogDescription></DialogHeader>
              <form className="space-y-3 px-6 pb-6" onSubmit={(event) => { event.preventDefault(); void saveLearningResource(); }}>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-400/20 dark:bg-blue-500/10"><BookOpen className="h-6 w-6 text-mgmp-primary dark:text-blue-300" /><div className="mt-3 font-extrabold text-slate-900 dark:text-white">Bagikan materi PDF</div><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Unggah satu file PDF. Kiriman akan diperiksa sebelum dipublikasikan.</p></div>
                <input required type="file" accept=".pdf,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseLearningFile(file); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
                {learningUploadMessage ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100">{learningUploadMessage}</div> : null}
                <input required minLength={3} value={learningForm.title} onChange={(event) => setLearningForm((form) => ({ ...form, title: event.target.value }))} placeholder="Judul materi" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
                <div className="grid gap-3 sm:grid-cols-2"><select value={learningForm.category} onChange={(event) => setLearningForm((form) => ({ ...form, category: event.target.value as (typeof learningCategories)[number] }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white">{learningCategories.map((category) => <option key={category}>{category}</option>)}</select><input required value={learningForm.phase} onChange={(event) => setLearningForm((form) => ({ ...form, phase: event.target.value }))} placeholder="Fase" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>
                <div className="grid gap-3 sm:grid-cols-2"><input required value={learningForm.grade} onChange={(event) => setLearningForm((form) => ({ ...form, grade: event.target.value }))} placeholder="Kelas" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /><input required minLength={2} value={learningForm.topic} onChange={(event) => setLearningForm((form) => ({ ...form, topic: event.target.value }))} placeholder="Topik" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>
                <textarea required minLength={10} value={learningForm.description} onChange={(event) => setLearningForm((form) => ({ ...form, description: event.target.value }))} placeholder="Deskripsi materi" rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
                <div className="grid gap-3 sm:grid-cols-2"><input required value={learningForm.semester} onChange={(event) => setLearningForm((form) => ({ ...form, semester: event.target.value }))} placeholder="Semester" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /><input value={learningForm.tags} onChange={(event) => setLearningForm((form) => ({ ...form, tags: event.target.value }))} placeholder="Tag, pisahkan dengan koma" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>
                <Button type="submit" className="w-full font-extrabold" disabled={savingForm || !learningFile}>{savingForm ? "Mengirim..." : "Kirim materi PDF"}</Button>
              </form>
            </>
          ) : null}

          {openModal === "xp" ? (
            <>
              <DialogHeader><DialogTitle>Total XP Anda</DialogTitle><DialogDescription>XP menunjukkan akumulasi keaktifan Anda di MGMP.</DialogDescription></DialogHeader>
              <div className="space-y-4 px-6 pb-6"><div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white"><div className="text-xs font-extrabold uppercase tracking-widest text-white/70">Total XP</div><div className="mt-3 text-5xl font-extrabold">{currentMember?.xp || 0}</div><div className="mt-2 text-sm text-white/80">Poin keaktifan yang tercatat pada profil Anda.</div></div><div className="text-sm leading-6 text-slate-600 dark:text-slate-300">XP dapat bertambah melalui partisipasi kegiatan dan kontribusi yang tercatat dalam sistem MGMP.</div></div>
            </>
          ) : null}

          {openModal === "rank" ? (
            <>
              <DialogHeader><DialogTitle>Peringkat anggota</DialogTitle><DialogDescription>Urutan berdasarkan XP yang tercatat saat ini.</DialogDescription></DialogHeader>
              <div className="space-y-2 px-6 pb-6">{[...members].sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 8).map((member, index) => <div key={member.id} className={["flex items-center gap-3 rounded-xl border p-3", member.id === currentMember?.id ? "border-blue-300 bg-blue-50 dark:border-blue-400/40 dark:bg-blue-500/10" : "border-slate-200 dark:border-white/10"].join(" ")}><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-600 dark:bg-white/10 dark:text-slate-300">#{index + 1}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{member.name}</div><div className="truncate text-xs text-slate-500 dark:text-slate-400">{member.school}</div></div><div className="text-sm font-extrabold text-mgmp-primary">{member.xp || 0} XP</div></div>)}</div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
