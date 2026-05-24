import { count } from "drizzle-orm";
import { agendas, members, news, portfolios } from "./schema";
import type { Db } from "./client";

export async function seedIfEmpty(db: Db) {
  const [{ value: membersCount }] = await db.select({ value: count() }).from(members);
  if (membersCount > 0) return;

  await db.insert(members).values([
    {
      name: "Ferilee",
      email: "the.real.ferilee@gmail.com",
      school: "SMK N 1 Lumajang",
      wa: "6281234567890",
      telegram: "",
      photoUrl: "https://freeimghost.com/images/2025/12/31/Ferilee-seragam-khaki.jpg",
      profileUrl: "https://example.com",
      role: "admin"
    },
    {
      name: "Siti Nur",
      email: "",
      school: "SMK N 2 Lumajang",
      wa: "6289876543210",
      telegram: "",
      photoUrl: "",
      profileUrl: "",
      role: "pengurus"
    }
  ]);

  await db.insert(agendas).values([
    {
      title: "Rapat Kerja Awal Tahun",
      date: "2026-04-15",
      time: "08.00 WIB",
      location: "SMK N 1 Lumajang",
      description: "Koordinasi program MGMP dan pembagian tugas."
    },
    {
      title: "Workshop Penyusunan Modul Ajar",
      date: "2026-05-03",
      time: "09.00 WIB",
      location: "Aula Dinas Pendidikan",
      description: "Penyelarasan modul ajar dan perangkat asesmen."
    }
  ]);

  await db.insert(news).values([
    {
      title: "Peluncuran Website Resmi MGMP Matematika",
      category: "Pengumuman",
      author: "Admin",
      date: "2026-04-08",
      imageUrl:
        "https://images.unsplash.com/photo-1524178232363-1fb2b075b955?auto=format&fit=crop&w=1400&q=80",
      summary: "Website resmi MGMP Matematika SMK Kab. Lumajang mulai aktif untuk kolaborasi dan informasi kegiatan.",
      content:
        "Assalamualaikum. Website ini menjadi wadah kolaborasi, berbagi perangkat ajar, dan informasi kegiatan MGMP.\n\nSilakan pantau agenda, berita, dan portofolio karya guru.",
      documentUrl: ""
    }
  ]);

  await db.insert(portfolios).values([
    {
      teacherName: "Ferilee",
      school: "SMK N 1 Lumajang",
      title: "Modul Logaritma Interaktif",
      description: "Modul ajar logaritma berbasis proyek untuk kelas X vokasi.",
      link: "https://example.com",
      photoUrl:
        "https://images.unsplash.com/photo-1517142089942-ba376ce32a0b?auto=format&fit=crop&w=1400&q=80"
    }
  ]);
}
