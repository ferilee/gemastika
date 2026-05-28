import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, FilePlus2, Search, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import type { CommentItem, News, ReactionItem } from "@/types";
import { useAppData } from "@/state/AppDataContext";
import { CATEGORIES } from "@/lib/mgmp";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { hasRole, useAuth } from "@/state/AuthContext";

export function BeritaPage() {
  const { isApprovedMember, user } = useAuth();
  const { news, loading, addNews, removeNews } = useAppData();
  const canManageNews = hasRole(user, "admin") || hasRole(user, "pengurus");

  const [newsQ, setNewsQ] = useState("");
  const [newsCategory, setNewsCategory] = useState("All");

  const [openNewsCreate, setOpenNewsCreate] = useState(false);
  const [openNewsDetail, setOpenNewsDetail] = useState(false);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyInput, setReplyInput] = useState<Record<number, string>>({});
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [submittingReaction, setSubmittingReaction] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<News | null>(null);
  const [deletingNewsId, setDeletingNewsId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const reactionOptions = ["👍", "❤️", "👏"];

  const [newsForm, setNewsForm] = useState({
    title: "",
    category: "Pengumuman",
    author: "",
    date: new Date().toISOString().slice(0, 10),
    imageUrl: "",
    summary: "",
    content: "",
    documentUrl: ""
  });
  const [saving, setSaving] = useState(false);

  const filteredNews = useMemo(() => {
    const q = newsQ.trim().toLowerCase();
    const cat = newsCategory.toLowerCase();
    return news.filter((n) => {
      const okQ = !q || n.title.toLowerCase().includes(q);
      const okC = cat === "all" || n.category.toLowerCase().includes(cat);
      return okQ && okC;
    });
  }, [news, newsCategory, newsQ]);

  function openNewsModal(n: News) {
    setSelectedNews(n);
    setOpenNewsDetail(true);
  }

  useEffect(() => {
    if (!openNewsDetail || !selectedNews) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await api<CommentItem[]>(`/api/comments?targetType=news&targetId=${selectedNews.id}`);
        if (!cancelled) setComments(rows);
      } catch {
        if (!cancelled) setComments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openNewsDetail, selectedNews]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api<ReactionItem[]>("/api/reactions?targetType=news");
        if (!cancelled) setReactions(rows);
      } catch {
        if (!cancelled) setReactions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [news.length]);

  async function submitNews() {
    setSaving(true);
    try {
      const created = await api<News>("/api/news", { method: "POST", body: JSON.stringify(newsForm) });
      addNews(created);
      setOpenNewsCreate(false);
      setNewsForm((v) => ({ ...v, title: "", summary: "", content: "", imageUrl: "", documentUrl: "" }));
      alert("Berita berhasil dikirim dan menunggu review admin/pengurus.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal mengirim berita.");
    } finally {
      setSaving(false);
    }
  }

  async function submitComment(parentId?: number) {
    if (!user) {
      alert("Silakan masuk terlebih dahulu.");
      return;
    }
    if (!selectedNews) return;
    const content = (parentId ? replyInput[parentId] : commentInput)?.trim() || "";
    if (content.length < 2) return;
    setSubmittingComment(true);
    try {
      const created = await api<CommentItem>("/api/comments", {
        method: "POST",
        body: JSON.stringify({ targetType: "news", targetId: selectedNews.id, parentId: parentId ?? null, content })
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
        body: JSON.stringify({ targetType: "news", targetId, reaction })
      });
      const rows = await api<ReactionItem[]>("/api/reactions?targetType=news");
      setReactions(rows);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal memberi reaksi.");
    } finally {
      setSubmittingReaction(false);
    }
  }

  async function deleteNewsItem(item: News) {
    setDeletingNewsId(item.id);
    try {
      await api(`/api/admin/news/${item.id}`, { method: "DELETE" });
      removeNews(item.id);
      setReactions((prev) => prev.filter((row) => row.targetId !== item.id));
      if (selectedNews?.id === item.id) {
        setSelectedNews(null);
        setOpenNewsDetail(false);
      }
      setDeleteTarget(null);
      alert("Berita berhasil dihapus.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menghapus berita.");
    } finally {
      setDeletingNewsId(null);
    }
  }

  async function uploadNewsImage(file: File) {
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append("scope", "news");
      form.append("file", file);
      const res = await fetch("/api/uploads/image", { method: "POST", body: form, credentials: "include" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "Gagal mengunggah gambar.");
      setNewsForm((v) => ({ ...v, imageUrl: json.url || "" }));
      alert("Gambar berhasil diunggah.");
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
          <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">Berita</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Kumpulan pengumuman dan informasi MGMP.</p>
        </div>
        <div className="flex gap-3 flex-wrap w-full md:w-auto">
          <div className="w-full md:w-72 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={newsQ} onChange={(e) => setNewsQ(e.target.value)} placeholder="Cari berita..." className="pl-9" />
          </div>
          <Select value={newsCategory} onValueChange={setNewsCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isApprovedMember ? (
            <Button variant="accent" onClick={() => setOpenNewsCreate(true)} className="w-full md:w-auto">
              <FilePlus2 className="h-4 w-4" /> Tambah Berita
            </Button>
          ) : null}
        </div>
      </div>
      {!isApprovedMember ? (
        <div className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Mode tamu: hanya dapat melihat berita. Penambahan berita memerlukan persetujuan admin.
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)
        ) : filteredNews.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12">Belum ada berita.</div>
        ) : (
          filteredNews.map((n) => (
            <Card key={n.id} className="group text-left overflow-hidden transition flex flex-col">
              <div
                role="button"
                tabIndex={0}
                onClick={() => openNewsModal(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openNewsModal(n);
                  }
                }}
                className="cursor-pointer text-left flex-1"
              >
                <div className="h-40 bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  {n.imageUrl ? (
                    <img className="h-full w-full object-cover group-hover:scale-105 transition duration-500" src={n.imageUrl} alt={n.title} />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400">No image</div>
                  )}
                </div>
                <CardContent className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="primary">{n.category}</Badge>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{n.date}</div>
                  </div>
                  {(n.publishStatus || "approved") === "pending" ? (
                    <div className="mt-2">
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">Menunggu persetujuan</Badge>
                    </div>
                  ) : null}
                  <div className="mt-3 font-extrabold text-lg text-slate-800 dark:text-white line-clamp-2 group-hover:text-mgmp-primary transition">
                    {n.title}
                  </div>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-3 flex-1">{n.summary}</div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {reactionOptions.map((r) => {
                      const row = reactions.find((x) => x.targetId === n.id && x.reaction === r);
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
                            void toggleReaction(n.id, r);
                          }}
                        >
                          {r} {row?.count || 0}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 px-5 pb-5">
                <button type="button" className="text-sm font-extrabold text-mgmp-primary" onClick={() => openNewsModal(n)}>
                  Baca Selengkapnya
                </button>
                {canManageNews ? (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400"
                    disabled={deletingNewsId === n.id}
                    onClick={() => setDeleteTarget(n)}
                    title="Hapus berita"
                    aria-label="Hapus berita"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Hapus</span>
                  </Button>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={openNewsDetail} onOpenChange={setOpenNewsDetail}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detail Berita</DialogTitle>
            <DialogDescription>{selectedNews ? `${selectedNews.date} • ${selectedNews.author}` : ""}</DialogDescription>
          </DialogHeader>
          {selectedNews ? (
            <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <div className="h-48 bg-slate-200 dark:bg-slate-800">
                  {selectedNews.imageUrl ? <img className="h-full w-full object-cover" src={selectedNews.imageUrl} alt={selectedNews.title} /> : null}
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <Badge variant="primary">{selectedNews.category}</Badge>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{selectedNews.date}</div>
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-white">{selectedNews.title}</div>
                  <MarkdownContent value={selectedNews.content || selectedNews.summary} className="mt-4" />
                  {canManageNews ? (
                    <Button
                      type="button"
                      className="mt-6 w-full bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400"
                      disabled={deletingNewsId === selectedNews.id}
                      onClick={() => setDeleteTarget(selectedNews)}
                    >
                      <Trash2 className="h-4 w-4" /> Hapus Berita
                    </Button>
                  ) : null}
                  {selectedNews.documentUrl ? (
                    <a
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 font-extrabold text-slate-800 dark:text-slate-100 hover:bg-mgmp-primary hover:text-white transition"
                      href={selectedNews.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buka Dokumen Terkait <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
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

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> Hapus Berita
            </DialogTitle>
            <DialogDescription>
              Berita "{deleteTarget?.title}" akan dihapus permanen beserta komentar dan reaksinya.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 flex gap-2 justify-end">
            <Button variant="secondary" disabled={Boolean(deletingNewsId)} onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button
              className="bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400"
              disabled={!deleteTarget || deletingNewsId === deleteTarget.id}
              onClick={() => deleteTarget && void deleteNewsItem(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openNewsCreate && isApprovedMember} onOpenChange={setOpenNewsCreate}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Kirim Berita</DialogTitle>
            <DialogDescription>Data akan tersimpan ke database (SQLite) lewat API internal.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-3 max-h-[70vh] overflow-y-auto">
            <Input placeholder="Judul" value={newsForm.title} onChange={(e) => setNewsForm((v) => ({ ...v, title: e.target.value }))} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select value={newsForm.category} onValueChange={(v) => setNewsForm((s) => ({ ...s, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c !== "All").map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Penulis" value={newsForm.author} onChange={(e) => setNewsForm((v) => ({ ...v, author: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input type="date" value={newsForm.date} onChange={(e) => setNewsForm((v) => ({ ...v, date: e.target.value }))} />
              <Input
                placeholder="Link gambar (opsional)"
                value={newsForm.imageUrl}
                onChange={(e) => setNewsForm((v) => ({ ...v, imageUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingImage}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadNewsImage(f);
                  e.currentTarget.value = "";
                }}
              />
              <div className="text-xs text-slate-500 dark:text-slate-400">{uploadingImage ? "Mengunggah gambar..." : "Pilih file untuk upload ke RustFS."}</div>
            </div>
            <Textarea placeholder="Ringkasan" value={newsForm.summary} onChange={(e) => setNewsForm((v) => ({ ...v, summary: e.target.value }))} />
            <Textarea
              placeholder="Isi berita"
              value={newsForm.content}
              onChange={(e) => setNewsForm((v) => ({ ...v, content: e.target.value }))}
              className="min-h-[160px]"
            />
            <Input
              placeholder="Link dokumen (opsional)"
              value={newsForm.documentUrl}
              onChange={(e) => setNewsForm((v) => ({ ...v, documentUrl: e.target.value }))}
            />
            <Button disabled={saving} onClick={() => void submitNews()} className="w-full">
              {saving ? "Mengirim..." : "Kirim"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
