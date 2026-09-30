"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Flame, Target, Trophy, Clock, TrendingUp, Download } from "lucide-react";
import { useStore, todayStr } from "@/lib/store";
import { getDb } from "@/lib/dexie";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/verbs/progress-ring";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function ProgressView() {
  const verbs = useStore((s) => s.verbs);
  const srs = useStore((s) => s.srs);
  const profile = useStore((s) => s.profile);
  const setView = useStore((s) => s.setView);

  const [daily, setDaily] = React.useState<{ date: string; xp: number; studied: number }[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const rows = await db.dailyLog.toArray();
        rows.sort((a, b) => a.date.localeCompare(b.date));
        setDaily(rows.slice(-7).map((r) => ({ date: r.date, xp: r.xp, studied: r.studied })));
      } catch {}
    })();
  }, []);

  const stats = React.useMemo(() => {
    const all = Object.values(srs);
    const mastered = all.filter((r) => r.status === "mastered").length;
    const learning = all.filter((r) => r.status === "learning").length;
    const review = all.filter((r) => r.status === "review").length;
    const total = verbs.length;
    const learned = mastered + learning;
    const accuracy = all.length ? Math.round((all.reduce((s, r) => s + r.correct, 0) / (all.reduce((s, r) => s + r.attempts, 0) || 1)) * 100) : 0;
    return { mastered, learning, review, total, learned, accuracy };
  }, [srs, verbs]);

  // per-letter progress for A-Z bars
  const letterStats = React.useMemo(() => {
    const map: Record<string, { total: number; learned: number }> = {};
    for (const L of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") map[L] = { total: 0, learned: 0 };
    for (const v of verbs) {
      if (!map[v.chapter]) continue;
      map[v.chapter].total++;
      if (srs[v.id]?.status === "mastered" || srs[v.id]?.status === "learning") map[v.chapter].learned++;
    }
    return map;
  }, [verbs, srs]);

  const goalPct = Math.min(100, Math.round((profile.wordsLearnedToday / useStore.getState().settings.dailyGoal) * 100));

  // forgetting risk: words due or nearly due
  const now = Date.now();
  const risk = Object.values(srs).filter((r) => r.nextDue - now < 2 * 86400000 && r.status !== "new").slice(0, 6);

  function exportJSON() {
    const data = { profile, srs: Object.values(srs), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "verbmaster-progress.json"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Progress</h1>
        <Button onClick={exportJSON} variant="outline" size="sm" className="rounded-xl"><Download className="h-4 w-4" /> Export</Button>
      </header>

      {/* top stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 rounded-2xl text-center shadow-soft"><div className="text-3xl font-bold">{stats.learned}</div><div className="text-xs text-muted-foreground">Learned</div></Card>
        <Card className="p-3 rounded-2xl text-center shadow-soft"><div className="text-3xl font-bold text-emerald-600">{stats.mastered}</div><div className="text-xs text-muted-foreground">Mastered</div></Card>
        <Card className="p-3 rounded-2xl text-center shadow-soft"><div className="text-3xl font-bold text-rose-600">{stats.review}</div><div className="text-xs text-muted-foreground">Needs review</div></Card>
      </div>

      {/* overall ring */}
      <Card className="p-5 rounded-2xl shadow-soft flex items-center gap-4">
        <ProgressRing value={stats.total ? Math.round((stats.learned / stats.total) * 100) : 0} size={80} />
        <div>
          <div className="text-sm text-muted-foreground">Overall completion</div>
          <div className="text-2xl font-bold">{stats.learned} / {stats.total}</div>
          <div className="text-xs text-muted-foreground mt-1">{Math.round((stats.learned / Math.max(1, stats.total)) * 100)}% of the book</div>
        </div>
      </Card>

      {/* streak + daily goal */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 rounded-2xl shadow-soft flex items-center gap-3">
          <div className="grid place-items-center h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30"><Flame className="h-7 w-7 text-orange-500" /></div>
          <div><div className="text-2xl font-bold">{profile.streak}</div><div className="text-xs text-muted-foreground">Day streak 🔥</div></div>
        </Card>
        <Card className="p-4 rounded-2xl shadow-soft flex items-center gap-3">
          <div className="grid place-items-center h-12 w-12 rounded-xl bg-primary/10"><Target className="h-7 w-7 text-primary" /></div>
          <div><div className="text-2xl font-bold">{profile.wordsLearnedToday}/{useStore.getState().settings.dailyGoal}</div><div className="text-xs text-muted-foreground">Today's goal</div></div>
        </Card>
      </div>

      {/* weekly chart */}
      <Card className="p-4 rounded-2xl shadow-soft">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Weekly activity</h2>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="h-32">
          {daily.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">No activity yet this week.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="studied" radius={[6, 6, 0, 0]}>
                  {daily.map((d, i) => <Cell key={i} fill="#10b981" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* accuracy */}
      <Card className="p-4 rounded-2xl shadow-soft flex items-center justify-between">
        <div><h2 className="font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Quiz accuracy</h2><p className="text-xs text-muted-foreground">Across all attempts</p></div>
        <div className="text-3xl font-bold text-primary">{stats.accuracy}%</div>
      </Card>

      {/* A-Z progress bars */}
      <Card className="p-4 rounded-2xl shadow-soft">
        <h2 className="font-semibold mb-3">A–Z chapter progress</h2>
        <div className="space-y-1.5 max-h-64 overflow-y-auto scroll-soft pr-1">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => {
            const s = letterStats[L];
            const pct = s.total ? Math.round((s.learned / s.total) * 100) : 0;
            return (
              <div key={L} className="flex items-center gap-2">
                <span className="w-5 text-sm font-bold">{L}</span>
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-primary" />
                </div>
                <span className="w-16 text-xs text-muted-foreground text-right">{s.learned}/{s.total || 0}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* forgetting risk */}
      {risk.length > 0 && (
        <Card className="p-4 rounded-2xl shadow-soft">
          <h2 className="font-semibold mb-2 text-amber-600">⚠️ Forgetting risk</h2>
          <p className="text-xs text-muted-foreground mb-2">Words due or nearly due — review soon to keep them.</p>
          <div className="flex flex-wrap gap-1.5">
            {risk.map((r) => {
              const v = verbs.find((x) => x.id === r.id);
              if (!v) return null;
              return <button key={r.id} onClick={() => useStore.getState().openWord(r.id)} className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{v.book_data.first_form}</button>;
            })}
          </div>
        </Card>
      )}

      <Button onClick={() => setView("daily")} className="w-full rounded-2xl h-12"><Target className="h-5 w-5" /> Start today's lesson</Button>
    </div>
  );
}
