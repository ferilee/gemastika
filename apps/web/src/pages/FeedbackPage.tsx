import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, MessageSquare, Quote, Send } from "lucide-react";
import { api } from "@/api/client";
import type { Testimonial } from "@/types";
import { Button } from "@/components/ui/button";

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-mgmp-primary dark:border-white/10 dark:bg-white/5 dark:text-white";

export function FeedbackPage() {
  const [kind, setKind] = useState<"kritik" | "saran" | "masukan">("saran");
  const [feedback, setFeedback] = useState({ name: "", email: "", message: "", website: "" });
  const [testimonial, setTestimonial] = useState({ name: "", role: "", institution: "", content: "", photoUrl: "", consent: false, website: "" });
  const [items, setItems] = useState<Testimonial[]>([]);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [testimonialSent, setTestimonialSent] = useState(false);
  const [saving, setSaving] = useState<"feedback" | "testimonial" | null>(null);

  useEffect(() => {
    void api<Testimonial[]>("/api/testimonials").then(setItems).catch(() => setItems([]));
  }, []);

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("feedback");
    setFeedbackSent(false);
    try {
      await api("/api/feedback", { method: "POST", body: JSON.stringify({ ...feedback, kind }) });
      setFeedback({ name: "", email: "", message: "", website: "" });
      setFeedbackSent(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Masukan belum dapat dikirim.");
    } finally {
      setSaving(null);
    }
  }

  async function submitTestimonial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("testimonial");
    setTestimonialSent(false);
    try {
      await api("/api/testimonials", { method: "POST", body: JSON.stringify(testimonial) });
      setTestimonial({ name: "", role: "", institution: "", content: "", photoUrl: "", consent: false, website: "" });
      setTestimonialSent(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Testimoni belum dapat dikirim.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
        <div className="relative max-w-2xl">
          <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-blue-200">Ruang suara anggota</div>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Kritik, saran, dan testimoni untuk MGMP</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100">Bantu kami memperbaiki layanan, kegiatan, dan ruang berbagi MGMP Matematika SMK Kabupaten Lumajang.</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={(event) => void submitFeedback(event)} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0b1220]/80 sm:p-8">
          <div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-mgmp-primary dark:bg-blue-500/10 dark:text-blue-300"><MessageSquare className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Kritik dan saran</h2><p className="text-sm text-slate-500 dark:text-slate-400">Bisa dikirim tanpa login.</p></div></div>
          <div className="mt-6 space-y-4">
            <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className={fieldClass}><option value="kritik">Kritik</option><option value="saran">Saran</option><option value="masukan">Masukan umum</option></select>
            <input value={feedback.name} onChange={(event) => setFeedback((form) => ({ ...form, name: event.target.value }))} placeholder="Nama (opsional)" className={fieldClass} />
            <input type="email" value={feedback.email} onChange={(event) => setFeedback((form) => ({ ...form, email: event.target.value }))} placeholder="Email (opsional)" className={fieldClass} />
            <textarea required minLength={10} value={feedback.message} onChange={(event) => setFeedback((form) => ({ ...form, message: event.target.value }))} placeholder="Tuliskan kritik, saran, atau masukan Anda" rows={6} className={fieldClass} />
            <input aria-hidden tabIndex={-1} value={feedback.website} onChange={(event) => setFeedback((form) => ({ ...form, website: event.target.value }))} className="hidden" autoComplete="off" />
            <Button type="submit" className="w-full font-extrabold" disabled={saving === "feedback"}><Send className="h-4 w-4" />{saving === "feedback" ? "Mengirim..." : "Kirim masukan"}</Button>
            {feedbackSent ? <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Terima kasih. Masukan Anda sudah diterima dan akan ditinjau oleh pengurus.</div> : null}
          </div>
        </form>

        <form onSubmit={(event) => void submitTestimonial(event)} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0b1220]/80 sm:p-8">
          <div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"><Quote className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Bagikan testimoni</h2><p className="text-sm text-slate-500 dark:text-slate-400">Anggota dan publik dapat mengisi.</p></div></div>
          <div className="mt-6 space-y-4">
            <input required minLength={2} value={testimonial.name} onChange={(event) => setTestimonial((form) => ({ ...form, name: event.target.value }))} placeholder="Nama" className={fieldClass} />
            <div className="grid gap-4 sm:grid-cols-2"><input value={testimonial.role} onChange={(event) => setTestimonial((form) => ({ ...form, role: event.target.value }))} placeholder="Peran, mis. Guru" className={fieldClass} /><input value={testimonial.institution} onChange={(event) => setTestimonial((form) => ({ ...form, institution: event.target.value }))} placeholder="Sekolah/lembaga" className={fieldClass} /></div>
            <input type="url" value={testimonial.photoUrl} onChange={(event) => setTestimonial((form) => ({ ...form, photoUrl: event.target.value }))} placeholder="Tautan foto (opsional)" className={fieldClass} />
            <textarea required minLength={10} value={testimonial.content} onChange={(event) => setTestimonial((form) => ({ ...form, content: event.target.value }))} placeholder="Ceritakan pengalaman Anda bersama MGMP" rows={5} className={fieldClass} />
            <label className="flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400"><input type="checkbox" required checked={testimonial.consent} onChange={(event) => setTestimonial((form) => ({ ...form, consent: event.target.checked }))} className="mt-1" />Saya menyetujui testimoni ini ditampilkan di website setelah diperiksa pengurus.</label>
            <input aria-hidden tabIndex={-1} value={testimonial.website} onChange={(event) => setTestimonial((form) => ({ ...form, website: event.target.value }))} className="hidden" autoComplete="off" />
            <Button type="submit" variant="accent" className="w-full font-extrabold" disabled={saving === "testimonial"}><Send className="h-4 w-4" />{saving === "testimonial" ? "Mengirim..." : "Kirim testimoni"}</Button>
            {testimonialSent ? <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Terima kasih. Testimoni akan tampil setelah disetujui pengurus.</div> : null}
          </div>
        </form>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0b1220]/80 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-extrabold uppercase tracking-[0.2em] text-mgmp-primary">Cerita komunitas</div><h2 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">Testimoni anggota dan publik</h2></div><Link to="/" className="inline-flex items-center gap-1 text-sm font-extrabold text-mgmp-primary hover:underline">Kembali ke beranda <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.length ? items.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-5 dark:border-white/10"><Quote className="h-5 w-5 text-amber-500" /><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">“{item.content}”</p><div className="mt-5 text-sm font-extrabold text-slate-900 dark:text-white">{item.name}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{[item.role, item.institution].filter(Boolean).join(" · ") || "Komunitas MGMP"}</div></article>) : <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 md:col-span-2 xl:col-span-3">Belum ada testimoni yang dipublikasikan.</div>}</div>
      </section>
    </div>
  );
}
