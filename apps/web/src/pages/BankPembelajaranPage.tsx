import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, ExternalLink, FilePlus2, FileText, Heart, Pencil, Search, Star, Trash2, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import type { CommentItem, LearningResource, LearningResourceCategory, LearningResourceVersion } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { hasRole, useAuth } from "@/state/AuthContext";

const CATEGORIES: LearningResourceCategory[] = ["RPP / Modul Ajar", "Materi Pembelajaran", "Asesmen Interaktif", "LKPD Interaktif", "Bank Soal", "Media Pembelajaran", "Praktik Baik", "Perangkat Administrasi"];
const PHASES = ["Fase E", "Fase F", "Lintas Fase"];
const initialForm = {
  title: "",
  category: "RPP / Modul Ajar" as LearningResourceCategory,
  description: "",
  phase: "Fase E",
  grade: "Kelas X",
  topic: "",
  semester: "Ganjil",
  curriculum: "Kurikulum Merdeka",
  sourceType: "file" as "file" | "link",
  resourceUrl: "",
  fileName: "",
  thumbnailUrl: "",
  tags: "",
  storageKey: "",
  thumbnailStorageKey: "",
  changeNote: ""
};

function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }
function permalink(item: LearningResource) { return `/bank-pembelajaran/${item.id}-${slugify(item.title) || "materi"}`; }
function permalinkId(value?: string) { return Number((value || "").match(/^(\d+)/)?.[1] || 0); }

function parseUploadError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    return parsed.error || fallback;
  } catch {
    return error.message || fallback;
  }
}

function resourceStatus(status?: string) {
  if (status === "pending") return "Menunggu persetujuan";
  if (status === "rejected") return "Ditolak";
  return "Dipublikasikan";
}

