export const CATEGORIES = ["All", "Pengumuman", "Kegiatan", "Pelatihan", "Prestasi", "Lomba", "Informasi"] as const;

export function formatWA(raw: string) {
  const clean = raw.replace(/[^\d]/g, "");
  if (!clean) return "";
  return clean.startsWith("62") ? clean : `62${clean.replace(/^0+/, "")}`;
}

export function isPast(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() < today.getTime();
}

function upperFirst(s: string) {
  if (!s) return s;
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

export function agendaBlock(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  const month = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(d).toUpperCase();
  const year = new Intl.DateTimeFormat("id-ID", { year: "numeric" }).format(d);
  const weekday = upperFirst(new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(d));
  return { monthYear: `${month} ${year}`, day: String(d.getDate()), weekday };
}

