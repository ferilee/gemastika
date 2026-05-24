import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Newspaper, UserPlus } from "lucide-react";
import { api } from "@/api/client";
import type { Member, MembershipStatus, News, Portfolio } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/state/AppDataContext";
import { Badge } from "@/components/ui/badge";

export function DashboardPengurusPage() {
  const { agendas, news, members, patchMember, reload } = useAppData();
  const [savingId, setSavingId] = useState<number | null>(null);
  const [pendingNews, setPendingNews] = useState<News[]>([]);
  const [pendingPortfolios, setPendingPortfolios] = useState<Portfolio[]>([]);
  const [savingContentKey, setSavingContentKey] = useState<string>("");
  const upcoming = agendas.find((a) => a.date) || null;
  const pendingMembers = useMemo(() => members.filter((m) => (m.membershipStatus || "approved") === "pending"), [members]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allNews, allPortfolios] = await Promise.all([
          api<News[]>("/api/news?includeAll=1"),
          api<Portfolio[]>("/api/portfolios?includeAll=1&limit=60")
        ]);
        if (cancelled) return;
        setPendingNews(allNews.filter((n) => (n.publishStatus || "approved") === "pending"));
        setPendingPortfolios(allPortfolios.filter((p) => (p.publishStatus || "approved") === "pending"));
      } catch {
        if (!cancelled) {
          setPendingNews([]);
          setPendingPortfolios([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [news.length]);

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

  async function reviewNews(item: News, status: "approved" | "rejected") {
    const key = `news-${item.id}-${status}`;
    setSavingContentKey(key);
    try {
      await api(`/api/admin/news/${item.id}/review`, { method: "POST", body: JSON.stringify({ status }) });
      setPendingNews((prev) => prev.filter((n) => n.id !== item.id));
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal meninjau berita.");
    } finally {
      setSavingContentKey("");
    }
  }

  async function reviewPortfolio(item: Portfolio, status: "approved" | "rejected") {
    const key = `portfolio-${item.id}-${status}`;
    setSavingContentKey(key);
    try {
      await api(`/api/admin/portfolios/${item.id}/review`, { method: "POST", body: JSON.stringify({ status }) });
      setPendingPortfolios((prev) => prev.filter((p) => p.id !== item.id));
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal meninjau portofolio.");
    } finally {
      setSavingContentKey("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">Pengurus</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-mgmp-blue dark:text-white">Agenda</CardTitle>
            <CalendarCheck className="h-5 w-5 text-mgmp-primary" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {upcoming ? `${upcoming.title} • ${upcoming.date}` : "Belum ada agenda"}
            </div>
            <Button asChild className="w-full font-extrabold">
              <Link to="/kegiatan">Buka Kegiatan</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-mgmp-blue dark:text-white">Kehadiran</CardTitle>
            <UserPlus className="h-5 w-5 text-sky-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">Catat kehadiran dan XP dari daftar agenda.</div>
            <Button asChild variant="secondary" className="w-full font-extrabold">
              <Link to="/kegiatan">Catat Hadir</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-mgmp-blue dark:text-white">Berita</CardTitle>
            <Newspaper className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">{news.length ? `${news.length} item` : "Belum ada berita"}</div>
            <Button asChild variant="secondary" className="w-full font-extrabold">
              <Link to="/berita">Kelola Berita</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-mgmp-blue dark:text-white">Persetujuan Anggota Baru</CardTitle>
          <Badge variant="primary">{pendingMembers.length} Pending</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingMembers.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-300">Tidak ada anggota baru yang menunggu persetujuan.</div>
          ) : (
            pendingMembers.map((m) => (
              <div key={m.id} className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
                <div className="font-extrabold text-slate-800 dark:text-white">{m.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{m.school}</div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={savingId === m.id} onClick={() => void setApproval(m, "approved")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" disabled={savingId === m.id} onClick={() => void setApproval(m, "rejected")}>
                    Tolak
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-mgmp-blue dark:text-white">Review Berita</CardTitle>
          <Badge className={pendingNews.length === 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"}>
            {pendingNews.length} Pending
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingNews.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-300">Tidak ada berita yang menunggu review.</div>
          ) : (
            pendingNews.map((n) => (
              <div key={n.id} className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
                <div className="font-extrabold text-slate-800 dark:text-white">{n.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{n.author} • {n.date}</div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{n.content || n.summary}</div>
                {n.documentUrl ? (
                  <a
                    href={n.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-bold text-mgmp-primary hover:underline"
                  >
                    Buka dokumen
                  </a>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                    disabled={savingContentKey === `news-${n.id}-approved`}
                    onClick={() => void reviewNews(n, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    className="bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400"
                    disabled={savingContentKey === `news-${n.id}-rejected`}
                    onClick={() => void reviewNews(n, "rejected")}
                  >
                    Tolak
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-mgmp-blue dark:text-white">Review Portofolio</CardTitle>
          <Badge className={pendingPortfolios.length === 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"}>
            {pendingPortfolios.length} Pending
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingPortfolios.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-300">Tidak ada portofolio yang menunggu review.</div>
          ) : (
            pendingPortfolios.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
                <div className="font-extrabold text-slate-800 dark:text-white">{p.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{p.teacherName}</div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{p.description}</div>
                {p.link ? (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-bold text-mgmp-primary hover:underline"
                  >
                    Buka tautan karya
                  </a>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                    disabled={savingContentKey === `portfolio-${p.id}-approved`}
                    onClick={() => void reviewPortfolio(p, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    className="bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400"
                    disabled={savingContentKey === `portfolio-${p.id}-rejected`}
                    onClick={() => void reviewPortfolio(p, "rejected")}
                  >
                    Tolak
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
