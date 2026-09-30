"use client";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Star, RotateCcw, Mic, ClipboardList, Settings, Search, Volume2, Layers, BookOpen, Calendar, Award, Download, Upload, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as React from "react";

const ITEMS = [
  { id: "favorites", icon: Star, label: "Favorites", desc: "Your favorite words", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300" },
  { id: "review", icon: RotateCcw, label: "Review list", desc: "Words to practice", color: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300" },
  { id: "pronunciation", icon: Volume2, label: "Pronunciation", desc: "UK / US / slow", color: "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300" },
  { id: "oraltest", icon: Mic, label: "Daily Oral Test", desc: "Speak & grade", color: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300" },
  { id: "customtests", icon: ClipboardList, label: "Custom Tests", desc: "Build your own", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300" },
  { id: "search", icon: Search, label: "Search", desc: "Find any verb", color: "bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300" },
  { id: "flashcards", icon: Layers, label: "Flashcards", desc: "Swipe & flip", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300" },
  { id: "daily", icon: Calendar, label: "Today's Lesson", desc: "Guided study", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300" },
] as const;

export function MoreView() {
  const setView = useStore((s) => s.setView);
  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-4">
      <h1 className="text-2xl font-bold">More</h1>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => setView(it.id)} className="rounded-2xl bg-card border border-border p-4 text-left flex items-center gap-3 shadow-soft hover:shadow-md transition active:scale-98">
              <div className={`grid place-items-center h-11 w-11 rounded-xl ${it.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold leading-tight">{it.label}</div>
                <div className="text-xs text-muted-foreground truncate">{it.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* badges preview */}
      <Card className="p-4 rounded-2xl shadow-soft">
        <h2 className="font-semibold flex items-center gap-2 mb-2"><Award className="h-4 w-4 text-amber-500" /> Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge emoji="🌱" name="First 10 Words" />
          <Badge emoji="🔥" name="7-day streak" />
          <Badge emoji="🏆" name="Chapter Master" />
          <Badge emoji="🎓" name="Verb Master" />
          <Badge emoji="🎤" name="Pronunciation Pro" />
          <Badge emoji="⚡" name="Irregular Expert" />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Earn badges as you learn — all stored on your device.</p>
      </Card>

      <Button onClick={() => setView("settings")} variant="outline" className="w-full rounded-2xl h-12"><Settings className="h-5 w-5" /> Settings</Button>
      <p className="text-center text-xs text-muted-foreground">VerbMaster v1.0 · Data stays on your device · Made for Sindhi-speaking students</p>
    </div>
  );
}

function Badge({ emoji, name }: { emoji: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-muted">
      <span>{emoji}</span> <span className="font-medium">{name}</span>
    </div>
  );
}
