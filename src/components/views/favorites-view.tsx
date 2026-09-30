"use client";
import * as React from "react";
import { ChevronLeft, Star } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { AudioButton } from "@/components/verbs/audio-button";

export function FavoritesView() {
  const verbs = useStore((s) => s.verbs);
  const favorites = useStore((s) => s.favorites);
  const openWord = useStore((s) => s.openWord);
  const setView = useStore((s) => s.setView);
  const list = verbs.filter((v) => favorites.has(v.id));
  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <header className="flex items-center gap-2">
        <button onClick={() => setView("more")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Back"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold">My Favorite Words</h1>
      </header>
      {list.length === 0 ? (
        <Card className="p-8 text-center rounded-2xl">
          <Star className="h-12 w-12 mx-auto text-amber-300 mb-2" />
          <p className="text-muted-foreground">No favorites yet. Tap the ⭐ on any word to save it here.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((v) => (
            <button key={v.id} onClick={() => openWord(v.id)} className="w-full text-left rounded-2xl bg-card border border-border p-3 flex items-center gap-3 shadow-soft hover:shadow-md transition">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{v.book_data.first_form}</div>
                <p className="text-xs text-muted-foreground">{v.book_data.first_form} → {v.book_data.second_form} → {v.book_data.third_form}</p>
                <p className="sindhi text-sm truncate" dir="rtl">{v.book_data.sindhi_meaning}</p>
              </div>
              <AudioButton text={v.book_data.first_form} accent="us" size="sm" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
