"use client";
import * as React from "react";
import { Search, X, ChevronLeft, Star, History } from "lucide-react";
import { useStore } from "@/lib/store";
import { VerbSearch, autocomplete } from "@/lib/search";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AudioButton } from "@/components/verbs/audio-button";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "irregular", label: "Irregular" },
  { id: "favorites", label: "Favorites" },
  { id: "mastered", label: "Mastered" },
  { id: "review", label: "Needs review" },
] as const;

export function SearchView() {
  const verbs = useStore((s) => s.verbs);
  const srs = useStore((s) => s.srs);
  const favorites = useStore((s) => s.favorites);
  const setView = useStore((s) => s.setView);
  const openWord = useStore((s) => s.openWord);
  const [q, setQ] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["id"]>("all");

  const engine = React.useMemo(() => (verbs.length ? new VerbSearch(verbs) : null), [verbs]);
  const suggestions = React.useMemo(() => (q ? autocomplete(verbs, q) : []), [q, verbs]);

  const results = React.useMemo(() => {
    if (!engine) return [];
    let hits = engine.query(q, 40).map((h) => h.verb);
    if (filter === "irregular") hits = hits.filter((v) => v.additional_info.irregular);
    if (filter === "favorites") hits = hits.filter((v) => favorites.has(v.id));
    if (filter === "mastered") hits = hits.filter((v) => srs[v.id]?.status === "mastered");
    if (filter === "review") hits = hits.filter((v) => srs[v.id]?.status === "review");
    return hits;
  }, [engine, q, filter, favorites, srs]);

  function submit(s: string) {
    const term = s.trim();
    if (!term) return;
    if (engine) engine.query(term, 40);
    setQ(term);
    setHistory((h) => [term, ...h.filter((x) => x !== term)].slice(0, 8));
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <header className="flex items-center gap-2">
        <button onClick={() => setView("home")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Back"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-xl font-bold flex-1">Search</h1>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(q)}
          placeholder="English, Sindhi, any verb form…"
          className="pl-9 pr-9 rounded-xl h-11"
          autoFocus
        />
        {q && <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>

      {/* autocomplete */}
      {suggestions.length > 0 && q && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => setQ(s)} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10">{s}</button>
          ))}
        </div>
      )}

      {/* filters */}
      <div className="flex gap-1.5 overflow-x-auto scroll-soft -mx-3 px-3 pb-1">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{f.label}</button>
        ))}
      </div>

      {/* history when empty */}
      {!q && history.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5 px-1"><History className="h-3.5 w-3.5" /> Recent searches</div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h) => <button key={h} onClick={() => setQ(h)} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10">{h}</button>)}
          </div>
        </div>
      )}

      {/* results */}
      {q && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">No matches. Try a different spelling or part of the word.</Card>
          ) : (
            results.map((v) => {
              const r = srs[v.id];
              const fav = favorites.has(v.id);
              return (
                <button key={v.id} onClick={() => openWord(v.id)} className="w-full text-left rounded-2xl bg-card border border-border p-3 flex items-center gap-3 shadow-soft hover:shadow-md transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{v.book_data.first_form}</span>
                      {v.additional_info.irregular && <span className="text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-1 py-0.5 rounded">IRR</span>}
                      {fav && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                      {r && <span className="text-[9px] uppercase font-bold px-1 py-0.5 rounded bg-muted">{r.status}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{v.book_data.first_form} → {v.book_data.second_form} → {v.book_data.third_form}</p>
                    <p className="sindhi text-sm mt-0.5 truncate" dir="rtl">{v.book_data.sindhi_meaning}</p>
                  </div>
                  <AudioButton text={v.book_data.first_form} accent="us" size="sm" />
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
