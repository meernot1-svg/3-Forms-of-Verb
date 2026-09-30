"use client";
import * as React from "react";
import { ChevronLeft, Search, Star, CheckCircle2, RotateCcw, Circle } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ChapterView() {
  const chapter = useStore((s) => s.activeChapter);
  const verbs = useStore((s) => s.verbs);
  const srs = useStore((s) => s.srs);
  const favorites = useStore((s) => s.favorites);
  const openWord = useStore((s) => s.openWord);
  const setView = useStore((s) => s.setView);
  const [q, setQ] = React.useState("");

  const list = React.useMemo(() => {
    const ch = verbs.filter((v) => v.chapter === chapter);
    const f = q.trim().toLowerCase();
    if (!f) return ch;
    return ch.filter(
      (v) =>
        v.id.includes(f) ||
        v.book_data.first_form.includes(f) ||
        v.book_data.sindhi_meaning.includes(q.trim())
    );
  }, [verbs, chapter, q]);

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <header className="flex items-center gap-2">
        <button onClick={() => setView("chapters")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Back">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Chapter {chapter}</h1>
          <p className="text-xs text-muted-foreground">{list.length} verb{list.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setView("search")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Search"><Search className="h-5 w-5" /></button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${chapter} verbs…`} className="pl-9 rounded-xl" />
      </div>

      {list.length === 0 ? (
        <Card className="p-6 rounded-2xl text-center">
          <p className="text-muted-foreground">{q ? "No matches." : "No verbs available for this chapter."}</p>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[68vh] overflow-y-auto scroll-soft pr-1">
          {list.map((v) => {
            const r = srs[v.id];
            const fav = favorites.has(v.id);
            return (
              <button
                key={v.id}
                onClick={() => openWord(v.id)}
                className="w-full text-left rounded-2xl bg-card border border-border p-3 flex items-center gap-3 shadow-soft hover:shadow-md transition active:scale-[0.99]"
              >
                <StatusIcon status={r?.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{v.book_data.first_form}</span>
                    {v.additional_info.irregular && (
                      <span className="text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-1 py-0.5 rounded">IRR</span>
                    )}
                    {fav && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {v.book_data.first_form} → {v.book_data.second_form} → {v.book_data.third_form}
                  </p>
                  <p className="sindhi text-sm mt-0.5 truncate">{v.book_data.sindhi_meaning}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status?: string }) {
  if (status === "mastered") return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
  if (status === "review") return <RotateCcw className="h-5 w-5 text-rose-500 shrink-0" />;
  if (status === "learning") return <Circle className="h-5 w-5 text-amber-500 fill-amber-400 shrink-0" />;
  return <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />;
}
