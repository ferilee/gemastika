import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import type { Agenda, HomeContent, Member, News, Portfolio } from "@/types";

type AppDataState = {
  members: Member[];
  agendas: Agenda[];
  news: News[];
  portfolios: Portfolio[];
  homeContent: HomeContent;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  addNews: (created: News) => void;
  removeNews: (id: number) => void;
  addPortfolio: (created: Portfolio) => void;
  removePortfolio: (id: number) => void;
  patchMember: (member: Member) => void;
  setHomeContent: (value: HomeContent) => void;
};

const AppDataContext = createContext<AppDataState | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [homeContent, setHomeContent] = useState<HomeContent>({
    quickLinks: [],
    quote: {
      text: "Mathematics is the language with which God has written the universe.",
      author: "Galileo Galilei"
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [m, a, n, p, h] = await Promise.all([
        api<Member[]>("/api/members"),
        api<Agenda[]>("/api/agendas"),
        api<News[]>("/api/news"),
        api<Portfolio[]>("/api/portfolios?limit=60"),
        api<HomeContent>("/api/home-content")
      ]);
      setMembers(m);
      setAgendas(a);
      setNews(n);
      setPortfolios(p);
      setHomeContent(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await reload();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AppDataState>(
    () => ({
      members,
      agendas,
      news,
      portfolios,
      homeContent,
      loading,
      error,
      reload,
      addNews: (created) => setNews((v) => [created, ...v]),
      removeNews: (id) => setNews((v) => v.filter((item) => item.id !== id)),
      addPortfolio: (created) => setPortfolios((v) => [created, ...v]),
      removePortfolio: (id) => setPortfolios((v) => v.filter((item) => item.id !== id)),
      patchMember: (member) =>
        setMembers((prev) => {
          const idx = prev.findIndex((m) => m.id === member.id);
          if (idx === -1) return [member, ...prev];
          const next = [...prev];
          next[idx] = member;
          return next;
        }),
      setHomeContent
    }),
    [agendas, error, homeContent, loading, members, news, portfolios]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
