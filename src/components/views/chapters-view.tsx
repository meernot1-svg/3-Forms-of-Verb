"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/verbs/progress-ring";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function ChaptersView() {
  const verbs = useStore((s) => s.verbs);
  const openChapter = useStore((s) => s.openChapter);
  const srs = useStore((s) => s.srs);

  const chapters = React.useMemo(() => {
    const map: Record<string, { total: number; learned: number; ids: string[] }> = {};
    for (const L of LETTERS) map[L] = { total: 0, learned: 0, ids: [] };
    for (const v of verbs) {
      const c = v.chapter;
      if (!map[c]) continue;
      map[c].total++;
      map[c].ids.push(v.id);
      const r = srs[v.id];
      if (r && (r.status === "mastered" || r.status === "learning")) map[c].learned++;
    }
    return map;
  }, [verbs, srs]);

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chapters</h1>
        <span className="text-sm text-muted-foreground">{verbs.length} verbs · A→Z</span>
      </header>

      {/* A-Z quick jump grid */}
      <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5">
        {LETTERS.map((L) => {
          const ch = chapters[L];
          const empty = ch.total === 0;
          return (
            <button
              key={L}
              onClick={() => openChapter(L)}
              disabled={empty}
              className={`aspect-square rounded-xl grid place-items-center font-bold text-sm border transition ${
                empty
                  ? "bg-muted/40 text-muted-foreground/40 border-transparent"
                  : "bg-card border-border hover:bg-primary/10 hover:border-primary/40"
              }`}
              aria-label={`Chapter ${L}${empty ? " (no verbs)" : ` — ${ch.total} verbs`}`}
            >
              {L}
            </button>
          );
        })}
      </div>

      {/* chapter cards */}
      <div className="space-y-2.5">
        {LETTERS.map((L, i) => {
          const ch = chapters[L];
          if (ch.total === 0) {
            return (
              <Card key={L} className="p-4 rounded-2xl opacity-70">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-muted grid place-items-center font-bold text-muted-foreground">{L}</div>
                  <div className="flex-1">
                    <div className="font-semibold">Chapter {L}</div>
                    <div className="text-sm text-muted-foreground">No verbs available for this chapter.</div>
                  </div>
                </div>
              </Card>
            );
          }
          const pct = Math.round((ch.learned / ch.total) * 100);
          const remaining = ch.total - ch.learned;
          return (
            <motion.div
              key={L}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <Card className="p-4 rounded-2xl shadow-soft">
                <div className="flex items-center gap-3">
                  <ProgressRing value={pct} letter={L} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Chapter {L}</span>
                      {pct === 100 && <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">✓ Done</span>}
                      {i > 0 && ch.total > 0 && pct < 30 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">Recommended next</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {ch.total} words · {ch.learned} learned · {remaining} remaining
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="flex-1 rounded-xl" onClick={() => openChapter(L)}>Start Learning</Button>
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => useStore.getState().startQuiz(ch.ids, `Chapter ${L} Practice`, ["meaning", "past_form", "third_form", "sindhi_to_english", "true_false"])}>Practice</Button>
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => useStore.getState().startQuiz(ch.ids, `${L} Chapter Test`, ["meaning", "past_form", "third_form", "sindhi_to_english", "english_to_sindhi", "true_false", "odd_one_out"], true)}>Test</Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
