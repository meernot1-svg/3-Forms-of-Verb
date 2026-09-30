"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function TopSearchBar() {
  const setView = useStore((s) => s.setView);
  const [q, setQ] = React.useState("");
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border safe-top">
      <div className="mx-auto max-w-2xl px-3 py-2.5 flex items-center gap-2">
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-2 font-bold text-primary text-lg shrink-0"
          aria-label="VerbMaster home"
        >
          <span aria-hidden className="grid place-items-center h-8 w-8 rounded-xl bg-primary text-primary-foreground font-bold">V</span>
          <span className="hidden sm:inline">VerbMaster</span>
        </button>
        <button
          onClick={() => setView("search")}
          className="flex-1 flex items-center gap-2 h-10 px-3 rounded-full bg-muted text-muted-foreground text-sm"
          aria-label="Search verbs"
        >
          <Search className="h-4 w-4" />
          <span className="truncate">Search verbs, forms, Sindhi…</span>
        </button>
      </div>
    </header>
  );
}
