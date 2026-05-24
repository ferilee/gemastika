import { AlertTriangle, CalendarDays, ChevronRight, Clock, Eye, MapPin, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppData } from "@/state/AppDataContext";
import { agendaBlock, isPast } from "@/lib/mgmp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api } from "@/api/client";
import type { Member } from "@/types";
import { hasRole, useAuth } from "@/state/AuthContext";

function roleLabel(role: Member["role"]) {
  if (role === "admin") return "Admin";
  if (role === "pengurus") return "Pengurus";
  return "Anggota";
}

function schoolNameOnly(school: string) {
  return school.split(" - ")[0]?.trim() || school;
}

export function KegiatanPage() {
  const { user, isApprovedMember } = useAuth();
  const { agendas, loading, members, patchMember, reload } = useAppData();
  const [openAttend, setOpenAttend] = useState(false);
  const [attendAgendaId, setAttendAgendaId] = useState<number | null>(null);
  const [attendMemberId, setAttendMemberId] = useState<string>("");
  const [attendXp, setAttendXp] = useState<number>(10);
  const [confirmPresent, setConfirmPresent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editingAgendaId, setEditingAgendaId] = useState<number | null>(null);
  const [agendaTitle, setAgendaTitle] = useState("");
  const [agendaDate, setAgendaDate] = useState("");
  const [agendaTime, setAgendaTime] = useState("");
  const [agendaLocation, setAgendaLocation] = useState("");
  const [agendaDescription, setAgendaDescription] = useState("");
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [openAttendanceList, setOpenAttendanceList] = useState(false);
  const [openFinishedModal, setOpenFinishedModal] = useState(false);
  const [openFinalConfirm, setOpenFinalConfirm] = useState(false);
  const [attendanceAgendaId, setAttendanceAgendaId] = useState<number | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<
    Array<{ id: number; memberId: number; memberName: string; memberSchool: string; memberRole: string; xpAwarded: number; createdAt: string }>
  >([]);
  const [attendanceCountByAgenda, setAttendanceCountByAgenda] = useState<Record<number, number>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceInstansiFilter, setAttendanceInstansiFilter] = useState("all");
  const [openAttendSuccess, setOpenAttendSuccess] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const isAdminOrPengurus = hasRole(user, "admin") || hasRole(user, "pengurus");
  const isAdmin = hasRole(user, "admin");
  const selfMember = useMemo(() => {
    const email = (user?.email || "").trim().toLowerCase();
    if (!email) return null;
    return members.find((m) => (m.email || "").trim().toLowerCase() === email) || null;
  }, [members, user?.email]);

  const upcomingAgenda = (() => {
    const next = agendas.find((a) => !isPast(a.date));
    return next || agendas[0] || null;
  })();

  const selectedAgenda = useMemo(
    () => (attendAgendaId ? agendas.find((a) => a.id === attendAgendaId) || null : null),
    [agendas, attendAgendaId]
  );

  const selectedMember = useMemo<Member | null>(() => {
    const id = Number(attendMemberId);
    if (!id) return null;
    return members.find((m) => m.id === id) || null;
  }, [attendMemberId, members]);

  const selectedAttendanceAgenda = useMemo(
    () => (attendanceAgendaId ? agendas.find((a) => a.id === attendanceAgendaId) || null : null),
    [agendas, attendanceAgendaId]
  );
  const activeAgendas = useMemo(() => agendas.filter((a) => !isPast(a.date)), [agendas]);
  const finishedAgendas = useMemo(() => agendas.filter((a) => isPast(a.date)), [agendas]);
  const attendanceInstansiOptions = useMemo(
    () => Array.from(new Set(attendanceRows.map((r) => schoolNameOnly(r.memberSchool)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [attendanceRows]
  );
  const filteredAttendanceRows = useMemo(
    () => attendanceRows.filter((r) => attendanceInstansiFilter === "all" || schoolNameOnly(r.memberSchool) === attendanceInstansiFilter),
    [attendanceInstansiFilter, attendanceRows]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!agendas.length) {
        setAttendanceCountByAgenda({});
        return;
      }
      try {
        const entries = await Promise.all(
          agendas.map(async (a) => {
            const rows = await api<
              Array<{ id: number; memberId: number; memberName: string; memberSchool: string; memberRole: string; xpAwarded: number; createdAt: string }>
            >(`/api/agendas/${a.id}/attendance`);
            return [a.id, rows.length] as const;
          })
        );
        if (cancelled) return;
        setAttendanceCountByAgenda(Object.fromEntries(entries));
      } catch {
        if (!cancelled) setAttendanceCountByAgenda({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agendas]);

  function agendaIsExpired(date: string, time: string) {
    const base = date?.trim();
    if (!base) return false;
    const timeText = (time || "").trim();
    const isoLike = `${base}T${timeText && timeText.length >= 4 ? timeText : "23:59"}`;
    const dt = new Date(isoLike);
    if (Number.isNaN(dt.getTime())) return isPast(base);
    return dt.getTime() < Date.now();
  }

  function openAttendance(agendaId: number) {
    setAttendAgendaId(agendaId);
    setAttendMemberId(isAdminOrPengurus ? "" : String(selfMember?.id || ""));
    setAttendXp(10);
    setConfirmPresent(false);
    setOpenAttend(true);
  }

  function openCreateAgenda() {
    setEditingAgendaId(null);
    setAgendaTitle("");
    setAgendaDate("");
    setAgendaTime("");
    setAgendaLocation("");
    setAgendaDescription("");
    setOpenForm(true);
  }

  function openEditAgenda(agendaId: number) {
    const found = agendas.find((a) => a.id === agendaId);
    if (!found) return;
    setEditingAgendaId(agendaId);
    setAgendaTitle(found.title || "");
    setAgendaDate(found.date || "");
    setAgendaTime(found.time || "");
    setAgendaLocation(found.location || "");
    setAgendaDescription(found.description || "");
    setOpenForm(true);
  }

  async function saveAgenda() {
    if (!agendaTitle.trim() || !agendaDate.trim()) return;
    setSavingAgenda(true);
    try {
      const payload = {
        title: agendaTitle.trim(),
        date: agendaDate.trim(),
        time: agendaTime.trim(),
        location: agendaLocation.trim(),
        description: agendaDescription.trim()
      };
      if (editingAgendaId) {
        await api(`/api/agendas/${editingAgendaId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/api/agendas", { method: "POST", body: JSON.stringify(payload) });
      }
      await reload();
      setOpenForm(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan agenda.");
    } finally {
      setSavingAgenda(false);
    }
  }

  async function deleteAgenda(agendaId: number) {
    const ok = window.confirm("Hapus agenda ini?");
    if (!ok) return;
    try {
      await api(`/api/agendas/${agendaId}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menghapus agenda.");
    }
  }

  async function viewAttendance(agendaId: number) {
    setAttendanceAgendaId(agendaId);
    setOpenAttendanceList(true);
    setAttendanceInstansiFilter("all");
    setLoadingAttendance(true);
    try {
      const rows = await api<
        Array<{ id: number; memberId: number; memberName: string; memberSchool: string; memberRole: string; xpAwarded: number; createdAt: string }>
      >(`/api/agendas/${agendaId}/attendance`);
      setAttendanceRows(rows || []);
    } catch {
      setAttendanceRows([]);
    } finally {
      setLoadingAttendance(false);
    }
  }

  async function submitAttendance() {
    if (!attendAgendaId) return;
    if (!isAdminOrPengurus && !confirmPresent) return;
    const memberId = Number(attendMemberId);
    if (isAdminOrPengurus && !memberId) return;
    setSaving(true);
    try {
      const res = await api<{ already: boolean; member: Member; attendance?: { xpAwarded: number } }>(`/api/agendas/${attendAgendaId}/attendance`, {
        method: "POST",
        body: JSON.stringify(isAdminOrPengurus ? { memberId, xp: attendXp } : {})
      });
      patchMember(res.member);
      setOpenAttend(false);
      if (!isAdminOrPengurus) {
        setAlreadyMarked(Boolean(res.already));
        setEarnedXp(res.attendance?.xpAwarded ?? 10);
        setOpenAttendSuccess(true);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan kehadiran.");
    } finally {
      setSaving(false);
    }
  }

  function requestSubmitAttendance() {
    if (isAdminOrPengurus) {
      void submitAttendance();
      return;
    }
    setOpenFinalConfirm(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">Kegiatan</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Jadwal agenda lengkap kegiatan MGMP.</p>
      </div>
      {isAdmin ? (
        <div className="flex justify-end">
          <Button onClick={openCreateAgenda} size="sm" className="font-extrabold">
            <Plus className="h-4 w-4" /> Tambah Kegiatan
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-mgmp-blue dark:text-white">Agenda Terdekat</CardTitle>
          <Badge variant="success">Highlight</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : upcomingAgenda ? (
              (() => {
                const b = agendaBlock(upcomingAgenda.date);
                return (
                  <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-24 flex-shrink-0 rounded-2xl bg-slate-100 dark:bg-black/20 border border-slate-200/70 dark:border-white/10 p-3 text-center">
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          {b.monthYear}
                        </div>
                        <div className="mt-2 text-4xl font-extrabold text-mgmp-primary leading-none">{b.day}</div>
                        <div className="mt-1 text-sm font-extrabold text-slate-600 dark:text-slate-300">{b.weekday}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-extrabold text-slate-800 dark:text-slate-100">{upcomingAgenda.title}</div>
                          <Badge variant={isPast(upcomingAgenda.date) ? "default" : "success"}>
                            {isPast(upcomingAgenda.date) ? "Selesai" : "Mendatang"}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4" /> {upcomingAgenda.date}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-4 w-4" /> {upcomingAgenda.time || "-"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" /> {upcomingAgenda.location || "-"}
                          </span>
                        </div>
                        {upcomingAgenda.description ? (
                          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{upcomingAgenda.description}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-sm text-slate-500">Belum ada agenda tersedia.</div>
            )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)
        ) : activeAgendas.length === 0 ? (
          <div className="text-center text-slate-500 py-10">Belum ada agenda tersedia.</div>
        ) : (
          activeAgendas.map((a) => (
            <Card key={a.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-slate-800 dark:text-slate-100">{a.title}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" /> {a.date}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" /> {a.time || "-"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" /> {a.location || "-"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                      onClick={() => openAttendance(a.id)}
                      disabled={!isApprovedMember || agendaIsExpired(a.date, a.time)}
                    >
                      <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Hadir</span>
                    </Button>
                    <Button
                      size="sm"
                      className="bg-sky-600 text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400"
                      onClick={() => void viewAttendance(a.id)}
                    >
                      <Eye className="h-4 w-4" />
                      <span className="hidden sm:inline">View</span>
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-extrabold text-white">
                        {attendanceCountByAgenda[a.id] ?? 0}
                      </span>
                    </Button>
                    {isAdmin ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => openEditAgenda(a.id)}>
                          <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => void deleteAgenda(a.id)}>
                          <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Hapus</span>
                        </Button>
                      </>
                    ) : null}
                    <Badge variant="success">Mendatang</Badge>
                  </div>
                </div>
                {a.description ? <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{a.description}</div> : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {finishedAgendas.length > 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-extrabold text-slate-800 dark:text-slate-100">Kegiatan Selesai</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{finishedAgendas.length} agenda selesai</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setOpenFinishedModal(true)} aria-label="Lihat kegiatan selesai">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Lihat</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {!isApprovedMember ? (
        <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          Mode tamu: fitur checklist kehadiran hanya tersedia setelah akun disetujui admin.
        </div>
      ) : null}

      <Dialog open={openAttend} onOpenChange={setOpenAttend}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Konfirmasi Kehadiran</DialogTitle>
            <DialogDescription>
              {selectedAgenda ? `${selectedAgenda.title} • ${selectedAgenda.date}` : "Pilih agenda kegiatan."}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-3">
            {isAdminOrPengurus ? (
              <>
                <Select value={attendMemberId} onValueChange={setAttendMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih anggota" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name} • {roleLabel(m.role)} • {m.school}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-1">XP Ditambahkan</div>
                    <Input
                      type="number"
                      min={0}
                      max={1000}
                      value={attendXp}
                      onChange={(e) => setAttendXp(Number(e.target.value))}
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
                    <div className="text-xs font-extrabold text-slate-500 dark:text-slate-400">Preview</div>
                    <div className="mt-1 text-sm font-extrabold text-slate-800 dark:text-white">
                      {selectedMember ? selectedMember.name : "-"}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">XP saat ini: {selectedMember?.xp ?? 0}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
                  <div className="text-xs font-extrabold text-slate-500 dark:text-slate-400">Nama Kegiatan</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-800 dark:text-white">{selectedAgenda?.title || "-"}</div>
                </div>
                <label
                  className={[
                    "flex items-center gap-3 rounded-2xl p-3 cursor-pointer select-none transition",
                    confirmPresent
                      ? "border-2 border-mgmp-primary bg-mgmp-primary/10 dark:bg-mgmp-primary/20 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
                      : "border-2 border-amber-300/80 dark:border-amber-400/40 bg-amber-50/80 dark:bg-amber-500/10"
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={confirmPresent}
                    onChange={(e) => setConfirmPresent(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-mgmp-primary accent-mgmp-primary"
                  />
                  <div className="min-w-0">
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Saya hadir pada kegiatan ini</span>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">Checklist wajib sebelum konfirmasi kehadiran.</div>
                  </div>
                  <span className="ml-auto inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                    +10 XP
                  </span>
                </label>
                <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <span className="font-extrabold">Peringatan:</span> Konfirmasi kehadiran yang sudah dikirim{" "}
                    <span className="font-extrabold">tidak dapat dibatalkan</span>.
                  </div>
                </div>
              </div>
            )}

            <Button
              disabled={saving || !attendAgendaId || (isAdminOrPengurus ? !attendMemberId : !confirmPresent)}
              onClick={requestSubmitAttendance}
              className="w-full"
            >
              {saving ? "Menyimpan..." : "Konfirmasi Kehadiran"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openFinalConfirm} onOpenChange={setOpenFinalConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Akhir</DialogTitle>
            <DialogDescription>Setelah konfirmasi dikirim, kehadiran tidak dapat dibatalkan.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-2">
            <div className="text-sm text-slate-700 dark:text-slate-200">Pastikan Anda benar-benar hadir pada kegiatan ini.</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setOpenFinalConfirm(false)}>
                Kembali
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                onClick={() => {
                  setOpenFinalConfirm(false);
                  void submitAttendance();
                }}
              >
                Ya, Konfirmasi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openAttendSuccess} onOpenChange={setOpenAttendSuccess}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{alreadyMarked ? "Kehadiran Sudah Tercatat" : "Kehadiran Berhasil"}</DialogTitle>
            <DialogDescription>
              {selectedAgenda ? `${selectedAgenda.title} • ${selectedAgenda.date}` : "Terima kasih sudah melakukan konfirmasi."}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 dark:border-emerald-400/30 bg-emerald-50/90 dark:bg-emerald-500/10 p-4">
              <div className="pointer-events-none absolute inset-0">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span
                    key={i}
                    className={[
                      "absolute h-2.5 w-2.5 rounded-full animate-bounce opacity-80",
                      i % 4 === 0 ? "bg-rose-400" : i % 4 === 1 ? "bg-amber-400" : i % 4 === 2 ? "bg-emerald-400" : "bg-sky-400"
                    ].join(" ")}
                    style={{
                      left: `${(i * 13) % 100}%`,
                      top: `${(i * 17) % 100}%`,
                      animationDelay: `${(i % 6) * 80}ms`,
                      animationDuration: `${900 + (i % 4) * 150}ms`
                    }}
                  />
                ))}
              </div>
              <div className="relative">
                {alreadyMarked ? (
                  <div className="text-sm text-emerald-800 dark:text-emerald-100">
                    Anda sudah pernah melakukan konfirmasi hadir untuk kegiatan ini.
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-emerald-800 dark:text-emerald-100">Terima kasih, kehadiran Anda sudah tercatat.</div>
                    <div className="mt-2 text-lg font-extrabold text-emerald-700 dark:text-emerald-200">XP +{earnedXp}</div>
                  </>
                )}
              </div>
            </div>
            <Button className="w-full mt-4" onClick={() => setOpenAttendSuccess(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingAgendaId ? "Edit Kegiatan" : "Tambah Kegiatan"}</DialogTitle>
            <DialogDescription>Kelola agenda kegiatan MGMP (khusus admin).</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-3">
            <Input placeholder="Nama kegiatan" value={agendaTitle} onChange={(e) => setAgendaTitle(e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input type="date" value={agendaDate} onChange={(e) => setAgendaDate(e.target.value)} />
              <Input type="time" value={agendaTime} onChange={(e) => setAgendaTime(e.target.value)} />
            </div>
            <Input placeholder="Lokasi kegiatan" value={agendaLocation} onChange={(e) => setAgendaLocation(e.target.value)} />
            <Input placeholder="Deskripsi singkat" value={agendaDescription} onChange={(e) => setAgendaDescription(e.target.value)} />
            <Button disabled={savingAgenda || !agendaTitle.trim() || !agendaDate.trim()} onClick={() => void saveAgenda()} className="w-full">
              {savingAgenda ? "Menyimpan..." : "Simpan Kegiatan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openAttendanceList} onOpenChange={setOpenAttendanceList}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Daftar Kehadiran</DialogTitle>
            <DialogDescription>
              {selectedAttendanceAgenda ? `${selectedAttendanceAgenda.title} • ${selectedAttendanceAgenda.date}` : "Daftar anggota hadir."}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            {!loadingAttendance ? (
              <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <Select value={attendanceInstansiFilter} onValueChange={setAttendanceInstansiFilter}>
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue placeholder="Semua instansi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua instansi</SelectItem>
                    {attendanceInstansiOptions.map((instansi) => (
                      <SelectItem key={instansi} value={instansi}>
                        {instansi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Menampilkan {filteredAttendanceRows.length} dari {attendanceRows.length} anggota hadir
                </div>
              </div>
            ) : null}
            {loadingAttendance ? (
              <div className="text-sm text-slate-500 dark:text-slate-300">Memuat daftar kehadiran...</div>
            ) : filteredAttendanceRows.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-300">Belum ada anggota yang hadir.</div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                {filteredAttendanceRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
                    <div className="font-extrabold text-slate-800 dark:text-white">{row.memberName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{schoolNameOnly(row.memberSchool)}</div>
                    <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">XP +{row.xpAwarded}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openFinishedModal} onOpenChange={setOpenFinishedModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Daftar Kegiatan Selesai</DialogTitle>
            <DialogDescription>Semua agenda yang sudah berlalu.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            {finishedAgendas.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-300">Belum ada kegiatan selesai.</div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {finishedAgendas.map((a) => (
                  <div key={a.id} className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-slate-800 dark:text-white">{a.title}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4" /> {a.date}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-4 w-4" /> {a.time || "-"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" /> {a.location || "-"}
                          </span>
                        </div>
                      </div>
                      <Badge variant="default">Selesai</Badge>
                    </div>
                    {a.description ? <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{a.description}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
