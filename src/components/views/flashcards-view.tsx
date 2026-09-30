"use client";
import * as React from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { RotateCcw, Check, X, Undo2, Volume2, Eye } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AudioButton } from "@/components/verbs/audio-button";
import { speak } from "@/lib/audio";
import type { Verb } from "@/lib/types";

type CardMode = "english" | "sindhi" | "audio";

export function FlashcardsView() {
  const verbs = useStore((s) => s.verbs);
  const srs = useStore((s) => s.srs);
  const ensureSrs = useStore((s) => s.ensureSrs);
  const recordAnswer = useStore((s) => s.recordAnswer);
  const setView = useStore((s) => s.setView);
  const [mode, setMode] = React.useState<CardMode>("english");
  const [flipped, setFlipped] = React.useState(false);
  const [history, setHistory] = React.useState<{ verb: Verb; correct: boolean }[]>([]);
  const [stats, setStats] = React.useState({ know: 0, dont: 0 });

  // weighted deck: frequently-missed words appear more often
  const deck = React.useMemo(() => {
    const weighted: Verb[] = [];
    for (const v of verbs) {
      const r = srs[v.id];
      let weight = 1;
      if (r) weight = 1 + Math.min(4, r.wrong);
      for (let i = 0; i < weight; i++) weighted.push(v);
    }
    // shuffle
    for (let i = weighted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
    }
    return weighted.slice(0, 40);
  }, [verbs, srs]);

  const [pos, setPos] = React.useState(0);
  const [exit, setExit] = React.useState<"know" | "dont" | null>(null);

  const card = deck[pos];

  React.useEffect(() => {
    if (pos >= deck.length) return;
    setFlipped(false);
    setExit(null);
    if (mode === "audio" && card) {
      setTimeout(() => speak(card.book_data.first_form, { accent: "us" }), 300);
    }
  }, [pos, mode, card]);

  if (deck.length === 0 || pos >= deck.length) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
        <Header onMore={() => setView("more")} />
        <div className="text-center py-16">
          <div className="text-6xl mb-3">🎴</div>
          <h2 className="font-bold text-xl">Session complete!</h2>
          <p className="text-muted-foreground">You reviewed {deck.length} cards. Know: {stats.know} · Don't know: {stats.dont}</p>
          <Button onClick={() => { setPos(0); setStats({ know: 0, dont: 0 }); setHistory([]); }} className="mt-4 rounded-xl">Start again</Button>
        </div>
      </div>
    );
  }

  function onDragEnd(_: any, info: PanInfo) {
    if (info.offset.x > 80) swipe("know");
    else if (info.offset.x < -80) swipe("dont");
  }
  async function swipe(res: "know" | "dont") {
    if (!card) return;
    setExit(res);
    await ensureSrs(card.id);
    await recordAnswer(card.id, res === "know");
    setStats((s) => ({ know: s.know + (res === "know" ? 1 : 0), dont: s.dont + (res === "dont" ? 1 : 0) }));
    setHistory((h) => [...h, { verb: card, correct: res === "know" }]);
    setTimeout(() => { setPos((p) => p + 1); }, 220);
  }
  function undo() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setStats((s) => ({ know: s.know - (last.correct ? 1 : 0), dont: s.dont - (last.correct ? 0 : 1) }));
    setPos((p) => Math.max(0, p - 1));
  }

  const bd = card.book_data;
  const ai = card.additional_info;

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <Header onMore={() => setView("more")} />
      <div className="flex items-center justify-center gap-2 text-xs">
        <span className="text-muted-foreground">Mode:</span>
        {(["english", "sindhi", "audio"] as CardMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-full ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            {m === "english" ? "English" : m === "sindhi" ? "Sindhi" : "Audio"}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Card {pos + 1} / {deck.length}</span>
        <button onClick={undo} disabled={history.length === 0} className="flex items-center gap-1 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
      </div>

      <div className="relative h-[60vh] flex items-center justify-center">
        <AnimatePresence>
          <motion.div
            key={card.id + pos}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={onDragEnd}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, x: exit === "know" ? 300 : exit === "dont" ? -300 : 0, rotate: exit === "know" ? 12 : exit === "dont" ? -12 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={() => setFlipped((f) => !f)}
            className="relative w-full max-w-sm aspect-[3/4] cursor-pointer"
            style={{ perspective: 1200 }}
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5 }}
              className="relative w-full h-full"
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* front */}
              <div className="absolute inset-0 rounded-3xl bg-card border border-border shadow-soft grid place-items-center p-6 text-center" style={{ backfaceVisibility: "hidden" }}>
                {mode === "audio" ? (
                  <div className="flex flex-col items-center gap-4">
                    <Volume2 className="h-16 w-16 text-primary" />
                    <p className="text-muted-foreground">Tap to listen, then say the meaning</p>
                    <Button variant="outline" onClick={(e) => { e.stopPropagation(); speak(bd.first_form, { accent: "us" }); }}>🔊 Play again</Button>
                  </div>
                ) : mode === "sindhi" ? (
                  <div>
                    <p className="sindhi text-3xl leading-relaxed" dir="rtl">{bd.sindhi_meaning}</p>
                    <p className="text-xs text-muted-foreground mt-4">Tap to flip</p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-4xl font-bold">{bd.first_form}</h2>
                    <p className="text-sm text-muted-foreground mt-2">Tap to flip · swipe ← don't know, → know</p>
                    {ai.irregular && <span className="inline-block mt-3 text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-2 py-1 rounded">🔴 IRREGULAR</span>}
                  </div>
                )}
              </div>
              {/* back */}
              <div className="absolute inset-0 rounded-3xl bg-primary/5 border border-primary/30 shadow-soft grid place-items-center p-6 text-center" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <div className="w-full">
                  <h2 className="text-2xl font-bold">{bd.first_form}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{bd.first_form} → {bd.second_form} → {bd.third_form}</p>
                  <p className="sindhi text-xl mt-2" dir="rtl">{bd.sindhi_meaning}</p>
                  {ai.examples.easy && <p className="text-xs italic mt-3">"{ai.examples.easy}"</p>}
                  <div className="flex justify-center gap-2 mt-3">
                    <AudioButton text={bd.first_form} accent="us" size="sm" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* action bar */}
      <div className="flex items-center gap-2">
        <Button onClick={() => swipe("dont")} variant="outline" className="flex-1 rounded-2xl h-12 text-rose-600 border-rose-200 dark:border-rose-900">
          <X className="h-5 w-5" /> Don't know
        </Button>
        <Button onClick={() => setFlipped((f) => !f)} variant="outline" className="rounded-2xl h-12 px-4">
          <Eye className="h-5 w-5" /> Flip
        </Button>
        <Button onClick={() => swipe("know")} className="flex-1 rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700">
          <Check className="h-5 w-5" /> Know
        </Button>
      </div>
    </div>
  );
}

function Header({ onMore }: { onMore: () => void }) {
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">Flashcards</h1>
      <button onClick={onMore} className="text-sm text-primary">More ▸</button>
    </header>
  );
}
