"use client";
import * as React from "react";
import { ChevronLeft, RotateCcw, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { isDue } from "@/lib/srs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudioButton } from "@/components/verbs/audio-button";

export function ReviewView() {
  const verbs = useStore((s) => s.verbs);
  const srs = useStore((s) => s.srs);
  const setView = useStore((s) => s.setView);
  const openWord = useStore((s) => s.openWord);

  const reviewIds = React.useMemo(() => {
    const now = Date.now();
    const out: string[] = [];
    const seen = new Set<string>();
    for (const r of Object.values(srs)) {
      const due = isDue(r, now) && r.status !== "new";
      if ((due || r.leeched) && !seen.has(r.id)) { out.push(r.id); seen.add(r.id); }
    }
    return out;
  }, [srs]);
  const leechCount = React.useMemo(() => Object.values(srs).filter((r) => r.leeched).length, [srs]);
  const list = verbs.filter((v) => reviewIds.includes(v.id));

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <header className="flex items-center gap-2">
        <button onClick={() => setView("more")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Back"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold">Words I Need to Review</h1>
      </header>
      {list.length === 0 ? (
        <Card className="p-8 text-center rounded-2xl">
          <RotateCcw className="h-12 w-12 mx-auto text-emerald-400 mb-2" />
          <p className="font-semibold">All caught up! 🎉</p>
          <p className="text-sm text-muted-foreground">No words need review right now. Great work.</p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground px-1">{list.length} word{list.length > 1 ? "s" : ""} to review. Wrong answers come back here automatically.</p>
          {leechCount > 0 && (
            <Card className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {leechCount} "leech" word{leechCount > 1 ? "s" : ""} missed 5+ times — extra help enabled (memory tips, simpler quizzes).
            </Card>
          )}
          <Button onClick={() => useStore.getState().startQuiz(reviewIds, "Review Quiz", ["meaning", "past_form", "third_form", "sindhi_to_english", "true_false"])} className="w-full rounded-2xl h-12">Quiz me on these</Button>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto scroll-soft pr-1">
            {list.map((v) => {
              const r = srs[v.id];
              return (
                <button key={v.id} onClick={() => openWord(v.id)} className="w-full text-left rounded-2xl bg-card border border-border p-3 flex items-center gap-3 shadow-soft">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{v.book_data.first_form}</span>
                      {r?.leeched && <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1 py-0.5 rounded">LEECH</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{v.book_data.first_form} → {v.book_data.second_form} → {v.book_data.third_form}</p>
                    <p className="sindhi text-sm truncate" dir="rtl">{v.book_data.sindhi_meaning}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">wrong {r?.wrong || 0} · next due {r ? new Date(r.nextDue).toLocaleDateString() : "—"}</p>
                  </div>
                  <AudioButton text={v.book_data.first_form} accent="us" size="sm" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
