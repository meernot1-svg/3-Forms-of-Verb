"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock, AlertCircle, Trophy, RotateCcw, ListChecks } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AudioButton } from "@/components/verbs/audio-button";
import { buildQuiz, checkAnswer, type QuizQuestion } from "@/lib/quiz";
import { speak } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface QuizResult { q: QuizQuestion; userAnswer: string; correct: boolean; }

export function QuizView() {
  const verbs = useStore((s) => s.verbs);
  const verbIds = useStore((s) => s.activeQuizVerbIds);
  const title = useStore((s) => s.activeQuizTitle);
  const types = useStore((s) => s.activeQuizTypes);
  const examMode = useStore((s) => s.activeQuizExamMode);
  const recordAnswer = useStore((s) => s.recordAnswer);
  const ensureSrs = useStore((s) => s.ensureSrs);
  const addXp = useStore((s) => s.addXp);
  const setView = useStore((s) => s.setView);

  const [questions, setQuestions] = React.useState<QuizQuestion[]>([]);
  const [pos, setPos] = React.useState(0);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [textAnswer, setTextAnswer] = React.useState("");
  const [results, setResults] = React.useState<QuizResult[]>([]);
  const [showResult, setShowResult] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
  const [perQTime, setPerQTime] = React.useState<number | null>(null);
  const [violations, setViolations] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  // build questions once
  React.useEffect(() => {
    const qs = verbs.filter((v) => verbIds.includes(v.id));
    if (qs.length === 0) return;
    const count = Math.min(verbIds.length, 15);
    const built = buildQuiz(qs, types, count);
    setQuestions(built);
    setPos(0); setPicked(null); setTextAnswer(""); setResults([]); setShowResult(false);
    setPerQTime(examMode ? 20 : null);
    setTimeLeft(examMode ? 20 : null);
  }, [verbs, verbIds, types, examMode]);

  // Exam mode: lock navigation
  React.useEffect(() => {
    if (!examMode) return;
    const onPop = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, "", window.location.href);
      toast("Test in progress — tap 'Quit test' to end.", { duration: 2000 });
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPop);
    const onVis = () => {
      if (document.hidden) {
        setViolations((v) => v + 1);
        setPaused(true);
        toast.warning("You left the test — timer paused. Return to continue.", { duration: 3000 });
      } else {
        setPaused(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [examMode]);

  // keep the current question + state in a ref so the timer can call submit without reordering
  const stateRef = React.useRef({ picked, pos, questions, textAnswer, examMode });
  const submitRef = React.useRef<(answer: string) => void>(() => {});

  const submit = React.useCallback((answer: string) => {
    const { picked: pk, pos: p, questions: qs, examMode: em, textAnswer: ta } = stateRef.current;
    const q = qs[p];
    if (!q) return;
    if (pk && q.options) return; // already answered MCQ
    const correct = checkAnswer(q, answer);
    setPicked(answer || ta);
    setResults((r) => [...r, { q, userAnswer: answer || ta, correct }]);
    ensureSrs(q.verbId).then(() => recordAnswer(q.verbId, correct));
    if (correct) addXp(8);
    setTimeout(() => {
      if (p + 1 < qs.length) {
        setPos((x) => x + 1);
        setPicked(null);
        setTextAnswer("");
        setPerQTime(em ? 20 : null);
        setTimeLeft(em ? 20 : null);
      } else {
        setShowResult(true);
      }
    }, 900);
  }, [ensureSrs, recordAnswer, addXp]);

  // sync refs to latest state/handler (must be in effect, not during render)
  React.useEffect(() => {
    stateRef.current = { picked, pos, questions, textAnswer, examMode };
    submitRef.current = submit;
  }, [picked, pos, questions, textAnswer, examMode, submit]);

  // timer
  React.useEffect(() => {
    if (showResult || paused || timeLeft === null) return;
    if (timeLeft <= 0) { submitRef.current(""); return; }
    const t = setTimeout(() => setTimeLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, showResult, paused]);

  // play audio for listening questions
  React.useEffect(() => {
    const q = questions[pos];
    if (q && q.type === "listening" && q.audio) {
      setTimeout(() => speak(q.audio!, { accent: "us" }), 200);
    }
  }, [pos, questions]);

  if (questions.length === 0) {
    return <div className="p-6 text-center text-muted-foreground">No quiz available.</div>;
  }

  const q = questions[pos];
  if (showResult) return <ResultView results={results} title={title} examMode={examMode} violations={violations} onRetry={resetAll} onReviewMistakes={reviewMistakes} onBack={() => setView("chapters")} />;

  function resetAll() {
    const qs = verbs.filter((v) => verbIds.includes(v.id));
    const built = buildQuiz(qs, types, Math.min(verbIds.length, 15));
    setQuestions(built); setPos(0); setPicked(null); setTextAnswer(""); setResults([]); setShowResult(false);
    setPerQTime(examMode ? 20 : null); setTimeLeft(examMode ? 20 : null);
  }
  function reviewMistakes() {
    const wrongVerbs = results.filter((r) => !r.correct).map((r) => r.q.verbId);
    if (!wrongVerbs.length) return;
    useStore.getState().startQuiz(wrongVerbs, `${title} — Mistakes only`, types, examMode);
  }
  function quitTest() {
    if (confirm("Quit test? Your progress will be marked incomplete.")) {
      setView("chapters");
    }
  }

  const progressPct = Math.round((pos / questions.length) * 100);

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex-1 truncate">{title}</h1>
        {examMode && (
          <Button onClick={quitTest} variant="destructive" size="sm" className="rounded-xl">Quit test</Button>
        )}
        {!examMode && (
          <button onClick={() => setView("chapters")} className="text-sm text-primary">Exit</button>
        )}
      </header>

      {/* progress + timer */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{pos + 1}/{questions.length}</span>
        {timeLeft !== null && (
          <div className={cn("flex items-center gap-1 text-sm font-bold tabular-nums", timeLeft <= 5 ? "text-rose-500" : "text-muted-foreground")}>
            <Clock className="h-4 w-4" />
            <TimerRing seconds={timeLeft} max={perQTime ?? 20} />
          </div>
        )}
        {violations > 0 && (
          <span className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><AlertCircle className="h-3 w-3" />{violations}</span>
        )}
      </div>

      {paused && (
        <Card className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-center">
          <p className="font-semibold">Test paused</p>
          <p className="text-sm text-muted-foreground">You left the app. The timer is paused. Switch back to continue.</p>
        </Card>
      )}

      {/* question */}
      <AnimatePresence mode="wait">
        <motion.div key={pos} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <Card className="p-5 rounded-2xl shadow-soft">
            <div className="text-xs font-semibold text-primary mb-2">{labelForType(q.type)}</div>
            <p className="text-lg font-medium leading-snug">{q.prompt}</p>
            {q.promptSindhi && <p className="sindhi text-xl mt-2" dir="rtl">{q.promptSindhi}</p>}
            {q.audio && q.type === "listening" && (
              <div className="mt-3 flex items-center gap-2">
                <AudioButton text={q.audio} accent="us" />
                <span className="text-sm text-muted-foreground">Tap to play again</span>
              </div>
            )}
            {q.hint && <p className="text-xs text-muted-foreground mt-2 italic">💡 {q.hint}</p>}
          </Card>

          {/* answers */}
          {q.options ? (
            <div className="grid gap-2 mt-3">
              {q.options.map((opt, i) => {
                const isPicked = picked === opt;
                const isCorrect = opt === q.answer;
                const reveal = picked !== null;
                return (
                  <motion.button
                    key={opt + i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    disabled={reveal}
                    onClick={() => submit(opt)}
                    className={cn(
                      "w-full text-left p-3.5 rounded-2xl border-2 font-medium flex items-center justify-between transition",
                      !reveal && "bg-card border-border hover:border-primary/40 active:scale-[0.99]",
                      reveal && isCorrect && "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500",
                      reveal && isPicked && !isCorrect && "bg-rose-50 dark:bg-rose-900/30 border-rose-500",
                      reveal && !isCorrect && !isPicked && "bg-card border-border opacity-60"
                    )}
                  >
                    <span className={cn(isCorrect && reveal && "text-emerald-700 dark:text-emerald-300", isPicked && !isCorrect && reveal && "text-rose-700 dark:text-rose-300")}>{opt}</span>
                    {reveal && isCorrect && <Check className="h-5 w-5 text-emerald-600" />}
                    {reveal && isPicked && !isCorrect && <X className="h-5 w-5 text-rose-600" />}
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(textAnswer); }}>
              <input
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                disabled={picked !== null}
                placeholder="Type your answer…"
                className="flex-1 h-12 px-4 rounded-2xl bg-card border border-border outline-none focus:border-primary"
                autoFocus
              />
              <Button type="submit" disabled={picked !== null || !textAnswer} className="rounded-2xl px-5">Check</Button>
            </form>
          )}

          {/* explanation */}
          <AnimatePresence>
            {picked !== null && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3">
                <Card className={cn("p-3 rounded-2xl text-sm", picked && checkAnswer(q, picked) ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200" : "bg-rose-50 dark:bg-rose-900/20 border-rose-200")}>
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    {checkAnswer(q, picked) ? <><Check className="h-4 w-4 text-emerald-600" /> Correct!</> : <><X className="h-4 w-4 text-rose-600" /> Not quite.</>}
                  </div>
                  <p className="text-muted-foreground">{q.explanation}</p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function labelForType(t: string) {
  const m: Record<string, string> = {
    meaning: "Meaning", sindhi_to_english: "Sindhi → English", english_to_sindhi: "English → Sindhi",
    past_form: "Past form", third_form: "Third form", fill_in: "Fill in the blank", sense: "Which sense?",
    listening: "Listening", spelling: "Spelling", match_pairs: "Match pairs", true_false: "True / False",
    odd_one_out: "Odd one out", error_correction: "Fix the sentence",
  };
  return m[t] || "Question";
}

function TimerRing({ seconds, max }: { seconds: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (seconds / max) * 100));
  const r = 10, c = 2 * Math.PI * r;
  const color = seconds <= 5 ? "#ef4444" : seconds <= 10 ? "#f59e0b" : "#10b981";
  return (
    <svg width={24} height={24} className="-rotate-90">
      <circle cx={12} cy={12} r={r} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-muted" />
      <circle cx={12} cy={12} r={r} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
    </svg>
  );
}

function ResultView({ results, title, examMode, violations, onRetry, onReviewMistakes, onBack }: {
  results: QuizResult[]; title: string; examMode: boolean; violations: number; onRetry: () => void; onReviewMistakes: () => void; onBack: () => void;
}) {
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  React.useEffect(() => {
    if (pct >= 80) {
      import("canvas-confetti").then((c) => c.default({ particleCount: 90, spread: 70, origin: { y: 0.6 } }));
    }
  }, [pct]);
  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-4">
      <div className="text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="inline-grid place-items-center h-24 w-24 rounded-full bg-primary/10 mb-3">
          <Trophy className="h-12 w-12 text-amber-500" />
        </motion.div>
        <h1 className="text-2xl font-bold">{title} — Result</h1>
        <p className="text-4xl font-bold mt-2">{pct}%</p>
        <p className="text-muted-foreground">{correct} of {total} correct</p>
        {examMode && violations > 0 && <p className="text-xs text-rose-500 mt-1">{violations} violation{violations > 1 ? "s" : ""} recorded</p>}
      </div>
      <Card className="p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-2"><span className="font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4" /> Review answers</span><span className="text-sm text-muted-foreground">{correct}/{total}</span></div>
        <div className="space-y-2 max-h-72 overflow-y-auto scroll-soft">
          {results.map((r, i) => (
            <div key={i} className={cn("p-2.5 rounded-xl text-sm border", r.correct ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800")}>
              <div className="flex items-start gap-2">
                {r.correct ? <Check className="h-4 w-4 text-emerald-600 mt-0.5" /> : <X className="h-4 w-4 text-rose-600 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{labelForType(r.q.type)}</div>
                  <div className="font-medium truncate">{r.q.prompt}</div>
                  {!r.correct && (
                    <div className="mt-1 text-xs">
                      <span className="text-rose-600">Your answer: {r.userAnswer || "(none)"}</span>
                      <span className="text-emerald-600 ml-2">Correct: {r.q.answer}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex gap-2">
        <Button onClick={onBack} variant="outline" className="flex-1 rounded-2xl">Back</Button>
        <Button onClick={onReviewMistakes} variant="outline" className="flex-1 rounded-2xl" disabled={correct === total}>Mistakes only</Button>
        <Button onClick={onRetry} className="flex-1 rounded-2xl"><RotateCcw className="h-4 w-4" /> Retry</Button>
      </div>
    </div>
  );
}
