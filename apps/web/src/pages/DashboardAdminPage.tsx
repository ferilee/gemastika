import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Check, LayoutGrid, Quote, Search, Shield, Trash2, User, Users, X } from "lucide-react";
import { api } from "@/api/client";
import type { BoardMember, HomeContent, Member, MemberRole, MembershipStatus } from "@/types";
import { useAppData } from "@/state/AppDataContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLE_ORDER: MemberRole[] = ["admin", "pengurus", "anggota"];

function nextRoles(current: MemberRole[], role: MemberRole) {
  const set = new Set(current.length ? current : ["anggota"]);
  if (set.has(role)) set.delete(role);
  else set.add(role);
  if (set.size === 0) set.add("anggota");
  return ROLE_ORDER.filter((r) => set.has(r));
}

function badgeVariant(role: MemberRole) {
  if (role === "admin") return "accent";
  if (role === "pengurus") return "primary";
  return "success";
}

function statusVariant(status: MembershipStatus) {
  if (status === "approved") return "success";
  if (status === "pending") return "primary";
  return "accent";
}

type AdminSection = "home" | "role-manager" | "susunan-pengurus" | "konten-beranda";

function detectSection(pathname: string): AdminSection {
  if (pathname.endsWith("/role-manager")) return "role-manager";
  if (pathname.endsWith("/susunan-pengurus")) return "susunan-pengurus";
  if (pathname.endsWith("/konten-beranda")) return "konten-beranda";
  return "home";
}

