"use client";
import * as React from "react";
import { ChevronLeft, Mic, Volume2, AlertCircle, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudioButton } from "@/components/verbs/audio-button";
import { speak, isSpeechSupported, isSpeechRecognitionSupported, createRecognition, hasVoice, listVoices, voicesByLang, fuzzyMatchAnswer } from "@/lib/audio";
import { cn } from "@/lib/utils";

// minimal pairs that Sindhi speakers often find hard
const MIN_PAIRS = [
  { pair: ["ship", "sheep"], note: "short i vs long ee" },
  { pair: ["cap", "cab"], note: "voiceless p vs voiced b" },
  { pair: ["think", "sink"], note: "" },
  { pair: ["bad", "bed"], note: "a vs e" },
  { pair: ["walk", "work"], note: "l vs r" },
  { pair: ["chose", "choose"], note: "past vs present (homophones-ish)" },
];

export function PronunciationView() {
  const verbs = useStore((s) => s.verbs);
  const setView = useStore((s) => s.setView);
  const supported = React.useMemo(() => isSpeechSupported(), []);
  const recSupported = React.useMemo(() => isSpeechRecognitionSupported(), []);
  const [voices, setVoices] = React.useState<{ uk: number; us: number }>({ uk: 0, us: 0 });
  const [recording, setRecording] = React.useState(false);
  const [heard, setHeard] = React.useState("");
  const [score, setScore] = React.useState<number | null>(null);
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    const update = () => {
      const { uk, us } = voicesByLang();
      setVoices({ uk: uk.length, us: us.length });
    };
    update();
    const synth = window.speechSynthesis;
    if (synth) synth.addEventListener("voiceschanged", update);
    return () => { if (synth) synth.removeEventListener("voiceschanged", update); };
  }, []);

  // a few practice words from the book
  const practiceWords = React.useMemo(() => verbs.filter((v) => v.additional_info.irregular).slice(0, 8), [verbs]);
  const word = practiceWords[current]?.book_data.first_form;

  function repeatAfterMe() {
    if (!word || !recSupported) return;
    speak(word, { accent: "us", onend: () => startListening() });
  }
  function startListening() {
    if (!recSupported) return;
    const rec = createRecognition("us");
    if (!rec) return;
    setRecording(true);
    setHeard("");
    setScore(null);
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setHeard(txt);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => {
      setRecording(false);
      // score against the word
      const m = fuzzyMatchAnswer(heard || word, [word]);
      setScore(Math.round((m.confidence || 0) * 100));
    };
    rec.start();
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <header className="flex items-center gap-2">
        <button onClick={() => setView("more")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Back"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold">Pronunciation Trainer</h1>
      </header>

      {!supported && (
        <Card className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5 text-amber-500" /> Audio not supported</div>
          <p className="text-sm text-muted-foreground mt-1">Your browser doesn't support speech synthesis. Try Chrome or Edge for the full experience.</p>
        </Card>
      )}
      {supported && (voices.uk === 0 || voices.us === 0) && (
        <Card className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5 text-amber-500" /> Voice not installed</div>
          <p className="text-sm text-muted-foreground mt-1">
            {voices.uk === 0 && voices.us === 0 ? "No English voices found on this device." : (voices.uk === 0 ? "British (en-GB)" : "American (en-US)") + " voice is missing. The app will use the default voice as a fallback."}
          </p>
        </Card>
      )}

      {/* voices status */}
      <Card className="p-4 rounded-2xl shadow-soft">
        <h2 className="font-semibold mb-2">Available voices</h2>
        <div className="flex gap-2 text-sm">
          <span className={cn("px-3 py-1.5 rounded-full", voices.uk ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>🇬🇧 UK: {voices.uk}</span>
          <span className={cn("px-3 py-1.5 rounded-full", voices.us ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>🇺🇸 US: {voices.us}</span>
        </div>
      </Card>

      {/* repeat after me */}
      {word && (
        <Card className="p-4 rounded-2xl shadow-soft">
          <h2 className="font-semibold mb-1">🐢 Repeat after me</h2>
          <p className="text-sm text-muted-foreground mb-3">Listen, then say the word out loud. {recSupported ? "We'll grade your pronunciation." : "Speech recognition isn't supported on this browser — practice by ear."}</p>
          <div className="flex items-center justify-center gap-3 py-3">
            <span className="text-3xl font-bold">{word}</span>
            <AudioButton text={word} accent="us" />
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={repeatAfterMe} disabled={!recSupported || recording} className="rounded-xl">
              <Mic className={cn("h-4 w-4", recording && "animate-pulse")} /> {recording ? "Listening…" : "Repeat after me"}
            </Button>
            <Button onClick={() => setCurrent((c) => (c + 1) % Math.max(1, practiceWords.length))} variant="outline" className="rounded-xl">Next word</Button>
          </div>
          {heard && <p className="text-center text-sm mt-3">Heard: <span className="font-semibold">{heard}</span></p>}
          {score !== null && (
            <div className="text-center mt-2">
              <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold", score >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                {score >= 70 ? <Check className="h-4 w-4" /> : null} Match: {score}%
              </div>
            </div>
          )}
        </Card>
      )}

      {/* minimal pairs */}
      <Card className="p-4 rounded-2xl shadow-soft">
        <h2 className="font-semibold mb-2">Minimal pairs (sounds Sindhi speakers find hard)</h2>
        <div className="space-y-2">
          {MIN_PAIRS.map((mp, i) => {
            const [a, b] = mp.pair;
            return (
              <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-muted/40">
                <span className="flex-1 font-semibold">{a}</span>
                <AudioButton text={a} accent="uk" size="sm" />
                <AudioButton text={a} accent="us" size="sm" />
                <span className="text-muted-foreground">vs</span>
                <AudioButton text={b} accent="uk" size="sm" />
                <AudioButton text={b} accent="us" size="sm" />
                <span className="flex-1 font-semibold text-right">{b}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* listening quiz */}
      <Card className="p-4 rounded-2xl shadow-soft">
        <h2 className="font-semibold mb-2">Which word did you hear?</h2>
        <ListeningQuiz verbs={verbs} />
      </Card>
    </div>
  );
}

function makeRound(verbs: any[]) {
  const pool = verbs.filter((v) => v.additional_info.irregular);
  const pick = pool.length >= 3 ? pool : verbs;
  const opts = pick.sort(() => Math.random() - 0.5).slice(0, 3);
  const answer = opts[Math.floor(Math.random() * opts.length)];
  return { opts, answer, picked: null as string | null };
}

function ListeningQuiz({ verbs }: { verbs: any[] }) {
  const [round, setRound] = React.useState(() => makeRound(verbs));
  React.useEffect(() => { setRound(makeRound(verbs)); }, [verbs]);
  function play() { speak(round.answer.book_data.first_form, { accent: "us" }); }
  function choose(w: string) {
    setRound((r) => ({ ...r, picked: w }));
  }
  return (
    <div>
      <div className="flex items-center justify-center gap-2 py-2">
        <Button onClick={play} variant="outline" className="rounded-xl"><Volume2 className="h-4 w-4" /> Play word</Button>
        <Button onClick={() => setRound(makeRound())} size="sm" className="rounded-xl">New word</Button>
      </div>
      <div className="grid grid-cols-1 gap-2 mt-2">
        {round.opts.map((o) => {
          const correct = o.id === round.answer.id;
          const reveal = round.picked !== null;
          return (
            <button key={o.id} disabled={reveal} onClick={() => choose(o.id)} className={cn("p-3 rounded-xl border-2 text-left", reveal && correct ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30" : reveal && round.picked === o.id && !correct ? "border-rose-500 bg-rose-50 dark:bg-rose-900/30" : "border-border bg-card")}>
              {o.book_data.first_form} — <span className="sindhi text-sm" dir="rtl">{o.book_data.sindhi_meaning}</span>
            </button>
          );
        })}
      </div>
      {round.picked && (
        <p className="text-center text-sm mt-2">{round.picked === round.answer.book_data.first_form || round.opts.find(o => o.id === round.picked)?.id === round.answer.id ? "✅ Correct!" : `❌ The word was "${round.answer.book_data.first_form}"`}</p>
      )}
    </div>
  );
}
