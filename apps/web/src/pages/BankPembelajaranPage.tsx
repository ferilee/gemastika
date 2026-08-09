import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, ExternalLink, FilePlus2, FileText, Link as LinkIcon, Pencil, Search, Trash2, Upload } from "lucide-react";
import { api } from "@/api/client";
import type { LearningResource, LearningResourceCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { hasRole, useAuth } from "@/state/AuthContext";

const CATEGORIES: LearningResourceCategory[] = ["RPP / Modul Ajar", "Materi Pembelajaran", "Asesmen Interaktif", "LKPD Interaktif"];
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
  thumbnailUrl: ""
};

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
  const { isApprovedMember, user } = useAuth();
  const canManage = hasRole(user, "admin");
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [phase, setPhase] = useState("All");
  const [selected, setSelected] = useState<LearningResource | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LearningResource | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);

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

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((item) => {
      const matchesQuery = !q || [item.title, item.topic, item.description, item.grade, item.curriculum].join(" ").toLowerCase().includes(q);
      return matchesQuery && (category === "All" || item.category === category) && (phase === "All" || item.phase === phase);
    });
  }, [category, phase, query, resources]);

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
    });
    setEditOpen(true);
  }

  async function uploadResource(file: File) {
    setUploading(true);
    setUploadProgress(0);
    try {
      const body = new FormData();
      body.append("file", file);
      const raw = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads/resource");
        xhr.withCredentials = true;
        xhr.timeout = 90000;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setUploadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText || "") : reject(new Error(xhr.responseText || `Upload gagal (${xhr.status}).`)));
        xhr.onerror = () => reject(new Error("Koneksi upload gagal."));
        xhr.ontimeout = () => reject(new Error("Upload dokumen timeout. Cek koneksi RustFS/server atau coba file lebih kecil."));
        xhr.send(body);
      });
      const result = JSON.parse(raw) as { url?: string; fileName?: string };
      if (!result.url) throw new Error("URL dokumen tidak diterima dari server.");
      setForm((current) => ({ ...current, sourceType: "file", resourceUrl: result.url || "", fileName: result.fileName || file.name }));
      setUploadProgress(100);
    } catch (error) {
      alert(parseUploadError(error, "Gagal mengunggah dokumen."));
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
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
      <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Menampilkan {filteredResources.length} materi.</div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {loading ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />) : null}
        {!loading && filteredResources.length === 0 ? <div className="col-span-full py-12 text-center text-slate-500">Belum ada materi yang sesuai.</div> : null}
        {filteredResources.map((item) => (
          <Card key={item.id} className="flex flex-col overflow-hidden transition hover:border-mgmp-primary/40">
            <button type="button" className="flex flex-1 flex-col text-left" onClick={() => setSelected(item)}>
              <div className="flex h-28 items-center justify-center bg-mgmp-blue/10 dark:bg-white/5">
                {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover" /> : <BookOpen className="h-10 w-10 text-mgmp-primary" />}
              </div>
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-mgmp-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-mgmp-primary">{item.category}</span>{item.publishStatus !== "approved" ? <span className={item.publishStatus === "pending" ? "text-[11px] font-bold text-amber-700 dark:text-amber-300" : "text-[11px] font-bold text-rose-700 dark:text-rose-300"}>{resourceStatus(item.publishStatus)}</span> : null}</div>
                <div className="mt-3 line-clamp-2 text-lg font-extrabold text-slate-800 dark:text-white">{item.title}</div>
                <div className="mt-2 line-clamp-3 text-sm text-slate-500 dark:text-slate-400">{item.description}</div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300"><span>{item.phase}</span><span>•</span><span>{item.grade}</span><span>•</span><span>{item.topic}</span></div>
              </CardContent>
            </button>
            {canManage ? <div className="px-5 pb-5 text-right"><Button size="sm" className="bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400" disabled={deleting === item.id} onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">Hapus</span></Button></div> : null}
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Detail Materi</DialogTitle><DialogDescription>{selected ? `${selected.category} • ${selected.phase} • ${selected.grade}` : ""}</DialogDescription></DialogHeader>{selected ? <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-6"><div className="text-2xl font-extrabold text-slate-800 dark:text-white">{selected.title}</div><div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2"><div><b>Topik:</b> {selected.topic}</div><div><b>Semester:</b> {selected.semester}</div><div><b>Kurikulum:</b> {selected.curriculum}</div><div><b>Sumber:</b> {selected.sourceType === "file" ? selected.fileName || "Dokumen" : "Tautan interaktif"}</div></div><div className="whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{selected.description}</div><a className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-extrabold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400" href={selected.resourceUrl} target="_blank" rel="noreferrer">{selected.sourceType === "file" ? <FileText className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}{selected.sourceType === "file" ? "Buka / Unduh Materi" : "Buka Materi Interaktif"}</a>{canEditSelected ? <Button variant="secondary" className="w-full" onClick={() => openEdit(selected)}><Pencil className="h-4 w-4" /> Edit Materi</Button> : null}{canManage ? <Button className="w-full bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400" onClick={() => setDeleteTarget(selected)}><Trash2 className="h-4 w-4" /> Hapus Materi</Button> : null}</div> : null}</DialogContent>
      </Dialog>

      <ResourceFormDialog open={createOpen} onOpenChange={setCreateOpen} title="Tambah Materi" form={form} setForm={setForm} uploading={uploading} progress={uploadProgress} onUpload={uploadResource} saving={saving} onSave={() => void saveResource(false)} />
      <ResourceFormDialog open={editOpen} onOpenChange={setEditOpen} title="Edit Materi" form={form} setForm={setForm} uploading={uploading} progress={uploadProgress} onUpload={uploadResource} saving={saving} onSave={() => void saveResource(true)} />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle className="inline-flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-500" /> Hapus Materi</DialogTitle><DialogDescription>Materi “{deleteTarget?.title}” akan dihapus dari Bank Pembelajaran. File di RustFS tidak dihapus otomatis.</DialogDescription></DialogHeader><div className="flex justify-end gap-2 px-6 pb-6"><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Batal</Button><Button className="bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400" disabled={!deleteTarget || deleting === deleteTarget.id} onClick={() => deleteTarget && void deleteResource(deleteTarget)}><Trash2 className="h-4 w-4" /> Hapus</Button></div></DialogContent></Dialog>
    </>
  );
}

function ResourceFormDialog({ open, onOpenChange, title, form, setForm, uploading, progress, onUpload, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; form: typeof initialForm; setForm: React.Dispatch<React.SetStateAction<typeof initialForm>>; uploading: boolean; progress: number; onUpload: (file: File) => void; saving: boolean; onSave: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Materi baru dan perubahan materi akan ditinjau admin/pengurus sebelum dipublikasikan.</DialogDescription></DialogHeader><div className="max-h-[70vh] space-y-3 overflow-y-auto px-6 pb-6"><Input placeholder="Judul materi" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /><div className="grid gap-3 md:grid-cols-2"><Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as LearningResourceCategory }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={form.phase} onValueChange={(value) => setForm((current) => ({ ...current, phase: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PHASES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 md:grid-cols-2"><Input placeholder="Kelas, contoh: Kelas X" value={form.grade} onChange={(event) => setForm((current) => ({ ...current, grade: event.target.value }))} /><Input placeholder="Topik, contoh: Persamaan Kuadrat" value={form.topic} onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))} /></div><div className="grid gap-3 md:grid-cols-2"><Select value={form.semester} onValueChange={(value) => setForm((current) => ({ ...current, semester: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ganjil">Ganjil</SelectItem><SelectItem value="Genap">Genap</SelectItem></SelectContent></Select><Input placeholder="Kurikulum" value={form.curriculum} onChange={(event) => setForm((current) => ({ ...current, curriculum: event.target.value }))} /></div><Textarea className="min-h-32" placeholder="Deskripsi materi, tujuan, atau petunjuk penggunaan" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /><Select value={form.sourceType} onValueChange={(value) => setForm((current) => ({ ...current, sourceType: value as "file" | "link", resourceUrl: "", fileName: "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="file">Unggah dokumen</SelectItem><SelectItem value="link">Tautan materi interaktif</SelectItem></SelectContent></Select>{form.sourceType === "file" ? <div className="space-y-2"><Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} />{form.fileName ? <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Dokumen siap: {form.fileName}</div> : <div className="text-xs text-slate-500 dark:text-slate-400">PDF, DOCX, PPTX, XLSX, DOC, PPT, atau XLS. Maksimum 20MB.</div>}{uploading ? <div className="space-y-1"><div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mengunggah dokumen: {progress}%</div><div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full bg-mgmp-primary transition-all" style={{ width: `${progress}%` }} /></div></div> : null}</div> : <div className="relative"><LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="https://contoh.com/materi-interaktif" value={form.resourceUrl} onChange={(event) => setForm((current) => ({ ...current, resourceUrl: event.target.value }))} /></div>}<Input placeholder="URL thumbnail (opsional)" value={form.thumbnailUrl} onChange={(event) => setForm((current) => ({ ...current, thumbnailUrl: event.target.value }))} /><div className="flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>Batal</Button><Button disabled={saving || uploading} onClick={onSave}><Upload className="h-4 w-4" /> {saving ? "Menyimpan..." : "Kirim untuk Review"}</Button></div></div></DialogContent></Dialog>;
}
