import { useEffect, useState } from "react";
import { Globe, Lightbulb, ListChecks, MessageCircle, Send, Target, Users } from "lucide-react";
import { api } from "@/api/client";
import type { BoardMember } from "@/types";
import { formatWA } from "@/lib/mgmp";

function contactLinks(contact: string) {
  const raw = (contact || "").trim();
  const wa = formatWA(raw);
  const tgMatch = raw.match(/@([a-zA-Z0-9_]{5,32})/);
  const tgUser = tgMatch ? tgMatch[1] : "";
  return {
    waHref: wa ? `https://wa.me/${wa}` : "",
    tgHref: tgUser ? `https://t.me/${tgUser}` : ""
  };
}

export function ProfilPage() {
  const [board, setBoard] = useState<BoardMember[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api<BoardMember[]>("/api/board");
        if (!cancelled) setBoard(rows);
      } catch {
        if (!cancelled) setBoard([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="py-6 space-y-5">
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#07112a]/55 min-h-[520px]">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_24%,rgba(148,163,184,0.24),transparent_55%),radial-gradient(circle_at_86%_14%,rgba(30,64,175,0.28),transparent_58%)] dark:bg-[radial-gradient(circle_at_12%_24%,rgba(148,163,184,0.18),transparent_55%),radial-gradient(circle_at_86%_14%,rgba(30,64,175,0.34),transparent_58%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-100/20 via-transparent to-slate-200/30 dark:from-white/5 dark:to-black/30" />
        </div>

        <div className="relative h-full px-7 py-10 md:px-10 md:py-12">
          <div className="hidden lg:grid lg:grid-cols-[340px_1fr] lg:items-center lg:gap-8">
            <div className="relative w-[340px]">
              <div className="absolute inset-0 -z-10 translate-y-8 rounded-[32px] bg-black/20 blur-2xl dark:bg-black/45" />
              <img
                className="relative w-full h-auto object-contain drop-shadow-[0_26px_45px_rgba(2,6,23,0.45)]"
                src="/ketuamgmp.png?v=20260525"
                alt="Ketua MGMP"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "https://freeimghost.com/images/2025/12/31/Ferilee-seragam-khaki.jpg";
                }}
              />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-white/75 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-700 shadow-sm backdrop-blur-sm dark:bg-white/10 dark:text-white/80">
                Ketua MGMP
              </div>
            </div>

            <div className="relative w-full overflow-hidden rounded-[34px] border border-white/20 bg-[#1e324a]/85 text-white shadow-[0_26px_90px_-44px_rgba(2,6,23,0.85)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(148,163,184,0.18),transparent_50%),radial-gradient(circle_at_10%_90%,rgba(30,64,175,0.18),transparent_50%)]" />
              <div className="relative p-7 md:p-9">
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white/90">
                  Quote
                </div>
                <div className="mt-4 flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl border border-white/15 bg-white/10 flex items-center justify-center text-white/90 flex-shrink-0">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-3xl md:text-5xl font-[900] tracking-tight leading-[1.05]">Quote Ketua MGMP</h1>
                    <p className="mt-4 text-sm md:text-base text-white/85 leading-relaxed">
                      “Dari forum MGMP, inovasi kecil di kelas bisa menjadi perubahan besar di sekolah.”
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 flex-wrap">
                      <p className="text-xs md:text-sm font-bold uppercase tracking-wider text-white/80">Feri Dwi Hermawan</p>
                      <a
                        href="https://ferilee.gurumuda.eu.org/"
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-1.5 rounded-full border border-cyan-300/50 bg-cyan-300/15 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_18px_rgba(34,211,238,0.22)] hover:bg-cyan-300/25 transition"
                        aria-label="Website Feri Dwi Hermawan"
                        title="Buka Website Ketua"
                      >
                        <Globe className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                        <span>Website Ketua</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-16 bg-[linear-gradient(135deg,rgba(15,23,42,0.75)_25%,rgba(30,58,138,0.45)_25%,rgba(30,58,138,0.45)_50%,rgba(15,23,42,0.75)_50%,rgba(15,23,42,0.75)_75%,rgba(30,58,138,0.45)_75%)] bg-[length:20px_20px] opacity-40" />
            </div>
          </div>

          <div className="lg:hidden">
            <div className="relative w-full overflow-hidden rounded-[34px] border border-white/20 bg-[#1e324a]/85 text-white shadow-[0_26px_90px_-44px_rgba(2,6,23,0.85)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(148,163,184,0.18),transparent_50%),radial-gradient(circle_at_10%_90%,rgba(30,64,175,0.18),transparent_50%)]" />
              <div className="relative p-7 md:p-9">
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white/90">
                  Quote
                </div>
                <div className="mt-4 flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl border border-white/15 bg-white/10 flex items-center justify-center text-white/90 flex-shrink-0">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-3xl md:text-5xl font-[900] tracking-tight leading-[1.05]">Quote Ketua MGMP</h1>
                    <p className="mt-4 text-sm md:text-base text-white/85 leading-relaxed">
                      “Dari forum MGMP, inovasi kecil di kelas bisa menjadi perubahan besar di sekolah.”
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 flex-wrap">
                      <p className="text-xs md:text-sm font-bold uppercase tracking-wider text-white/80">Feri Dwi Hermawan</p>
                      <a
                        href="https://ferilee.gurumuda.eu.org/"
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-1.5 rounded-full border border-cyan-300/50 bg-cyan-300/15 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_18px_rgba(34,211,238,0.22)] hover:bg-cyan-300/25 transition"
                        aria-label="Website Feri Dwi Hermawan"
                        title="Buka Website Ketua"
                      >
                        <Globe className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                        <span>Website Ketua</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-16 bg-[linear-gradient(135deg,rgba(15,23,42,0.75)_25%,rgba(30,58,138,0.45)_25%,rgba(30,58,138,0.45)_50%,rgba(15,23,42,0.75)_50%,rgba(15,23,42,0.75)_75%,rgba(30,58,138,0.45)_75%)] bg-[length:20px_20px] opacity-40" />
            </div>

            <div className="mt-5 flex justify-center">
              <div className="relative w-[250px] sm:w-[290px]">
                <div className="absolute inset-0 -z-10 translate-y-8 rounded-[32px] bg-black/20 blur-2xl dark:bg-black/45" />
                <img
                  className="relative w-full h-auto object-contain drop-shadow-[0_22px_40px_rgba(2,6,23,0.42)]"
                  src="/ketuamgmp.png?v=20260525"
                  alt="Ketua MGMP"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "https://freeimghost.com/images/2025/12/31/Ferilee-seragam-khaki.jpg";
                  }}
                />
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-white/75 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-700 shadow-sm backdrop-blur-sm dark:bg-white/10 dark:text-white/80">
                  Ketua MGMP
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#07112a]/55">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl border border-slate-200/70 bg-white/80 flex items-center justify-center dark:border-white/10 dark:bg-white/10">
                <Target className="h-4 w-4 text-mgmp-primary" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Visi MGMP</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              Menjadi komunitas guru Matematika SMK Kabupaten Lumajang yang profesional, kolaboratif, inovatif, dan adaptif terhadap
              perkembangan teknologi pembelajaran.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl border border-slate-200/70 bg-white/80 flex items-center justify-center dark:border-white/10 dark:bg-white/10">
                <ListChecks className="h-4 w-4 text-mgmp-primary" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Misi MGMP</h2>
            </div>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200 list-decimal pl-5">
              <li>Meningkatkan kompetensi pedagogik dan profesional guru Matematika SMK secara berkelanjutan.</li>
              <li>Membangun budaya berbagi praktik baik, perangkat ajar, dan inovasi pembelajaran antar anggota.</li>
              <li>Menguatkan pemanfaatan teknologi dan data dalam perencanaan, pelaksanaan, serta evaluasi pembelajaran.</li>
              <li>Menyelenggarakan kegiatan MGMP yang terstruktur, relevan, dan berdampak langsung pada kualitas belajar peserta didik.</li>
              <li>Mendorong kolaborasi dengan sekolah, dunia industri, dan pemangku kepentingan pendidikan.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#07112a]/55">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl border border-slate-200/70 bg-white/70 flex items-center justify-center dark:border-white/10 dark:bg-white/5">
            <Users className="h-5 w-5 text-mgmp-primary" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Susunan Pengurus</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Periode Kepengurusan Tahun 2025 - 2029</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {board.length > 0 ? (
            board.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                {(() => {
                  const links = contactLinks(item.contact);
                  return (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">{item.title}</div>
                        </div>
                        {item.contact ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300">Hubungi</span>
                            {links.waHref ? (
                              <a
                                href={links.waHref}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                title="Chat WhatsApp"
                                aria-label="Chat WhatsApp"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            ) : null}
                            {links.tgHref ? (
                              <a
                                href={links.tgHref}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
                                title="Chat Telegram"
                                aria-label="Chat Telegram"
                              >
                                <Send className="h-4 w-4" />
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </>
                  );
                })()}
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-300">Belum ada data susunan pengurus.</div>
          )}
        </div>
      </div>
    </section>
  );
}
