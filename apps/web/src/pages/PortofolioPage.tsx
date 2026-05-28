import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FilePlus2, Search, Star } from "lucide-react";
import { api } from "@/api/client";
import type { CommentItem, Portfolio, ReactionItem } from "@/types";
import { useAppData } from "@/state/AppDataContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/state/AuthContext";

export function PortofolioPage() {
  const { isApprovedMember, user } = useAuth();
  const { portfolios, loading, addPortfolio } = useAppData();
  const [portfolioQ, setPortfolioQ] = useState("");

  const [openPortfolioCreate, setOpenPortfolioCreate] = useState(false);
  const [openPortfolioDetail, setOpenPortfolioDetail] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyInput, setReplyInput] = useState<Record<number, string>>({});
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [submittingReaction, setSubmittingReaction] = useState(false);
  const [ratingInfo, setRatingInfo] = useState<{ average: number; count: number; myRating: number }>({ average: 0, count: 0, myRating: 0 });
  const [submittingRating, setSubmittingRating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const reactionOptions = ["👍", "❤️", "👏"];
  const [portfolioForm, setPortfolioForm] = useState({
    teacherName: "",
    school: "",
    title: "",
    description: "",
    link: "",
    photoUrl: ""
  });
  const [saving, setSaving] = useState(false);

  const filteredPortfolios = useMemo(() => {
    const q = portfolioQ.trim().toLowerCase();
    if (!q) return portfolios;
    return portfolios.filter((p) => (p.title + " " + p.teacherName + " " + p.school).toLowerCase().includes(q));
  }, [portfolioQ, portfolios]);

  async function submitPortfolio() {
    setSaving(true);
    try {
      const created = await api<Portfolio>("/api/portfolios", { method: "POST", body: JSON.stringify(portfolioForm) });
      addPortfolio(created);
      setOpenPortfolioCreate(false);
      setPortfolioForm({ teacherName: "", school: "", title: "", description: "", link: "", photoUrl: "" });
      alert("Portofolio berhasil dikirim dan menunggu review admin/pengurus.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal mengirim portofolio.");
    } finally {
      setSaving(false);
    }
  }

  function openPortfolioModal(p: Portfolio) {
    setSelectedPortfolio(p);
    setOpenPortfolioDetail(true);
  }

  useEffect(() => {
    if (!openPortfolioDetail || !selectedPortfolio) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await api<CommentItem[]>(`/api/comments?targetType=portfolio&targetId=${selectedPortfolio.id}`);
        if (!cancelled) setComments(rows);
      } catch {
        if (!cancelled) setComments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openPortfolioDetail, selectedPortfolio]);

  useEffect(() => {
    if (!selectedPortfolio) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await api<{ average: number; count: number; myRating: number }>(`/api/portfolio-ratings?portfolioId=${selectedPortfolio.id}`);
        if (!cancelled) setRatingInfo(info);
      } catch {
        if (!cancelled) setRatingInfo({ average: 0, count: 0, myRating: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPortfolio]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api<ReactionItem[]>("/api/reactions?targetType=portfolio");
        if (!cancelled) setReactions(rows);
      } catch {
        if (!cancelled) setReactions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolios.length]);

  async function submitComment(parentId?: number) {
    if (!user) {
      alert("Silakan masuk terlebih dahulu.");
      return;
    }
    if (!selectedPortfolio) return;
    const content = (parentId ? replyInput[parentId] : commentInput)?.trim() || "";
    if (content.length < 2) return;
    setSubmittingComment(true);
    try {
      const created = await api<CommentItem>("/api/comments", {
        method: "POST",
        body: JSON.stringify({ targetType: "portfolio", targetId: selectedPortfolio.id, parentId: parentId ?? null, content })
      });
      setComments((prev) => [...prev, created]);
      if (parentId) setReplyInput((prev) => ({ ...prev, [parentId]: "" }));
      else setCommentInput("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal mengirim komentar.");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function toggleReaction(targetId: number, reaction: string) {
    if (!user) {
      alert("Silakan masuk terlebih dahulu.");
      return;
    }
    setSubmittingReaction(true);
    try {
      await api("/api/reactions/toggle", {
        method: "POST",
        body: JSON.stringify({ targetType: "portfolio", targetId, reaction })
      });
      const rows = await api<ReactionItem[]>("/api/reactions?targetType=portfolio");
      setReactions(rows);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal memberi reaksi.");
    } finally {
      setSubmittingReaction(false);
    }
  }

  async function submitRating(rating: number) {
    if (!selectedPortfolio) return;
    if (!user) {
      alert("Silakan masuk terlebih dahulu.");
      return;
    }
    setSubmittingRating(true);
    try {
      const next = await api<{ average: number; count: number; myRating: number }>("/api/portfolio-ratings", {
        method: "POST",
        body: JSON.stringify({ portfolioId: selectedPortfolio.id, rating })
      });
      setRatingInfo(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal memberi rating.");
    } finally {
      setSubmittingRating(false);
    }
  }

  async function uploadPortfolioImage(file: File) {
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append("scope", "portfolio");
      form.append("file", file);
      const res = await fetch("/api/uploads/image", { method: "POST", body: form, credentials: "include" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "Gagal mengunggah gambar.");
      setPortfolioForm((v) => ({ ...v, photoUrl: json.url || "" }));
      alert("Gambar preview berhasil diunggah.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal mengunggah gambar.");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">Portofolio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Galeri karya inovasi guru.</p>
        </div>
        <div className="flex gap-3 flex-wrap w-full md:w-auto">
          <div className="w-full md:w-96 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={portfolioQ}
              onChange={(e) => setPortfolioQ(e.target.value)}
              placeholder="Cari judul karya, guru, atau sekolah..."
              className="pl-9"
            />
          </div>
          {isApprovedMember ? (
            <Button variant="accent" onClick={() => setOpenPortfolioCreate(true)} className="w-full md:w-auto">
              <FilePlus2 className="h-4 w-4" /> Kirim Portofolio
            </Button>
          ) : null}
        </div>
      </div>
      {!isApprovedMember ? (
        <div className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Mode tamu: hanya dapat melihat portofolio. Pengiriman portofolio memerlukan persetujuan admin.
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-80 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)
        ) : filteredPortfolios.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12">Belum ada portofolio ditemukan.</div>
        ) : (
          filteredPortfolios.map((p) => (
            <Card key={p.id} className="group overflow-hidden transition flex flex-col">
              <div className="h-44 bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                {p.photoUrl ? (
                  <img className="h-full w-full object-cover group-hover:scale-105 transition duration-500" src={p.photoUrl} alt={p.title} />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-400">No image</div>
                )}
                {p.link ? (
                  <a
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="rounded-full bg-white px-5 py-2 text-sm font-extrabold text-slate-900 inline-flex items-center gap-2">
                      Kunjungi <ExternalLink className="h-4 w-4" />
                    </span>
                  </a>
                ) : null}
              </div>
              <CardContent className="p-6 flex-1 flex flex-col cursor-pointer" onClick={() => openPortfolioModal(p)}>
                <div className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {p.teacherName} • {p.school}
                </div>
                {(p.publishStatus || "approved") === "pending" ? (
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                      Menunggu persetujuan
                    </span>
                  </div>
                ) : null}
                <div className="mt-2 font-extrabold text-lg text-slate-800 dark:text-white line-clamp-1">{p.title}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-3">{p.description}</div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {reactionOptions.map((r) => {
                    const row = reactions.find((x) => x.targetId === p.id && x.reaction === r);
                    return (
                      <button
                        key={r}
                        type="button"
                        className={[
                          "rounded-full border px-2 py-1 text-xs",
                          row?.reacted
                            ? "border-mgmp-primary bg-mgmp-primary/10 text-mgmp-primary"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        ].join(" ")}
                        disabled={submittingReaction}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleReaction(p.id, r);
                        }}
                      >
                        {r} {row?.count || 0}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={openPortfolioDetail} onOpenChange={setOpenPortfolioDetail}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detail Portofolio</DialogTitle>
            <DialogDescription>
              {selectedPortfolio ? `${selectedPortfolio.teacherName} • ${selectedPortfolio.school}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedPortfolio ? (
            <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <div className="h-56 bg-slate-200 dark:bg-slate-800">
                  {selectedPortfolio.photoUrl ? (
                    <img className="h-full w-full object-cover" src={selectedPortfolio.photoUrl} alt={selectedPortfolio.title} />
                  ) : null}
                </div>
                <div className="p-6">
                  <div className="text-2xl font-extrabold text-slate-800 dark:text-white">{selectedPortfolio.title}</div>
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{selectedPortfolio.description}</div>
                  {selectedPortfolio.link ? (
                    <a
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 px-4 py-2 text-sm font-extrabold text-white"
                      href={selectedPortfolio.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buka Karya <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Rating: {ratingInfo.average.toFixed(2)} / 5 ({ratingInfo.count} penilai)
                    </div>
                    {!user ? <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">Masuk untuk memberi rating.</div> : null}
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={!user || submittingRating}
                          onClick={() => void submitRating(s)}
                          className="p-1"
                          title={`Beri rating ${s}`}
                        >
                          <Star
                            className={["h-5 w-5", s <= (ratingInfo.myRating || 0) ? "text-amber-500 fill-amber-400" : "text-slate-300 dark:text-slate-600"].join(" ")}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                    <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Komentar</div>
                    {!user ? <div className="text-xs text-amber-700 dark:text-amber-300">Silakan masuk untuk menulis komentar.</div> : null}
                    <div className="flex gap-2">
                      <Input
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Tulis komentar..."
                        disabled={submittingComment || !user}
                      />
                      <Button disabled={submittingComment || !user || commentInput.trim().length < 2} onClick={() => void submitComment()}>
                        Kirim
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {comments.filter((c) => !c.parentId).length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">Belum ada komentar.</div>
                      ) : (
                        comments
                          .filter((c) => !c.parentId)
                          .map((c) => (
                            <details key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                              <summary className="cursor-pointer list-none">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{c.authorName}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{new Date(c.createdAt).toLocaleString()}</div>
                                </div>
                                <div className="mt-1 text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{c.content}</div>
                              </summary>
                              <div className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{c.content}</div>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  value={replyInput[c.id] || ""}
                                  onChange={(e) => setReplyInput((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                  placeholder="Balas komentar..."
                                  disabled={submittingComment || !user}
                                />
                                <Button
                                  variant="secondary"
                                  disabled={submittingComment || !user || (replyInput[c.id] || "").trim().length < 2}
                                  onClick={() => void submitComment(c.id)}
                                >
                                  Balas
                                </Button>
                              </div>
                              <div className="mt-3 space-y-2">
                                {comments
                                  .filter((r) => r.parentId === c.id)
                                  .map((r) => (
                                    <div key={r.id} className="ml-4 rounded-lg border border-slate-200/70 dark:border-slate-700/70 p-2">
                                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{r.authorName}</div>
                                      <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{r.content}</div>
                                    </div>
                                  ))}
                              </div>
                            </details>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={openPortfolioCreate && isApprovedMember} onOpenChange={setOpenPortfolioCreate}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Kirim Portofolio</DialogTitle>
            <DialogDescription>Isi data karya, lalu kirim.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Nama guru"
                value={portfolioForm.teacherName}
                onChange={(e) => setPortfolioForm((v) => ({ ...v, teacherName: e.target.value }))}
              />
              <Input
                placeholder="Asal sekolah"
                value={portfolioForm.school}
                onChange={(e) => setPortfolioForm((v) => ({ ...v, school: e.target.value }))}
              />
            </div>
            <Input placeholder="Judul karya" value={portfolioForm.title} onChange={(e) => setPortfolioForm((v) => ({ ...v, title: e.target.value }))} />
            <Textarea
              placeholder="Deskripsi karya"
              value={portfolioForm.description}
              onChange={(e) => setPortfolioForm((v) => ({ ...v, description: e.target.value }))}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Link karya (opsional)"
                value={portfolioForm.link}
                onChange={(e) => setPortfolioForm((v) => ({ ...v, link: e.target.value }))}
              />
              <Input
                placeholder="Link foto preview (opsional)"
                value={portfolioForm.photoUrl}
                onChange={(e) => setPortfolioForm((v) => ({ ...v, photoUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingImage}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadPortfolioImage(f);
                  e.currentTarget.value = "";
                }}
              />
              <div className="text-xs text-slate-500 dark:text-slate-400">{uploadingImage ? "Mengunggah gambar..." : "Pilih file untuk upload preview ke RustFS."}</div>
            </div>
            <Button disabled={saving} onClick={() => void submitPortfolio()} className="w-full">
              {saving ? "Mengirim..." : "Kirim"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
