"use client";
import * as React from "react";
import { Home, BookOpen, Layers, BarChart3, Menu } from "lucide-react";
import { useStore, type View } from "@/lib/store";
import { motion } from "framer-motion";

const TABS: { id: View; label: string; icon: React.ComponentType<any> }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "chapters", label: "Chapters", icon: BookOpen },
  { id: "flashcards", label: "Practice", icon: Layers },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "more", label: "More", icon: Menu },
];

export function BottomTabs() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const active = TABS.find((t) => t.id === view)?.id || deriveView(view);

  function onClick(id: View) {
    if (id === "more") {
      setView("more");
      return;
    }
    setView(id);
  }

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur border-t border-border safe-bottom"
    >
      <div className="mx-auto max-w-2xl grid grid-cols-5">
        {TABS.map((t) => {
          const isActive = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onClick(t.id)}
              className="relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-h-[56px] text-xs font-medium"
              aria-current={isActive ? "page" : undefined}
              aria-label={t.label}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-px h-1 w-10 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon
                className={`h-5 w-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span className={isActive ? "text-primary" : "text-muted-foreground"}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function deriveView(v: View): View {
  // map sub-views to a tab highlight
  if (v === "chapter" || v === "word") return "chapters";
  if (v === "quiz" || v === "flashcards" || v === "pronunciation" || v === "oraltest") return "flashcards";
  if (v === "favorites" || v === "review" || v === "search" || v === "settings" || v === "customtests" || v === "more" || v === "daily") return "more";
  return v;
}
