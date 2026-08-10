import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function alertMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object") {
    const record = value as { message?: unknown; error?: unknown; detail?: unknown };
    for (const candidate of [record.message, record.error, record.detail]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
      if (candidate && typeof candidate === "object") {
        const nested = alertMessage(candidate);
        if (nested) return nested;
      }
    }
  }
  return "Terjadi kesalahan. Silakan coba lagi.";
}

export function GlobalAlertDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const originalAlert = window.alert.bind(window);

    window.alert = (msg?: unknown) => {
      setMessage(alertMessage(msg));
      setOpen(true);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Informasi
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-700 dark:text-slate-200">{message}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <Button className="w-full font-extrabold" onClick={() => setOpen(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
