export type SchoolItem = {
  name: string;
  city: string;
  province: string;
  status: "Negeri" | "Swasta";
};

const city = "Kab. Lumajang";
const province = "Jawa Timur";

/**
 * Directory of vocational schools in Kabupaten Lumajang.
 *
 * The directory is kept local so profile registration stays limited to the
 * requested regency even when a remote school-search service returns broad
 * or incomplete results. The names and public/private classification were
 * cross-checked against the Kemendikdasmen reference directory and the
 * Lumajang SMK directory on 24 October 2026.
 */
export const LUMAJANG_VOCATIONAL_SCHOOLS: SchoolItem[] = [
  { name: "SMK AN-NAFI'AH TEMPEH", city, province, status: "Swasta" },
  { name: "SMK ASY SYARIFIY TEMPEH", city, province, status: "Swasta" },
  { name: "SMK BINA INSANI", city, province, status: "Swasta" },
  { name: "SMK DARUL MUSHTHOFA ASSUNNIYYAH (DARMAS) YOSOWILANGUN", city, province, status: "Swasta" },
  { name: "SMK KESEHATAN BUNDA MULIA PGRI TEMPEH", city, province, status: "Swasta" },
  { name: "SMK MANBAUL HIKMAH TEMPEH", city, province, status: "Swasta" },
  { name: "SMK MUHAMMADIYAH", city, province, status: "Swasta" },
  { name: "SMK NEGERI ROWOKANGKUNG", city, province, status: "Negeri" },
  { name: "SMK NURUL FAROH", city, province, status: "Swasta" },
  { name: "SMK NURUL HUDA", city, province, status: "Swasta" },
  { name: "SMK NURUL ISTIQOMAH", city, province, status: "Swasta" },
  { name: "SMK PESANTREN SATELIT HIDAYATUL HASAN", city, province, status: "Swasta" },
  { name: "SMK SYARIFUDDIN", city, province, status: "Swasta" },
  { name: "SMK ULIL ALBAB YOSOWILANGUN", city, province, status: "Swasta" },
  { name: "SMK WIRA YUDHA SAKTI NUSANTARA", city, province, status: "Swasta" },
  { name: "SMKN 1 LUMAJANG", city, province, status: "Negeri" },
  { name: "SMKN 1 TEKUNG", city, province, status: "Negeri" },
  { name: "SMKN 1 TEMPEH", city, province, status: "Negeri" },
  { name: "SMKN 2 LUMAJANG", city, province, status: "Negeri" },
  { name: "SMKN KLAKAH", city, province, status: "Negeri" },
  { name: "SMKN PASIRIAN", city, province, status: "Negeri" },
  { name: "SMKN SENDURO", city, province, status: "Negeri" },
  { name: "SMKN TEMPURSARI", city, province, status: "Negeri" },
  { name: "SMKS 02 YP 17 LUMAJANG", city, province, status: "Swasta" },
  { name: "SMKS AL HAROMAIN PASIRIAN", city, province, status: "Swasta" },
  { name: "SMKS AL HIDAYAH CANDIPURO", city, province, status: "Swasta" },
  { name: "SMKS AL MALIKI SUKODONO", city, province, status: "Swasta" },
  { name: "SMKS CHOIRIYAH LUMAJANG", city, province, status: "Swasta" },
  { name: "SMKS DARUN NAJAH", city, province, status: "Swasta" },
  { name: "SMKS FARMASI ADYATMA SUKODONO", city, province, status: "Swasta" },
  { name: "SMKS MIFTAHUL ISLAM KUNIR", city, province, status: "Swasta" },
  { name: "SMKS MUHAMMADIYAH JATIROTO", city, province, status: "Swasta" },
  { name: "SMKS MULIA TEMPEH", city, province, status: "Swasta" },
  { name: "SMKS PEMBANGUNAN CANDIPURO", city, province, status: "Swasta" },
  { name: "SMKS PGRI LUMAJANG", city, province, status: "Swasta" },
  { name: "SMKS ROUDLOTUL ULUM", city, province, status: "Swasta" },
  { name: "SMKS ROUDLOTUS SHOLIHIN KUNIR", city, province, status: "Swasta" },
  { name: "SMKS SUNAN KALIJOGO", city, province, status: "Swasta" },
  { name: "SMKS YP 1701 LUMAJANG", city, province, status: "Swasta" }
];