export function DashboardAdminPage() {
  const location = useLocation();
  const section = detectSection(location.pathname);

  const { members, homeContent, patchMember, reload, setHomeContent } = useAppData();
  const [q, setQ] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "pengurus" | "anggota" | "guest">("all");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [board, setBoard] = useState<Array<{ memberId: number; title: string; contact: string }>>([{ memberId: 0, title: "", contact: "" }]);
  const [savingBoard, setSavingBoard] = useState(false);
  const [quickLinks, setQuickLinks] = useState<Array<{ title: string; subtitle: string; href: string }>>([{ title: "", subtitle: "", href: "/" }]);
  const [quoteText, setQuoteText] = useState("");
  const [quoteAuthor, setQuoteAuthor] = useState("");
  const [savingHomeContent, setSavingHomeContent] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members.filter((m) => {
      const roles = m.roles?.length ? m.roles : [m.role];
      const status = m.membershipStatus || "approved";
      const okSearch = !s || (m.name + " " + m.email + " " + m.school).toLowerCase().includes(s);
      const okFilter =
        memberFilter === "all" ||
        (memberFilter === "pengurus" && roles.includes("pengurus")) ||
        (memberFilter === "anggota" && roles.includes("anggota")) ||
        (memberFilter === "guest" && status !== "approved");
      return okSearch && okFilter;
    });
  }, [memberFilter, members, q]);

  async function toggleRole(member: Member, role: MemberRole) {
    const roles = nextRoles(member.roles || [], role);
    setSavingId(member.id);
    try {
      const updated = await api<Member>(`/api/admin/members/${member.id}/roles`, {
        method: "POST",
        body: JSON.stringify({ roles })
      });
      patchMember(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan role.");
    } finally {
      setSavingId(null);
    }
  }

  async function setApproval(member: Member, status: MembershipStatus) {
    setSavingId(member.id);
    try {
      const updated = await api<Member>(`/api/admin/members/${member.id}/approval`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      patchMember(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal memperbarui status anggota.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteMember(member: Member) {
    const ok = window.confirm(`Hapus anggota ${member.name}?`);
    if (!ok) return;
    setSavingId(member.id);
    try {
      await api(`/api/admin/members/${member.id}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menghapus anggota.");
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api<BoardMember[]>("/api/board");
        if (!cancelled) setBoard(rows.length ? rows.map((r) => ({ memberId: r.memberId || 0, title: r.title, contact: r.contact || "" })) : [{ memberId: 0, title: "", contact: "" }]);
      } catch {
        if (!cancelled) setBoard([{ memberId: 0, title: "", contact: "" }]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setQuickLinks(
      homeContent.quickLinks.length
        ? homeContent.quickLinks.map((item) => ({ title: item.title, subtitle: item.subtitle, href: item.href }))
        : [{ title: "", subtitle: "", href: "/" }]
    );
    setQuoteText(homeContent.quote.text || "");
    setQuoteAuthor(homeContent.quote.author || "");
  }, [homeContent]);

  function updateBoardRow(index: number, key: "memberId" | "title" | "contact", value: string | number) {
    setBoard((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function addBoardRow() {
    setBoard((prev) => [...prev, { memberId: 0, title: "", contact: "" }]);
  }

  function removeBoardRow(index: number) {
    setBoard((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ memberId: 0, title: "", contact: "" }];
    });
  }

  async function saveBoard() {
    const items = board
      .map((b) => ({ memberId: Number(b.memberId || 0), title: b.title.trim(), contact: b.contact.trim() }))
      .filter((b) => b.memberId > 0 && b.title.length >= 3 && b.contact.length >= 3);
    setSavingBoard(true);
    try {
      const rows = await api<BoardMember[]>("/api/admin/board", {
        method: "POST",
        body: JSON.stringify({ items })
      });
      setBoard(rows.length ? rows.map((r) => ({ memberId: r.memberId || 0, title: r.title, contact: r.contact || "" })) : [{ memberId: 0, title: "", contact: "" }]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan susunan pengurus.");
    } finally {
      setSavingBoard(false);
    }
  }

  function updateQuickLink(index: number, key: "title" | "subtitle" | "href", value: string) {
    setQuickLinks((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function addQuickLink() {
    setQuickLinks((prev) => [...prev, { title: "", subtitle: "", href: "/" }]);
  }

  function removeQuickLink(index: number) {
    setQuickLinks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ title: "", subtitle: "", href: "/" }];
    });
  }

  async function saveHomeContent() {
    const payload: HomeContent = {
      quickLinks: quickLinks
        .map((item, index) => ({
          id: index + 1,
          title: item.title.trim(),
          subtitle: item.subtitle.trim(),
          href: item.href.trim() || "/",
          sortOrder: index + 1
        }))
        .filter((item) => item.title.length >= 3 && item.subtitle.length >= 2),
      quote: {
        text: quoteText.trim(),
        author: quoteAuthor.trim()
      }
    };

    if (payload.quote.text.length < 8 || payload.quote.author.length < 3) {
      alert("Quote minimal 8 karakter dan penulis minimal 3 karakter.");
      return;
    }

    setSavingHomeContent(true);
    try {
      const saved = await api<HomeContent>("/api/admin/home-content", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setHomeContent(saved);
      alert("Konten beranda berhasil disimpan.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan konten beranda.");
    } finally {
      setSavingHomeContent(false);
    }
  }

  const roleIcon = (role: MemberRole) => {
    if (role === "admin") return <Shield className="h-4 w-4" />;
    if (role === "pengurus") return <Users className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  if (section === "home") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">Admin</h1>
          <div className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Shield className="h-4 w-4 text-rose-500" /> Panel Cepat Admin
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/dashboard/pengurus">Buka Dashboard Pengurus</Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card asChild className="rounded-2xl">
            <Link to="/dashboard/admin/role-manager">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-mgmp-blue dark:text-white">Role Manager</CardTitle>
                <Users className="h-5 w-5 text-rose-500" />
              </CardHeader>
              <CardContent className="text-sm text-slate-500 dark:text-slate-400">Kelola role, status, dan akun anggota.</CardContent>
            </Link>
          </Card>
          <Card asChild className="rounded-2xl">
            <Link to="/dashboard/admin/susunan-pengurus">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-mgmp-blue dark:text-white">Susunan Pengurus</CardTitle>
                <LayoutGrid className="h-5 w-5 text-sky-500" />
              </CardHeader>
              <CardContent className="text-sm text-slate-500 dark:text-slate-400">Tambah/ubah struktur pengurus MGMP.</CardContent>
            </Link>
          </Card>
          <Card asChild className="rounded-2xl">
            <Link to="/dashboard/admin/konten-beranda">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-mgmp-blue dark:text-white">Konten Beranda</CardTitle>
                <Quote className="h-5 w-5 text-indigo-500" />
              </CardHeader>
              <CardContent className="text-sm text-slate-500 dark:text-slate-400">Kelola Akses Cepat dan quote beranda.</CardContent>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link to="/dashboard/admin">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
        </Button>
        <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">
          {section === "role-manager" ? "Role Manager" : section === "susunan-pengurus" ? "Susunan Pengurus" : "Konten Beranda"}
        </h1>
      </div>

      {section === "role-manager" ? (
        <>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:w-96 relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama/email/sekolah..." className="pl-9" />
              </div>
              <Select value={memberFilter} onValueChange={(v) => setMemberFilter(v as "all" | "pengurus" | "anggota" | "guest")}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="pengurus">Pengurus</SelectItem>
                  <SelectItem value="anggota">Anggota</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Menampilkan {filtered.length} dari {members.length} anggota</div>

          <div className="grid grid-cols-1 gap-4">
            {filtered.map((m) => (
              <Card key={m.id} className="rounded-2xl">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-mgmp-blue dark:text-white">{m.name}</CardTitle>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">{m.email || "-"}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.school}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {ROLE_ORDER.map((r) => {
                      const active = (m.roles?.length ? m.roles : [m.role]).includes(r);
                      return (
                        <Button
                          key={r}
                          size="sm"
                          variant={active ? "accent" : "secondary"}
                          disabled={savingId === m.id}
                          onClick={() => void toggleRole(m, r)}
                          className="min-w-[40px] sm:min-w-[92px]"
                          title={r}
                        >
                          {roleIcon(r)}
                          <span className="hidden sm:inline">{r}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(m.roles?.length ? m.roles : [m.role]).map((r) => (
                      <Badge key={r} variant={badgeVariant(r)}>
                        {r}
                      </Badge>
                    ))}
                    <Badge variant={statusVariant(m.membershipStatus || "approved")}>{m.membershipStatus || "approved"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">XP: {m.xp ?? 0}</div>
                    <Button size="sm" variant="secondary" disabled={savingId === m.id} onClick={() => void setApproval(m, "approved")} title="Approve">
                      <Check className="h-4 w-4" />
                      <span className="hidden sm:inline">Approve</span>
                    </Button>
                    <Button size="sm" variant="secondary" disabled={savingId === m.id} onClick={() => void setApproval(m, "rejected")} title="Tolak">
                      <X className="h-4 w-4" />
                      <span className="hidden sm:inline">Tolak</span>
                    </Button>
                    <Button size="sm" variant="secondary" disabled={savingId === m.id} onClick={() => void deleteMember(m)} title="Hapus">
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Hapus</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {section === "susunan-pengurus" ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-mgmp-blue dark:text-white">Susunan Pengurus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {board.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <Select
                  value={item.memberId ? String(item.memberId) : "0"}
                  onValueChange={(v) => {
                    const id = Number(v);
                    const m = members.find((mm) => mm.id === id);
                    const contact = m ? (m.wa ? `WA: ${m.wa}` : m.telegram ? `Telegram: ${m.telegram}` : "") : "";
                    updateBoardRow(index, "memberId", id);
                    if (!item.contact && contact) updateBoardRow(index, "contact", contact);
                  }}
                >
                  <SelectTrigger disabled={savingBoard}>
                    <SelectValue placeholder="Pilih anggota" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Pilih anggota</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={item.title}
                  onChange={(e) => updateBoardRow(index, "title", e.target.value)}
                  placeholder="Jabatan"
                  disabled={savingBoard}
                />
                <Input
                  value={item.contact}
                  onChange={(e) => updateBoardRow(index, "contact", e.target.value)}
                  placeholder="WA: 08... atau Telegram: @..."
                  disabled={savingBoard}
                />
                <Button type="button" variant="secondary" onClick={() => removeBoardRow(index)} disabled={savingBoard}>
                  Hapus
                </Button>
              </div>
            ))}
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="secondary" onClick={addBoardRow} disabled={savingBoard}>
                Tambah Baris
              </Button>
              <Button type="button" onClick={() => void saveBoard()} disabled={savingBoard}>
                Simpan Susunan Pengurus
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "konten-beranda" ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-mgmp-blue dark:text-white">Konten Beranda: Akses Cepat & Quote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quickLinks.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <Input
                  value={item.title}
                  onChange={(e) => updateQuickLink(index, "title", e.target.value)}
                  placeholder="Judul akses cepat"
                  disabled={savingHomeContent}
                />
                <Input
                  value={item.subtitle}
                  onChange={(e) => updateQuickLink(index, "subtitle", e.target.value)}
                  placeholder="Subjudul"
                  disabled={savingHomeContent}
                />
                <Input
                  value={item.href}
                  onChange={(e) => updateQuickLink(index, "href", e.target.value)}
                  placeholder="Link (/portofolio atau https://...)"
                  disabled={savingHomeContent}
                />
                <Button type="button" variant="secondary" onClick={() => removeQuickLink(index)} disabled={savingHomeContent}>
                  Hapus
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addQuickLink} disabled={savingHomeContent}>
              Tambah Akses Cepat
            </Button>

            <div className="grid grid-cols-1 gap-2 pt-2">
              <Input value={quoteText} onChange={(e) => setQuoteText(e.target.value)} placeholder="Isi quote" disabled={savingHomeContent} />
              <Input value={quoteAuthor} onChange={(e) => setQuoteAuthor(e.target.value)} placeholder="Penulis quote" disabled={savingHomeContent} />
            </div>

            <Button type="button" onClick={() => void saveHomeContent()} disabled={savingHomeContent}>
              {savingHomeContent ? "Menyimpan..." : "Simpan Konten Beranda"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
