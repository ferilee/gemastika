import { useMemo, useState } from "react";
import { BadgeCheck, Search, Sparkles, UserRound, Users } from "lucide-react";
import { useAppData } from "@/state/AppDataContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Member, MemberRole } from "@/types";
import { formatWA } from "@/lib/mgmp";

function roleLabel(role: MemberRole) {
  if (role === "admin") return "Admin";
  if (role === "pengurus") return "Pengurus";
  return "Anggota";
}

function roleBadgeClass(role: MemberRole) {
  if (role === "admin") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  if (role === "pengurus") return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
}

function schoolNameOnly(school: string) {
  return school.split(" - ")[0]?.trim() || school;
}

export function AnggotaPage() {
  const { members, portfolios, loading } = useAppData();
  const [memberQ, setMemberQ] = useState("");
  const [memberInstansi, setMemberInstansi] = useState("all");
  const [openMember, setOpenMember] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const approvedMembers = useMemo(() => members.filter((m) => (m.membershipStatus || "approved") === "approved"), [members]);
  const availableInstansi = useMemo(
    () => Array.from(new Set(approvedMembers.map((m) => schoolNameOnly(m.school)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [approvedMembers]
  );

  const filteredMembers = useMemo(() => {
    const q = memberQ.trim().toLowerCase();
    return approvedMembers.filter((m) => {
      const okInstansi = memberInstansi === "all" || schoolNameOnly(m.school) === memberInstansi;
      const okQuery = !q || (m.name + " " + m.school + " " + m.role).toLowerCase().includes(q);
      return okInstansi && okQuery;
    });
  }, [approvedMembers, memberInstansi, memberQ]);

  const karyaCountByMember = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of portfolios) {
      const key = `${p.teacherName.trim().toLowerCase()}||${schoolNameOnly(p.school).trim().toLowerCase()}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [portfolios]);

  function openMemberModal(m: Member) {
    setSelectedMember(m);
    setOpenMember(true);
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">Anggota</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cari nama atau sekolah, lalu klik kartu untuk melihat profil.</p>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-72 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={memberQ} onChange={(e) => setMemberQ(e.target.value)} placeholder="Cari anggota..." className="pl-9" />
          </div>
          <Select value={memberInstansi} onValueChange={setMemberInstansi}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Semua instansi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua instansi</SelectItem>
              {availableInstansi.map((instansi) => (
                <SelectItem key={instansi} value={instansi}>
                  {instansi}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        Menampilkan {filteredMembers.length} dari {approvedMembers.length} anggota
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[360px] rounded-[30px] bg-slate-100 dark:bg-slate-800 animate-pulse" />)
        ) : filteredMembers.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-10">Tidak ada anggota ditemukan.</div>
        ) : (
          filteredMembers.map((m) => {
            const wa = formatWA(m.wa);
            const waHref = wa ? `https://wa.me/${wa}` : "";
            const karyaKey = `${m.name.trim().toLowerCase()}||${schoolNameOnly(m.school).trim().toLowerCase()}`;
            const karyaCount = karyaCountByMember.get(karyaKey) || 0;
            return (
              <Card
                key={m.id}
                asChild
                className="group overflow-hidden rounded-[30px] border-slate-300/70 dark:border-white/10 min-h-[360px] p-0"
              >
                <button onClick={() => openMemberModal(m)} className="relative text-left h-full">
                  <div className="absolute inset-0 bg-slate-200 dark:bg-slate-900">
                    {m.photoUrl ? (
                      <img className="h-full w-full object-cover scale-[1.02] group-hover:scale-105 transition duration-700" src={m.photoUrl} alt={m.name} />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <UserRound className="h-16 w-16 opacity-60" />
                      </div>
                    )}
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/40 to-transparent" />

                  <CardContent className="relative h-full p-4 flex flex-col justify-end">
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-extrabold text-white truncate">{m.name}</div>
                      <BadgeCheck className="h-5 w-5 text-white/90 flex-shrink-0" />
                    </div>

                    <div className="mt-1 text-sm text-white/85 line-clamp-2">{schoolNameOnly(m.school)}</div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Badge className={roleBadgeClass(m.role)}>{roleLabel(m.role)}</Badge>
                      <Badge className="bg-white/15 text-white border border-white/20">
                        XP {m.xp ?? 0}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-white/90">
                      <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                        <div className="inline-flex items-center gap-1 text-xs font-bold">
                          <Users className="h-3.5 w-3.5" /> {m.membershipStatus === "approved" ? "Aktif" : "Guest"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                        <div className="inline-flex items-center gap-1 text-xs font-bold">
                          <Sparkles className="h-3.5 w-3.5" /> {karyaCount} Karya
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-10 rounded-full px-5 bg-white text-slate-900 hover:bg-white/90 font-extrabold"
                        onClick={(e) => {
                          e.stopPropagation();
                          openMemberModal(m);
                        }}
                      >
                        Lihat Profil
                      </Button>
                      {waHref ? (
                        <a
                          className="inline-flex h-10 items-center rounded-full border border-white/25 bg-white/10 px-4 text-xs font-extrabold text-white hover:bg-white/20"
                          href={waHref}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Chat
                        </a>
                      ) : null}
                    </div>
                  </CardContent>
                </button>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={openMember} onOpenChange={setOpenMember}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Profil Anggota</DialogTitle>
            <DialogDescription>
              {selectedMember ? `${selectedMember.name} • ${roleLabel(selectedMember.role)} • ${schoolNameOnly(selectedMember.school)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            {selectedMember?.profileUrl ? (
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 h-[70vh] bg-slate-50 dark:bg-slate-900/40">
                <iframe title="Profil" src={selectedMember.profileUrl} className="w-full h-full" />
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-6">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Belum ada URL website profil untuk anggota ini. Anda masih bisa menghubungi via WhatsApp jika tersedia.
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