export function BankPembelajaranPage() {
  const navigate = useNavigate();
  const { permalink: resourcePermalink } = useParams();
  const { isApprovedMember, user } = useAuth();
  const canManage = hasRole(user, "admin");
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [phase, setPhase] = useState("All");
  const [semester, setSemester] = useState("All");
  const [curriculum, setCurriculum] = useState("All");
  const [selected, setSelected] = useState<LearningResource | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LearningResource | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [rating, setRating] = useState({ average: 0, count: 0, myRating: 0 });
  const [versions, setVersions] = useState<LearningResourceVersion[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState("");

  async function loadResources() {
    setLoading(true);
    try {
      setResources(await api<LearningResource[]>("/api/learning-resources"));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal memuat Bank Pembelajaran.");
      setResources([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadResources();
    // Data visibility changes after authentication, so refresh for each account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  useEffect(() => { if (!user) { setFavorites([]); return; } void api<number[]>("/api/learning-resource-favorites").then(setFavorites).catch(() => setFavorites([])); }, [user]);

  useEffect(() => {
    const id = permalinkId(resourcePermalink);
    if (!resourcePermalink) return;
    const row = resources.find((item) => item.id === id);
    if (row) { setSelected(row); void api(`/api/learning-resources/${id}/access`, { method: "POST", body: JSON.stringify({ type: "view" }) }); }
    else if (!loading && id) void api<LearningResource>(`/api/learning-resources/${id}`).then((item) => setSelected(item)).catch(() => navigate("/bank-pembelajaran", { replace: true }));
  }, [loading, navigate, resourcePermalink, resources]);

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((item) => {
      const matchesQuery = !q || [item.title, item.topic, item.description, item.grade, item.curriculum].join(" ").toLowerCase().includes(q);
      const matchesTags = !q || item.tags.toLowerCase().includes(q) || matchesQuery;
      return matchesTags && (category === "All" || item.category === category) && (phase === "All" || item.phase === phase) && (semester === "All" || item.semester === semester) && (curriculum === "All" || item.curriculum === curriculum);
    });
  }, [category, curriculum, phase, query, resources, semester]);

  const canEditSelected = Boolean(selected?.createdByEmail && user?.email && selected.createdByEmail.toLowerCase() === user.email.toLowerCase());

  function openCreate() {
    setForm(initialForm);
    setCreateOpen(true);
  }

  function openEdit(item: LearningResource) {
    setForm({
      title: item.title,
      category: item.category,
      description: item.description,
      phase: item.phase,
      grade: item.grade,
      topic: item.topic,
      semester: item.semester,
      curriculum: item.curriculum,
      sourceType: item.sourceType,
      resourceUrl: item.resourceUrl,
      fileName: item.fileName,
      thumbnailUrl: item.thumbnailUrl
      ,tags: item.tags || "", storageKey: item.storageKey || "", thumbnailStorageKey: item.thumbnailStorageKey || "", changeNote: ""
    });
    setEditOpen(true);
  }

  async function uploadResource(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const raw = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads/resource");
        xhr.withCredentials = true;
        xhr.timeout = 90000;
        xhr.upload.onprogress = () => {};
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText || "") : reject(new Error(xhr.responseText || `Upload gagal (${xhr.status}).`)));
        xhr.onerror = () => reject(new Error("Koneksi upload gagal."));
        xhr.ontimeout = () => reject(new Error("Upload dokumen timeout. Cek koneksi RustFS/server atau coba file lebih kecil."));
        xhr.send(body);
      });
      const result = JSON.parse(raw) as { url?: string; fileName?: string; key?: string };
      if (!result.url) throw new Error("URL dokumen tidak diterima dari server.");
      setForm((current) => ({ ...current, sourceType: "file", resourceUrl: result.url || "", fileName: result.fileName || file.name, storageKey: result.key || "" }));
    } catch (error) {
      alert(parseUploadError(error, "Gagal mengunggah dokumen."));
    } finally {
      setUploading(false);
    }
  }

  async function uploadThumbnail(file: File) {
    const body = new FormData(); body.append("scope", "learning-resource"); body.append("file", file);
    try {
      const response = await fetch("/api/uploads/image", { method: "POST", body, credentials: "include" });
      const raw = await response.text();
      if (!response.ok) throw new Error(raw || "Gagal mengunggah thumbnail.");
      const result = JSON.parse(raw) as { url: string; key: string };
      setForm((current) => ({ ...current, thumbnailUrl: result.url, thumbnailStorageKey: result.key }));
    } catch (error) { alert(parseUploadError(error, "Gagal mengunggah thumbnail.")); }
  }

  async function saveResource(editing: boolean) {
    if (!form.resourceUrl) {
      alert(form.sourceType === "file" ? "Unggah dokumen terlebih dahulu." : "Masukkan tautan materi.");
      return;
    }
    setSaving(true);
    try {
      const endpoint = editing && selected ? `/api/learning-resources/${selected.id}` : "/api/learning-resources";
      const item = await api<LearningResource>(endpoint, { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      setResources((current) => {
        const exists = current.some((row) => row.id === item.id);
        return exists ? current.map((row) => (row.id === item.id ? item : row)) : [item, ...current];
      });
      setSelected(item);
      setCreateOpen(false);
      setEditOpen(false);
      alert(editing ? "Materi diperbarui dan menunggu review ulang." : "Materi berhasil dikirim dan menunggu review admin/pengurus.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal menyimpan materi.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteResource(item: LearningResource) {
    setDeleting(item.id);
    try {
      await api(`/api/admin/learning-resources/${item.id}`, { method: "DELETE" });
      setResources((current) => current.filter((row) => row.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
      setDeleteTarget(null);
      alert("Materi berhasil dihapus.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal menghapus materi.");
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    if (!selected) return;
    void Promise.all([
      api<{ average: number; count: number; myRating: number }>(`/api/learning-resource-ratings?resourceId=${selected.id}`),
      api<LearningResourceVersion[]>(`/api/learning-resources/${selected.id}/versions`),
      api<CommentItem[]>(`/api/comments?targetType=learning_resource&targetId=${selected.id}`)
    ]).then(([ratingInfo, versionRows, commentRows]) => { setRating(ratingInfo); setVersions(versionRows); setComments(commentRows); }).catch(() => { setVersions([]); setComments([]); });
  }, [selected?.id]);

  async function toggleFavorite() { if (!selected) return; if (!user) { alert("Silakan masuk terlebih dahulu."); return; } const result = await api<{ active: boolean }>(`/api/learning-resource-favorites/${selected.id}/toggle`, { method: "POST" }); setFavorites((items) => result.active ? [...items, selected.id] : items.filter((id) => id !== selected.id)); }
  async function setResourceRating(value: number) { if (!selected) return; if (!user) { alert("Silakan masuk terlebih dahulu."); return; } setRating(await api("/api/learning-resource-ratings", { method: "POST", body: JSON.stringify({ resourceId: selected.id, rating: value }) })); }
  async function submitComment() { if (!selected || !commentInput.trim()) return; if (!user) { alert("Silakan masuk terlebih dahulu."); return; } const created = await api<CommentItem>("/api/comments", { method: "POST", body: JSON.stringify({ targetType: "learning_resource", targetId: selected.id, content: commentInput.trim() }) }); setComments((items) => [...items, created]); setCommentInput(""); }
  async function registerDownload() { if (!selected) return; const updated = await api<LearningResource>(`/api/learning-resources/${selected.id}/access`, { method: "POST", body: JSON.stringify({ type: "download" }) }); setSelected(updated); setResources((items) => items.map((item) => item.id === updated.id ? updated : item)); }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-mgmp-blue dark:text-white">Bank Pembelajaran</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ruang berbagi perangkat dan sumber belajar Matematika SMK.</p>
        </div>
        {isApprovedMember ? (
          <Button variant="accent" onClick={openCreate} className="w-full md:w-auto">
            <FilePlus2 className="h-4 w-4" /> Tambah Materi
          </Button>
        ) : null}
      </div>
      {!isApprovedMember ? <div className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Masuk sebagai anggota aktif untuk membagikan materi.</div> : null}

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul, topik, kelas, atau kurikulum..." /></div>
        <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger><SelectContent><SelectItem value="All">Semua kategori</SelectItem>{CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Select value={phase} onValueChange={setPhase}><SelectTrigger><SelectValue placeholder="Fase" /></SelectTrigger><SelectContent><SelectItem value="All">Semua fase</SelectItem>{PHASES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"><Select value={semester} onValueChange={setSemester}><SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger><SelectContent><SelectItem value="All">Semua semester</SelectItem><SelectItem value="Ganjil">Ganjil</SelectItem><SelectItem value="Genap">Genap</SelectItem></SelectContent></Select><Select value={curriculum} onValueChange={setCurriculum}><SelectTrigger><SelectValue placeholder="Kurikulum" /></SelectTrigger><SelectContent><SelectItem value="All">Semua kurikulum</SelectItem><SelectItem value="Kurikulum Merdeka">Kurikulum Merdeka</SelectItem><SelectItem value="Kurikulum 2013">Kurikulum 2013</SelectItem></SelectContent></Select></div>
      <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Menampilkan {filteredResources.length} materi.</div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {loading ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />) : null}
        {!loading && filteredResources.length === 0 ? <div className="col-span-full py-12 text-center text-slate-500">Belum ada materi yang sesuai.</div> : null}
        {filteredResources.map((item) => (
          <Card key={item.id} className="flex flex-col overflow-hidden transition hover:border-mgmp-primary/40">
            <button type="button" className="flex flex-1 flex-col text-left" onClick={() => navigate(permalink(item))}>
              <div className="flex h-28 items-center justify-center bg-mgmp-blue/10 dark:bg-white/5">
                {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover" /> : <BookOpen className="h-10 w-10 text-mgmp-primary" />}
              </div>
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-mgmp-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-mgmp-primary">{item.category}</span>{item.publishStatus !== "approved" ? <span className={item.publishStatus === "pending" ? "text-[11px] font-bold text-amber-700 dark:text-amber-300" : "text-[11px] font-bold text-rose-700 dark:text-rose-300"}>{resourceStatus(item.publishStatus)}</span> : null}</div>
                <div className="mt-3 line-clamp-2 text-lg font-extrabold text-slate-800 dark:text-white">{item.title}</div>
                <div className="mt-2 line-clamp-3 text-sm text-slate-500 dark:text-slate-400">{item.description}</div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300"><span>{item.phase}</span><span>•</span><span>{item.grade}</span><span>•</span><span>{item.topic}</span></div>{item.tags ? <div className="mt-2 line-clamp-1 text-xs text-mgmp-primary">#{item.tags.split(",").join(" #")}</div> : null}
              </CardContent>
            </button>
            {canManage ? <div className="px-5 pb-5 text-right"><Button size="sm" className="bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400" disabled={deleting === item.id} onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">Hapus</span></Button></div> : null}
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); if (resourcePermalink) navigate("/bank-pembelajaran"); } }}>
        <DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Detail Materi</DialogTitle><DialogDescription>{selected ? `${selected.category} • ${selected.phase} • ${selected.grade}` : ""}</DialogDescription></DialogHeader>{selected ? <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-6"><div className="text-2xl font-extrabold text-slate-800 dark:text-white">{selected.title}</div><div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2"><div><b>Topik:</b> {selected.topic}</div><div><b>Semester:</b> {selected.semester}</div><div><b>Kurikulum:</b> {selected.curriculum}</div><div><b>Akses:</b> {selected.viewCount || 0} dilihat • {selected.downloadCount || 0} dibuka</div></div>{selected.tags ? <div className="text-xs font-bold text-mgmp-primary">#{selected.tags.split(",").join(" #")}</div> : null}<div className="whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{selected.description}</div><a onClick={() => void registerDownload()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-extrabold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400" href={selected.resourceUrl} target="_blank" rel="noreferrer">{selected.sourceType === "file" ? <FileText className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}{selected.sourceType === "file" ? "Buka / Unduh Materi" : "Buka Materi Interaktif"}</a><div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs font-semibold">Rating {rating.average.toFixed(1)} / 5 ({rating.count})</div><div className="flex">{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => void setResourceRating(value)} disabled={!user}><Star className={["h-5 w-5", value <= rating.myRating ? "fill-amber-400 text-amber-500" : "text-slate-300 dark:text-slate-600"].join(" ")} /></button>)}</div><button type="button" onClick={() => void toggleFavorite()} disabled={!user} className="p-1"><Heart className={["h-5 w-5", favorites.includes(selected.id) ? "fill-rose-500 text-rose-500" : "text-slate-400"].join(" ")} /></button></div><details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer text-sm font-extrabold">Riwayat Versi ({versions.length})</summary><div className="mt-2 space-y-2 text-xs">{versions.map((version) => <div key={version.id}>v{version.version} • {version.changeNote || "Pembaruan"}</div>)}</div></details><div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700"><div className="text-sm font-extrabold">Komentar</div>{comments.map((comment) => <div key={comment.id} className="rounded-lg bg-slate-100 p-2 text-sm dark:bg-white/5"><b>{comment.authorName}</b><div>{comment.content}</div></div>)}<div className="flex gap-2"><Input value={commentInput} onChange={(event) => setCommentInput(event.target.value)} placeholder="Tulis komentar..." disabled={!user} /><Button onClick={() => void submitComment()} disabled={!user || !commentInput.trim()}>Kirim</Button></div></div>{canEditSelected ? <Button variant="secondary" className="w-full" onClick={() => openEdit(selected)}><Pencil className="h-4 w-4" /> Edit Materi</Button> : null}{canManage ? <Button className="w-full bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400" onClick={() => setDeleteTarget(selected)}><Trash2 className="h-4 w-4" /> Hapus Materi</Button> : null}</div> : null}</DialogContent>
      </Dialog>

      <ResourceFormDialog open={createOpen} onOpenChange={setCreateOpen} title="Tambah Materi" form={form} setForm={setForm} uploading={uploading} onUpload={uploadResource} onUploadThumbnail={uploadThumbnail} saving={saving} onSave={() => void saveResource(false)} />
      <ResourceFormDialog open={editOpen} onOpenChange={setEditOpen} title="Edit Materi" form={form} setForm={setForm} uploading={uploading} onUpload={uploadResource} onUploadThumbnail={uploadThumbnail} saving={saving} onSave={() => void saveResource(true)} />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle className="inline-flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-500" /> Hapus Materi</DialogTitle><DialogDescription>Materi “{deleteTarget?.title}” akan dihapus dari Bank Pembelajaran. File di RustFS tidak dihapus otomatis.</DialogDescription></DialogHeader><div className="flex justify-end gap-2 px-6 pb-6"><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Batal</Button><Button className="bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400" disabled={!deleteTarget || deleting === deleteTarget.id} onClick={() => deleteTarget && void deleteResource(deleteTarget)}><Trash2 className="h-4 w-4" /> Hapus</Button></div></DialogContent></Dialog>
    </>
  );
}

function ResourceFormDialog({ open, onOpenChange, title, form, setForm, uploading, onUpload, onUploadThumbnail, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; form: typeof initialForm; setForm: React.Dispatch<React.SetStateAction<typeof initialForm>>; uploading: boolean; onUpload: (file: File) => void; onUploadThumbnail: (file: File) => void; saving: boolean; onSave: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Materi baru dan perubahan materi akan ditinjau admin/pengurus sebelum dipublikasikan.</DialogDescription></DialogHeader><div className="max-h-[70vh] space-y-3 overflow-y-auto px-6 pb-6"><Input placeholder="Judul materi" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /><div className="grid gap-3 md:grid-cols-2"><Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as LearningResourceCategory }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={form.phase} onValueChange={(value) => setForm((current) => ({ ...current, phase: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PHASES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 md:grid-cols-2"><Input placeholder="Kelas, contoh: Kelas X" value={form.grade} onChange={(event) => setForm((current) => ({ ...current, grade: event.target.value }))} /><Input placeholder="Topik, contoh: Persamaan Kuadrat" value={form.topic} onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))} /></div><div className="grid gap-3 md:grid-cols-2"><Select value={form.semester} onValueChange={(value) => setForm((current) => ({ ...current, semester: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ganjil">Ganjil</SelectItem><SelectItem value="Genap">Genap</SelectItem></SelectContent></Select><Input placeholder="Kurikulum" value={form.curriculum} onChange={(event) => setForm((current) => ({ ...current, curriculum: event.target.value }))} /></div><Input placeholder="Tag dipisah koma, contoh: aljabar, kelas-x" value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} /><Input placeholder="Catatan perubahan versi (opsional)" value={form.changeNote} onChange={(event) => setForm((current) => ({ ...current, changeNote: event.target.value }))} /><Textarea className="min-h-32" placeholder="Deskripsi materi, tujuan, atau petunjuk penggunaan" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /><Select value={form.sourceType} onValueChange={(value) => setForm((current) => ({ ...current, sourceType: value as "file" | "link", resourceUrl: "", fileName: "", storageKey: "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="file">Unggah dokumen</SelectItem><SelectItem value="link">Tautan materi interaktif</SelectItem></SelectContent></Select>{form.sourceType === "file" ? <Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} /> : <Input placeholder="https://contoh.com/materi-interaktif" value={form.resourceUrl} onChange={(event) => setForm((current) => ({ ...current, resourceUrl: event.target.value }))} />}<div className="space-y-1"><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadThumbnail(file); event.currentTarget.value = ""; }} />{form.thumbnailUrl ? <div className="text-xs text-emerald-700 dark:text-emerald-300">Thumbnail siap diunggah.</div> : <Input placeholder="Atau URL thumbnail (opsional)" value={form.thumbnailUrl} onChange={(event) => setForm((current) => ({ ...current, thumbnailUrl: event.target.value }))} />}</div><div className="flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>Batal</Button><Button disabled={saving || uploading} onClick={onSave}><Upload className="h-4 w-4" /> {saving ? "Menyimpan..." : "Kirim untuk Review"}</Button></div></div></DialogContent></Dialog>;
}
