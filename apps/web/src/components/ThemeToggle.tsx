import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

function getInitialDark(): boolean {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") return true;
  if (saved === "light") return false;
  // Default ke tema gelap agar tampilan konsisten seperti desain.
  return true;
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => getInitialDark());

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Ganti tema"
      title="Ganti tema"
      onClick={() => setDark((v) => !v)}
    >
      <Settings className="h-4 w-4 text-mgmp-accent" />
    </Button>
  );
}
