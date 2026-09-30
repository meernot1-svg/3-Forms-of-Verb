"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, Mic, Target, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const SCREENS = [
  { icon: "🐾", title: "Meet Verbie", body: "Hi! I'm Verbie, your friendly English-verbs teacher. I'll guide your lessons, answer questions, and cheer you on. I work offline — no internet needed." },
  { icon: "📕", title: "From the Book — accurate", body: "Verb forms and Sindhi meanings come straight from your source book. They're labelled 📕 From the Book and never changed. Extra help is clearly labelled ✨ Additional info." },
  { icon: "🎯", title: "Learn smarter, not harder", body: "Daily lessons, spaced repetition, flashcards, quizzes, pronunciation, and a timed oral test. The app resurfaces words you find hard — and celebrates every win." },
  { icon: "📶", title: "Works offline", body: "Install it to your home screen. After the first load, everything works offline: verbs, audio (via your device voice), quizzes, even your AI helper Verbie." },
];

export function OnboardingView() {
  const [i, setI] = React.useState(0);
  const setView = useStore((s) => s.setView);
  const last = i === SCREENS.length - 1;
  return (
    <div className="min-h-screen grid place-items-center mesh-bg p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center gap-1.5 mb-6">
          {SCREENS.map((_, idx) => <div key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />)}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
            <Card className="p-8 rounded-3xl shadow-soft text-center">
              <div className="text-7xl mb-4">{SCREENS[i].icon}</div>
              <h1 className="text-2xl font-bold mb-2">{SCREENS[i].title}</h1>
              <p className="text-muted-foreground">{SCREENS[i].body}</p>
            </Card>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-2 mt-6">
          {i > 0 && <Button onClick={() => setI((x) => x - 1)} variant="outline" className="rounded-2xl">Back</Button>}
          {last ? (
            <Button onClick={() => setView("home")} className="flex-1 rounded-2xl h-12"><Target className="h-5 w-5" /> Start learning</Button>
          ) : (
            <Button onClick={() => setI((x) => x + 1)} className="flex-1 rounded-2xl h-12">Next <ArrowRight className="h-5 w-5" /></Button>
          )}
        </div>
        {!last && <button onClick={() => setView("home")} className="w-full text-center text-sm text-muted-foreground mt-3">Skip</button>}
      </div>
    </div>
  );
}
