"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Target, Check, Sparkles, Trophy, Flame, ArrowRight, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { isDue } from "@/lib/srs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudioButton } from "@/components/verbs/audio-button";

const STEPS = ["Warm-up", "New words", "Flashcards", "Mini quiz", "Pronunciation", "Summary"] as const;

interface LessonState {
  step: number;
  dueIds: string[];
  newIds: string[];
  newIdx: number;
  flipped: boolean;
  quizResults: { correct: number; total: number };
  score: number;
}

export function DailyLessonView() {
  const verbs = useStore((s) => s.verbs);
  const srs = useStore((s) => s.srs);
  const settings = useStore((s) => s.settings);
  const setView = useStore((s) => s.setView);
  const due = React.useMemo(() => Object.values(srs).filter((r) => isDue(r) && r.status !== "new").map((r) => r.id), [srs]);
  const markLearned = useStore((s) => s.markLearned);
  const recordAnswer = useStore((s) => s.recordAnswer);
  const ensureSrs = useStore((s) => s.ensureSrs);
  const bumpStreak = useStore((s) => s.bumpStreak);
  const addXp = useStore((s) => s.addXp);
  const profile = useStore((s) => s.profile);

  const [lesson, setLesson] = React.useState<LessonState | null>(null);
  // resume support: store progress in localStorage
  const STORAGE_KEY = "vm_lesson_progress";
  React.useEffect(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      try { setLesson(JSON.parse(saved)); } catch {}
    }
  }, []);
  React.useEffect(() => {
    if (lesson) localStorage.setItem(STORAGE_KEY, JSON.stringify(lesson));
    else localStorage.removeItem(STORAGE_KEY);
  }, [lesson]);

  function start() {
    const n = settings.newWordsPerLesson;
    const learnedIds = new Set(Object.values(srs).filter((r) => r.status === "mastered" || r.status === "learning").map((r) => r.id));
    const candidates = verbs.filter((v) => !learnedIds.has(v.id)).slice(0, n).map((v) => v.id);
    const init: LessonState = { step: 0, dueIds: due, newIds: candidates, newIdx: 0, flipped: false, quizResults: { correct: 0, total: 0 }, score: 0 };
    setLesson(init);
  }

  if (!lesson) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
        <header className="flex items-center gap-2">
          <button onClick={() => setView("home")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted"><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="text-2xl font-bold">Today's Lesson</h1>
        </header>
        <Card className="p-6 rounded-3xl shadow-soft mesh-bg text-center">
          <Target className="h-14 w-14 mx-auto text-primary mb-3" />
          <h2 className="text-xl font-bold">Ready to learn?</h2>
          <p className="text-muted-foreground mt-1 mb-4">Today's target: {settings.newWordsPerLesson} new words + {due.length} review words</p>
          <Button onClick={start} size="lg" className="w-full rounded-2xl h-14 text-base font-bold"><Target className="h-5 w-5" /> Start today's lesson</Button>
        </Card>
        {due.length > 0 && <p className="text-sm text-center text-muted-foreground">{due.length} words are due for review first.</p>}
      </div>
    );
  }

  const step = STEPS[lesson.step];
  const progress = Math.round((lesson.step / (STEPS.length - 1)) * 100);

  function nextStep() {
    setLesson((l) => l && { ...l, step: Math.min(STEPS.length - 1, l.step + 1) });
  }
  function prevStep() {
    setLesson((l) => l && { ...l, step: Math.max(0, l.step - 1) });
  }
  function finish() {
    bumpStreak();
    addXp(lesson.score + 20);
    setLesson(null);
    localStorage.removeItem(STORAGE_KEY);
    setView("home");
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="font-bold">Today's Lesson</h1>
        <span className="text-xs text-muted-foreground">{lesson.step + 1}/{STEPS.length}</span>
      </header>
      {/* progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {STEPS.map((s, i) => <span key={s} className={i <= lesson.step ? "text-primary font-semibold" : ""}>{s}</span>)}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={lesson.step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
          {step === "Warm-up" && (
            <Card className="p-5 rounded-2xl shadow-soft text-center">
              <Sparkles className="h-10 w-10 mx-auto text-amber-500 mb-2" />
              <h2 className="font-bold text-lg">Warm-up review</h2>
              <p className="text-muted-foreground text-sm mt-1 mb-4">{lesson.dueIds.length} words due. Review them to warm up your memory.</p>
              {lesson.dueIds.length === 0 ? (
                <p className="text-emerald-600 font-semibold mb-3">Nothing due — nice! Skip ahead.</p>
              ) : (
                <Button onClick={() => useStore.getState().startQuiz(lesson.dueIds, "Warm-up review", ["meaning", "past_form", "true_false"])} className="rounded-2xl">Review due words</Button>
              )}
            </Card>
          )}
          {step === "New words" && lesson.newIds[lesson.newIdx] && (
            <Card className="p-5 rounded-2xl shadow-soft">
              <p className="text-xs text-muted-foreground mb-1">New word {lesson.newIdx + 1} of {lesson.newIds.length}</p>
              {(() => {
                const v = verbs.find((x) => x.id === lesson.newIds[lesson.newIdx]);
                if (!v) return null;
                return (
                  <div className="text-center">
                    <h2 className="text-4xl font-bold">{v.book_data.first_form}</h2>
                    {v.additional_info.irregular && <span className="inline-block mt-1 text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded">🔴 IRREGULAR</span>}
                    <p className="text-sm text-muted-foreground mt-2">{v.book_data.first_form} → {v.book_data.second_form} → {v.book_data.third_form}</p>
                    <p className="sindhi text-2xl mt-3" dir="rtl">{v.book_data.sindhi_meaning}</p>
                    <div className="flex justify-center gap-2 mt-3"><AudioButton text={v.book_data.first_form} accent="us" /></div>
                    <p className="text-xs text-muted-foreground mt-4">Tap "Got it" to add to your learning and continue.</p>
                  </div>
                );
              })()}
            </Card>
          )}
          {step === "Flashcards" && (
            <Card className="p-5 rounded-2xl shadow-soft text-center">
              <h2 className="font-bold text-lg">Flashcards</h2>
              <p className="text-muted-foreground text-sm mt-1 mb-3">Quick flip through your new words.</p>
              <Button onClick={() => useStore.getState().startQuiz(lesson.newIds, "New words flash", ["meaning", "sindhi_to_english"])} className="rounded-2xl">Open flashcards</Button>
            </Card>
          )}
          {step === "Mini quiz" && (
            <Card className="p-5 rounded-2xl shadow-soft text-center">
              <Trophy className="h-10 w-10 mx-auto text-amber-500 mb-2" />
              <h2 className="font-bold text-lg">Mini quiz</h2>
              <p className="text-muted-foreground text-sm mt-1 mb-3">Test what you just learned.</p>
              <Button onClick={() => useStore.getState().startQuiz(lesson.newIds, "Today's mini quiz", ["meaning", "past_form", "third_form", "sindhi_to_english", "true_false"])} className="rounded-2xl">Start mini quiz</Button>
            </Card>
          )}
          {step === "Pronunciation" && (
            <Card className="p-5 rounded-2xl shadow-soft text-center">
              <h2 className="font-bold text-lg">Pronunciation</h2>
              <p className="text-muted-foreground text-sm mt-1 mb-3">Practice saying your new words out loud.</p>
              <Button onClick={() => setView("pronunciation")} className="rounded-2xl">Open pronunciation trainer</Button>
            </Card>
          )}
          {step === "Summary" && (
            <Card className="p-5 rounded-2xl shadow-soft text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="inline-grid place-items-center h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-3">
                <Trophy className="h-10 w-10 text-amber-500" />
              </motion.div>
              <h2 className="font-bold text-xl">Lesson complete!</h2>
              <p className="text-muted-foreground mt-1">You learned {lesson.newIds.length} new words today.</p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="text-center"><div className="text-2xl font-bold">{profile.wordsLearnedToday}</div><div className="text-xs text-muted-foreground">Words today</div></div>
                <div className="text-center"><div className="text-2xl font-bold flex items-center gap-1 justify-center"><Flame className="h-5 w-5 text-orange-500" />{profile.streak + 1}</div><div className="text-xs text-muted-foreground">Streak</div></div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">Tomorrow: keep your streak alive 🔥 — see you then!</p>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* mark new word learned */}
      {step === "New words" && lesson.newIds[lesson.newIdx] && (
        <Button
          onClick={async () => {
            const id = lesson.newIds[lesson.newIdx];
            await markLearned(id);
            setLesson((l) => l && { ...l, newIdx: l.newIdx + 1, score: l.score + 5 });
            if (lesson.newIdx + 1 >= lesson.newIds.length) nextStep();
          }}
          className="w-full rounded-2xl h-12"
        ><Check className="h-5 w-5" /> Got it — add to my learning</Button>
      )}

      <div className="flex gap-2">
        {lesson.step > 0 && <Button onClick={prevStep} variant="outline" className="rounded-xl"><ArrowLeft className="h-4 w-4" /> Back</Button>}
        {lesson.step < STEPS.length - 1 ? (
          <Button onClick={nextStep} className="flex-1 rounded-xl">Continue <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button onClick={finish} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700">Finish & claim XP <Sparkles className="h-4 w-4" /></Button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">Your progress is saved — close the app and resume anytime.</p>
    </div>
  );
}
