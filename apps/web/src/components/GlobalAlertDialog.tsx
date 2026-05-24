import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function GlobalAlertDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const originalAlert = window.alert.bind(window);

    window.alert = (msg?: unknown) => {
      const text = typeof msg === "string" ? msg : String(msg ?? "");
      setMessage(text);
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
