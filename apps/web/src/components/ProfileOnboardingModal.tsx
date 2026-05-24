import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/state/AuthContext";
import { useAppData } from "@/state/AppDataContext";
import type { Member } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ProfileStatus = {
  registered: boolean;
  member: Member | null;
};

type SchoolItem = {
  name: string;
  city: string;
  province: string;
};

function FloatingField({
  id,
  label,
  value,
  onChange,
  type = "text"
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="relative block">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        className="peer w-full h-11 rounded-xl border border-slate-300/80 bg-white/90 px-3 pt-4 pb-1.5 text-sm text-slate-800 outline-none transition focus:border-mgmp-primary dark:border-white/15 dark:bg-[#0b1220]/70 dark:text-slate-100"
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[11px] peer-focus:font-extrabold peer-focus:text-mgmp-primary peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-extrabold dark:text-slate-400">
        {label}
      </span>
    </label>
  );
}

export function ProfileOnboardingModal() {
  const { user, profileRegistered, refresh } = useAuth();
  const { reload } = useAppData();
  const [checking, setChecking] = useState(false);
  const [mustFill, setMustFill] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [wa, setWa] = useState("");
  const [telegram, setTelegram] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [profileUrl, setProfileUrl] = useState("");

  const [schoolQuery, setSchoolQuery] = useState("");
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [openSuggestion, setOpenSuggestion] = useState(false);
  const [errorText, setErrorText] = useState("");

  function isValidWa(raw: string) {
    const cleaned = raw.replace(/[^\d]/g, "");
    return cleaned.length >= 10 && cleaned.length <= 16;
  }

  function isValidTelegram(raw: string) {
    const v = raw.trim().replace(/^@/, "");
    return /^[a-zA-Z0-9_]{5,32}$/.test(v);
  }

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) {
        setMustFill(false);
        return;
      }
      if (profileRegistered) {
        setMustFill(false);
        return;
      }
      setChecking(true);
      try {
        const res = await api<ProfileStatus>("/api/profile/me");
        if (cancelled) return;
        setMustFill(!res.registered);
        if (res.member) {
          setName(res.member.name || "");
          setSchool(res.member.school || "");
          setWa(res.member.wa || "");
          setTelegram(res.member.telegram || "");
          setPhotoUrl(res.member.photoUrl || "");
          setProfileUrl(res.member.profileUrl || "");
        } else {
          setName(user.name || "");
        }
      } catch {
        if (!cancelled) setMustFill(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [user, profileRegistered]);

  useEffect(() => {
    let cancelled = false;
    const q = schoolQuery.trim();
    if (q.length < 2 || !mustFill) {
      setSchools([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await api<{ items: SchoolItem[] }>(`/api/schools?q=${encodeURIComponent(q)}`);
        if (!cancelled) setSchools(res.items || []);
      } catch {
        if (!cancelled) setSchools([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [schoolQuery, mustFill]);

  const canSubmit = useMemo(() => {
    const hasContact = wa.trim().length > 0 || telegram.trim().length > 0;
    const waOk = !wa.trim() || isValidWa(wa);
    const teleOk = !telegram.trim() || isValidTelegram(telegram);
    return name.trim().length >= 3 && school.trim().length >= 3 && hasContact && waOk && teleOk;
  }, [name, school, wa, telegram]);

  async function submit() {
    if (!canSubmit) return;
    setErrorText("");
    setSaving(true);
    try {
      await api<ProfileStatus>("/api/profile/me", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          school: school.trim(),
          wa: wa.trim(),
          telegram: telegram.trim(),
          photoUrl: photoUrl.trim(),
          profileUrl: profileUrl.trim()
        })
      });
      await refresh();
      await reload();
      setMustFill(false);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menyimpan profil.");
    } finally {
      setSaving(false);
    }
  }

  if (!user || checking) return null;

  return (
    <Dialog open={mustFill} onOpenChange={(next) => setMustFill(next ? true : mustFill)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Lengkapi Profil Anggota</DialogTitle>
          <DialogDescription>Profiling ini digunakan sebagai pendaftaran anggota MGMP.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-3">
          <FloatingField id="full_name" label="Nama Lengkap" value={name} onChange={setName} />

          <div className="relative">
            <FloatingField
              id="school_name"
              label="Instansi / Sekolah"
              value={school}
              onChange={(value) => {
                setSchool(value);
                setSchoolQuery(value);
                setOpenSuggestion(true);
              }}
            />
            {openSuggestion && schools.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0b1220] max-h-56 overflow-auto">
                {schools.map((s, idx) => (
                  <button
                    type="button"
                    key={`${s.name}-${s.city}-${idx}`}
                    className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/5"
                    onClick={() => {
                      const text = [s.name, s.city, s.province].filter(Boolean).join(" - ");
                      setSchool(text);
                      setSchoolQuery(text);
                      setOpenSuggestion(false);
                    }}
                  >
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{[s.city, s.province].filter(Boolean).join(", ")}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <FloatingField id="wa" label="Nomor WhatsApp" value={wa} onChange={setWa} />
          <FloatingField id="telegram" label="Username Telegram" value={telegram} onChange={setTelegram} />
          <FloatingField id="photo_url" label="URL Foto Profil (opsional)" value={photoUrl} onChange={setPhotoUrl} />
          <FloatingField id="website_url" label="URL Website Profil (opsional)" value={profileUrl} onChange={setProfileUrl} />
          {photoUrl.trim() ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/80 p-2 dark:border-white/10 dark:bg-white/5">
              <img
                src={photoUrl}
                alt="Preview Foto Profil"
                className="h-24 w-24 rounded-lg object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          ) : null}
          {!wa.trim() && !telegram.trim() ? (
            <div className="text-xs font-bold text-amber-600 dark:text-amber-300">Isi minimal WhatsApp atau Telegram.</div>
          ) : null}
          {wa.trim() && !isValidWa(wa) ? (
            <div className="text-xs font-bold text-rose-600 dark:text-rose-300">Format WhatsApp tidak valid (10-16 digit).</div>
          ) : null}
          {telegram.trim() && !isValidTelegram(telegram) ? (
            <div className="text-xs font-bold text-rose-600 dark:text-rose-300">
              Format Telegram tidak valid (5-32 karakter: huruf, angka, underscore).
            </div>
          ) : null}
          {errorText ? <div className="text-xs font-bold text-rose-600 dark:text-rose-300">{errorText}</div> : null}

          <div className="pt-1">
            <Button disabled={!canSubmit || saving} onClick={() => void submit()} className="w-full font-extrabold">
              {saving ? "Menyimpan..." : "Simpan Profil"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
