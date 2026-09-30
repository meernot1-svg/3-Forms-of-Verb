"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Mic, Clock, AlertCircle, Check, X, Trophy, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isSpeechRecognitionSupported, createRecognition, normalizeTranscript, fuzzyMatchAnswer, speak } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Q {
  type: "forms" | "sindhi_to_english" | "english_to_sindhi" | "free_sentence" | "sense" | "repeat";
  verbId: string;
  prompt: string;
  expected: string[];
  audio?: string;
}

export function OralTestView() {
  const verbs = useStore((s) => s.verbs);
  const srs = useStore((s) => s.srs);
  const setView = useStore((s) => s.setView);
  const supported = React.useMemo(() => isSpeechRecognitionSupported(), []);
  const [started, setStarted] = React.useState(false);
  const [micOk, setMicOk] = React.useState<boolean | null>(null);
  const [phase, setPhase] = React.useState<"intro" | "mic" | "test" | "result">("intro");
  const [questions, setQuestions] = React.useState<Q[]>([]);
  const [pos, setPos] = React.useState(0);
  const [totalTime, setTotalTime] = React.useState(600);
  const [perQTime, setPerQTime] = React.useState(20);
  const [recording, setRecording] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [results, setResults] = React.useState<{ q: Q; transcript: string; correct: boolean; confidence: number }[]>([]);
  const [violations, setViolations] = React.useState(0);

  // build questions prioritising weak + irregular + multi-sense words
  function buildQuestions(n: number): Q[] {
    const weak = Object.values(srs).filter((r) => r.leeched || r.status === "review").map((r) => r.id);
    const irregular = verbs.filter((v) => v.additional_info.irregular).map((v) => v.id);
    const prio = new Set<string>([...weak, ...irregular]);
    const pool = verbs.filter((v) => prio.has(v.id)).concat(verbs);
    const seen = new Set<string>();
    const qs: Q[] = [];
    for (const v of pool) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      const types: Q["type"][] = ["forms", "sindhi_to_english", "repeat"];
      const t = types[qs.length % types.length];
      const bd = v.book_data;
      let prompt = "", expected: string[] = [], audio: string | undefined;
      if (t === "forms") { prompt = `Say the 2nd and 3rd form of "${bd.first_form}".`; expected = [`${bd.second_form} ${bd.third_form}`, `${bd.second_form}, ${bd.third_form}`]; audio = bd.first_form; }
      if (t === "sindhi_to_english") { prompt = `Say the English verb that means: ${bd.sindhi_meaning}`; expected = [bd.first_form]; }
      if (t === "repeat") { prompt = `Repeat after me.`; expected = [bd.first_form]; audio = bd.first_form; }
      qs.push({ type: t, verbId: v.id, prompt, expected, audio });
      if (qs.length >= n) break;
    }
    return qs;
  }

  function start(n: number) {
    setQuestions(buildQuestions(n));
    setPos(0); setResults([]); setStarted(true); setPhase("mic");
  }
  function beginTest() {
    setPhase("test");
    setTotalTime(600);
    setPerQTime(20);
  }
  // exam-mode lock
  React.useEffect(() => {
    if (phase !== "test") return;
    const onPop = (e: PopStateEvent) => { e.preventDefault(); window.history.pushState(null, "", window.location.href); toast("Test in progress — tap Quit to end."); };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPop);
    const onVis = () => { if (document.hidden) { setViolations((v) => v + 1); toast.warning("Leaving the app counts as a violation."); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("popstate", onPop); document.removeEventListener("visibilitychange", onVis); };
  }, [phase]);

  // timers
  React.useEffect(() => {
    if (phase !== "test") return;
    if (totalTime <= 0) { setPhase("result"); return; }
    const t = setTimeout(() => setTotalTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, totalTime]);

  // advance + submit/skip as callbacks; refs for the timer effect
  const skipRef = React.useRef<() => void>(() => {});
  const advance = React.useCallback(() => {
    setPerQTime(20);
    if (pos + 1 < questions.length) setPos((p) => p + 1);
    else setPhase("result");
  }, [pos, questions.length]);
  const submit = React.useCallback((text: string) => {
    const q = questions[pos];
    if (!q) return;
    const m = fuzzyMatchAnswer(text, q.expected);
    setResults((r) => [...r, { q, transcript: text, correct: m.match, confidence: m.confidence }]);
    setTranscript("");
    advance();
  }, [questions, pos, advance]);
  const skipQuestion = React.useCallback(() => {
    const q = questions[pos];
    if (!q) return;
    setResults((r) => [...r, { q, transcript: "", correct: false, confidence: 0 }]);
    advance();
  }, [questions, pos, advance]);
  React.useEffect(() => { skipRef.current = skipQuestion; }, [skipQuestion]);

  React.useEffect(() => {
    if (phase !== "test" || recording) return;
    if (perQTime <= 0) { skipRef.current(); return; }
    const t = setTimeout(() => setPerQTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, perQTime, recording]);

  // mic test
  async function testMic() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicOk(true);
      setTimeout(beginTest, 600);
    } catch {
      setMicOk(false);
      toast.error("Microphone permission denied. You can still type answers as a fallback.");
    }
  }

  function listen() {
    const rec = createRecognition("us");
    if (!rec) return;
    setRecording(true);
    setTranscript("");
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setTranscript(txt);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => { setRecording(false); };
    rec.start();
  }
  function stopAndSubmit() {
    setRecording(false);
    submit(transcript);
  }

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl px-3 py-3 space-y-3 exam-mode">
        <header className="flex items-center gap-2">
          <button onClick={() => setView("more")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted"><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="text-2xl font-bold">Daily Oral Test</h1>
        </header>
        <Card className="p-5 rounded-2xl shadow-soft">
          <div className="flex items-center gap-2 mb-2"><Lock className="h-5 w-5 text-rose-500" /><h2 className="font-bold">Exam Mode</h2></div>
          <p className="text-sm text-muted-foreground mb-3">Hard, timed, once per day for XP. The app hides navigation and locks everything inside it during the test. <strong>The app cannot lock your phone's Home button or other apps</strong> — to fully lock the device, use Android's "Screen pinning" (Settings → Security → Screen pinning).</p>
          <ul className="text-sm space-y-1 mb-4">
            <li>• Difficulty: HARD (weak words, irregular verbs, multi-sense)</li>
            <li>• Overall timer: 10 minutes · per-question: 20 seconds</li>
            <li>• Voice answers graded by speech recognition</li>
            <li>• 2 violations = test ended</li>
          </ul>
          {!supported && (
            <Card className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 mb-3">
              <div className="flex items-center gap-2 text-sm"><AlertCircle className="h-4 w-4 text-amber-500" /> Speech recognition isn't supported here (try Chrome). You can type answers as a fallback.</div>
            </Card>
          )}
          <div className="flex gap-2 flex-wrap">
            {[5, 10, 15, 20].map((n) => <Button key={n} onClick={() => start(n)} className="rounded-xl flex-1">{n} questions</Button>)}
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "mic") {
    return (
      <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
        <h1 className="text-2xl font-bold">Test your microphone</h1>
        <Card className="p-5 rounded-2xl shadow-soft text-center">
          <Mic className={cn("h-16 w-16 mx-auto mb-3", micOk === false ? "text-rose-500" : "text-primary")} />
          <p className="text-sm text-muted-foreground mb-4">Tap below and allow microphone access. Say a few words — we'll detect your audio level.</p>
          <Button onClick={testMic} className="rounded-2xl"><Mic className="h-5 w-5" /> Test microphone</Button>
          {micOk === true && <p className="text-emerald-600 font-semibold mt-3">✅ Microphone ready! Starting test…</p>}
          {micOk === false && <p className="text-rose-600 mt-3 text-sm">Mic blocked — you'll type answers instead. Tap to continue.</p>}
          {micOk === false && <Button onClick={beginTest} variant="outline" className="mt-3 rounded-xl">Continue with typed answers</Button>}
        </Card>
      </div>
    );
  }

  if (phase === "result") {
    const correct = results.filter((r) => r.correct).length;
    const pct = results.length ? Math.round((correct / results.length) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
        <h1 className="text-2xl font-bold">Oral Test Result</h1>
        <Card className="p-6 rounded-2xl shadow-soft text-center">
          <Trophy className="h-12 w-12 mx-auto text-amber-500 mb-2" />
          <p className="text-4xl font-bold">{pct}%</p>
          <p className="text-muted-foreground">{correct} of {results.length} correct</p>
          {violations > 0 && <p className="text-xs text-rose-500 mt-1">{violations} violation{violations > 1 ? "s" : ""}</p>}
        </Card>
        <Card className="p-4 rounded-2xl shadow-soft">
          <h2 className="font-semibold mb-2">Transcript breakdown</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto scroll-soft">
            {results.map((r, i) => (
              <div key={i} className={cn("p-2.5 rounded-xl text-sm border", r.correct ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200" : "bg-rose-50 dark:bg-rose-900/20 border-rose-200")}>
                <div className="flex items-center gap-2"><span>{r.correct ? "✅" : "❌"}</span><span className="font-medium flex-1">{r.q.prompt}</span></div>
                <p className="text-xs mt-1">Heard: "{r.transcript || "(nothing)"}"</p>
                <p className="text-xs">Expected: {r.q.expected.join(" / ")}</p>
                <p className="text-[10px] text-muted-foreground mt-1">confidence: {Math.round(r.confidence * 100)}%</p>
              </div>
            ))}
          </div>
        </Card>
        <Button onClick={() => setView("more")} className="w-full rounded-2xl">Done</Button>
      </div>
    );
  }

  // test phase
  const q = questions[pos];
  if (violations >= 2) {
    setPhase("result");
  }
  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3 exam-mode select-none">
      <header className="flex items-center justify-between">
        <h1 className="font-bold">Oral Test · Q{pos + 1}/{questions.length}</h1>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold tabular-nums", totalTime <= 60 ? "text-rose-500" : "")}>⏱ {Math.floor(totalTime / 60)}:{String(totalTime % 60).padStart(2, "0")}</span>
          <span className={cn("text-sm font-bold tabular-nums", perQTime <= 5 ? "text-rose-500" : "")}>· {perQTime}s</span>
          {violations > 0 && <span className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">⚠ {violations}</span>}
        </div>
      </header>
      <Button onClick={() => { if (confirm("Quit test? Marked incomplete.")) setPhase("result"); }} variant="destructive" size="sm" className="rounded-xl">Quit test</Button>

      <AnimatePresence mode="wait">
        <motion.div key={pos} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
          <Card className="p-5 rounded-2xl shadow-soft">
            <p className="text-xs font-semibold text-primary mb-1">{labelFor(q.type)}</p>
            <p className="text-lg font-medium">{q.prompt}</p>
            {q.audio && <Button onClick={() => speak(q.audio!, { accent: "us" })} variant="outline" size="sm" className="mt-2 rounded-xl">🔊 Play audio</Button>}
          </Card>
        </motion.div>
      </AnimatePresence>

      <Card className="p-4 rounded-2xl shadow-soft">
        {supported ? (
          <>
            <div className="flex items-center justify-center gap-3 mb-3">
              <Button onClick={recording ? stopAndSubmit : listen} className={cn("rounded-2xl h-14 px-6", recording && "bg-rose-500 hover:bg-rose-600")}>
                <Mic className={cn("h-6 w-6", recording && "animate-pulse")} /> {recording ? "Stop & submit" : "Speak answer"}
              </Button>
            </div>
            {transcript && <p className="text-center text-sm">Heard: <span className="font-semibold">{transcript}</span></p>}
          </>
        ) : (
          <TypeFallback onSubmit={(t) => submit(t)} expectedHint={q.expected[0]} />
        )}
      </Card>
      <div className="flex gap-2">
        <Button onClick={skipQuestion} variant="ghost" className="rounded-xl flex-1">Skip (mark wrong)</Button>
        {supported && <Button onClick={() => submit(transcript)} disabled={!transcript} className="rounded-xl flex-1">Submit</Button>}
      </div>
      <p className="text-center text-xs text-muted-foreground">🔇 Please answer by voice. Wrong answers go to your Review list automatically.</p>
    </div>
  );
}

function labelFor(t: Q["type"]) {
  return { forms: "Say the 2nd & 3rd form", sindhi_to_english: "Sindhi → English", english_to_sindhi: "English → Sindhi", free_sentence: "Use it in a sentence", sense: "Which sense?", repeat: "Repeat after me" }[t];
}

function TypeFallback({ onSubmit, expectedHint }: { onSubmit: (t: string) => void; expectedHint: string }) {
  const [v, setV] = React.useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); setV(""); }} className="flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Type your answer…" className="flex-1 h-12 px-4 rounded-2xl bg-card border border-border outline-none focus:border-primary" autoFocus />
      <Button type="submit" disabled={!v} className="rounded-2xl">Submit</Button>
    </form>
  );
}
