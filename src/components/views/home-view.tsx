"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Flame, Target, Star, BookOpen, Mic, Search, Calendar, Sparkles, ArrowRight, BarChart3, Layers } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudioButton } from "@/components/verbs/audio-button";
import { xpIntoLevel, todayStr } from "@/lib/store";
import { isDue } from "@/lib/srs";

export function HomeView() {
  const verbs = useStore((s) => s.verbs);
  const profile = useStore((s) => s.profile);
  const setView = useStore((s) => s.setView);
  const openWord = useStore((s) => s.openWord);
  const srs = useStore((s) => s.srs);
  const favorites = useStore((s) => s.favorites);
  const reminders = useStore((s) => s.settings.reminders);

  const dueCount = React.useMemo(() => Object.values(srs).filter((r) => isDue(r) && r.status !== "new").length, [srs]);
  const learned = React.useMemo(() => Object.values(srs).filter((r) => r.status === "mastered" || r.status === "learning").length, [srs]);

  // word of the day (deterministic by date)
  const wotd = React.useMemo(() => {
    if (!verbs.length) return null;
    const day = Math.floor(Date.now() / 86400000);
    return verbs[day % verbs.length];
  }, [verbs]);

  const xp = xpIntoLevel(profile.xp);
  const xpPct = Math.min(100, Math.round((xp.into / xp.need) * 100));

  const today = todayStr();
  const lessonDoneToday = profile.lastStudyDate === today;

  // in-app reminder banner if reminders disabled/blocked
  const [reminderBanner, setReminderBanner] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!reminders.enabled && dueCount > 0 && !lessonDoneToday) {
      setReminderBanner(`${dueCount} verb${dueCount > 1 ? "s are" : " is"} waiting for your review today. Tap to start!`);
    } else setReminderBanner(null);
  }, [reminders.enabled, dueCount, lessonDoneToday]);

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-4">
      {/* greeting + streak header */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mesh-bg rounded-3xl p-5 relative overflow-hidden shadow-soft"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="text-2xl font-bold">{profile.name} 👋</h1>
          </div>
          <div className="flex items-center gap-3">
            <Stat icon={<Flame className="h-5 w-5 text-orange-500" />} label="Streak" value={`${profile.streak}d`} />
            <Stat icon={<Star className="h-5 w-5 text-amber-500" />} label="Level" value={`${xp.level}`} />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>XP to next level</span>
            <span>{xp.into} / {xp.need}</span>
          </div>
          <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </div>
      </motion.section>

      {/* reminder banner */}
      {reminderBanner && (
        <button
          onClick={() => setView("daily")}
          className="w-full text-left rounded-2xl bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 p-3 text-sm flex items-center gap-2"
        >
          <span className="text-lg">🔔</span>
          <span className="flex-1">{reminderBanner}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      {/* START TODAY'S LESSON — big button */}
      <motion.div whileTap={{ scale: 0.98 }}>
        <Button
          onClick={() => setView("daily")}
          size="lg"
          className="w-full h-16 text-lg font-bold rounded-2xl shadow-soft bg-gradient-to-r from-primary to-emerald-600 hover:from-primary hover:to-emerald-700"
        >
          <Target className="h-6 w-6 mr-2" />
          {lessonDoneToday ? "Continue Learning" : "Start Today's Lesson"}
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </motion.div>

      {/* quick stats row */}
      <section className="grid grid-cols-3 gap-2">
        <StatCard label="Learned" value={learned} icon={<BookOpen className="h-5 w-5" />} tint="emerald" onClick={() => setView("progress")} />
        <StatCard label="To Review" value={dueCount} icon={<Layers className="h-5 w-5" />} tint="amber" onClick={() => setView("review")} />
        <StatCard label="Favorites" value={favorites.size} icon={<Star className="h-5 w-5" />} tint="rose" onClick={() => setView("favorites")} />
      </section>

      {/* quick actions grid */}
      <section className="grid grid-cols-2 gap-3">
        <QuickAction icon={<Layers className="h-6 w-6" />} title="Flashcards" subtitle="Swipe to learn" onClick={() => setView("flashcards")} />
        <QuickAction icon={<BookOpen className="h-6 w-6" />} title="Chapters" subtitle="A–Z browse" onClick={() => setView("chapters")} />
        <QuickAction icon={<Mic className="h-6 w-6" />} title="Oral Test" subtitle="Speak & test" onClick={() => setView("oraltest")} />
        <QuickAction icon={<BarChart3 className="h-6 w-6" />} title="Progress" subtitle="Track growth" onClick={() => setView("progress")} />
      </section>

      {/* Word of the Day */}
      {wotd && (
        <section>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold">Word of the Day</h2>
          </div>
          <Card className="p-4 rounded-2xl shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => openWord(wotd.id)} className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{wotd.book_data.first_form}</span>
                  {wotd.additional_info.irregular && (
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-1.5 py-0.5 rounded">IRREGULAR</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {wotd.book_data.first_form} → {wotd.book_data.second_form} → {wotd.book_data.third_form}
                </p>
                <p className="sindhi text-lg mt-1">{wotd.book_data.sindhi_meaning}</p>
              </button>
              <AudioButton text={wotd.book_data.first_form} accent="us" />
            </div>
          </Card>
        </section>
      )}

      {/* continue learning: chapters quick jump */}
      <section>
        <h2 className="font-semibold mb-2 px-1">Continue learning</h2>
        <div className="flex gap-2 overflow-x-auto scroll-soft pb-1 -mx-3 px-3">
          {["A", "B", "C", "D", "E", "M", "P", "S"].map((c) => (
            <button
              key={c}
              onClick={() => useStore.getState().openChapter(c)}
              className="shrink-0 h-12 w-12 rounded-2xl bg-card border border-border grid place-items-center font-bold text-lg hover:bg-muted transition shadow-soft"
            >
              {c}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid place-items-center h-9 w-9 rounded-xl bg-white/60 dark:bg-white/10">{icon}</div>
      <div>
        <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
        <div className="font-bold leading-none">{value}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, tint, onClick }: { label: string; value: number; icon: React.ReactNode; tint: string; onClick: () => void }) {
  const tintMap: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300",
    amber: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300",
    rose: "text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300",
  };
  return (
    <button onClick={onClick} className="rounded-2xl bg-card border border-border p-3 text-left shadow-soft hover:shadow-md transition">
      <div className={`grid place-items-center h-8 w-8 rounded-lg ${tintMap[tint]} mb-1`}>{icon}</div>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </button>
  );
}

function QuickAction({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl bg-card border border-border p-4 text-left flex items-center gap-3 shadow-soft hover:shadow-md transition active:scale-98">
      <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary/10 text-primary">{icon}</div>
      <div className="flex-1">
        <div className="font-semibold leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
