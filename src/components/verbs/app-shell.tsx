"use client";
// Main app shell — loads data, applies theme/animations/large-text classes,
// renders the active view, and shows the bottom tab bar + Verbie floating button.

import * as React from "react";
import { useStore } from "@/lib/store";
import { BottomTabs } from "@/components/verbs/bottom-tabs";
import { Verbie } from "@/components/verbs/verbie";
import { HomeView } from "@/components/views/home-view";
import { ChaptersView } from "@/components/views/chapters-view";
import { ChapterView } from "@/components/views/chapter-view";
import { WordView } from "@/components/views/word-view";
import { FlashcardsView } from "@/components/views/flashcards-view";
import { QuizView } from "@/components/views/quiz-view";
import { ProgressView } from "@/components/views/progress-view";
import { MoreView } from "@/components/views/more-view";
import { SearchView } from "@/components/views/search-view";
import { PronunciationView } from "@/components/views/pronunciation-view";
import { OralTestView } from "@/components/views/oral-test-view";
import { CustomTestsView } from "@/components/views/custom-tests-view";
import { FavoritesView } from "@/components/views/favorites-view";
import { ReviewView } from "@/components/views/review-view";
import { DailyLessonView } from "@/components/views/daily-lesson-view";
import { SettingsView } from "@/components/views/settings-view";
import { OnboardingView } from "@/components/views/onboarding-view";
import { TopSearchBar } from "@/components/verbs/top-search-bar";

export function AppShell() {
  const view = useStore((s) => s.view);
  const settings = useStore((s) => s.settings);
  const loadVerbs = useStore((s) => s.loadVerbs);
  const loadPersisted = useStore((s) => s.loadPersisted);
  const activeQuizExamMode = useStore((s) => s.activeQuizExamMode);

  // first-load boot
  React.useEffect(() => {
    loadVerbs();
    loadPersisted();
  }, [loadVerbs, loadPersisted]);

  // apply theme + animation + text-size classes to <html>
  React.useEffect(() => {
    const root = document.documentElement;
    if (settings.largeText) root.classList.add("text-large");
    else root.classList.remove("text-large");
    if (settings.highContrast) root.classList.add("high-contrast");
    else root.classList.remove("high-contrast");
    const anim = settings.animations;
    root.classList.remove("anim-reduced", "anim-off");
    if (anim === "reduced") root.classList.add("anim-reduced");
    if (anim === "off") root.classList.add("anim-off");
  }, [settings.largeText, settings.highContrast, settings.animations]);

  // register service worker for offline PWA
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const examMode = view === "quiz" && activeQuizExamMode;
  const showChrome = !examMode && view !== "onboarding";

  const main = (() => {
    switch (view) {
      case "home":
        return <HomeView />;
      case "chapters":
        return <ChaptersView />;
      case "chapter":
        return <ChapterView />;
      case "word":
        return <WordView />;
      case "flashcards":
        return <FlashcardsView />;
      case "quiz":
        return <QuizView />;
      case "progress":
        return <ProgressView />;
      case "more":
        return <MoreView />;
      case "search":
        return <SearchView />;
      case "pronunciation":
        return <PronunciationView />;
      case "oraltest":
        return <OralTestView />;
      case "customtests":
        return <CustomTestsView />;
      case "favorites":
        return <FavoritesView />;
      case "review":
        return <ReviewView />;
      case "daily":
        return <DailyLessonView />;
      case "settings":
        return <SettingsView />;
      case "onboarding":
        return <OnboardingView />;
      default:
        return <HomeView />;
    }
  })();

  if (examMode) {
    return (
      <div className="exam-mode min-h-screen bg-background flex flex-col">
        <main className="flex-1">{main}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showChrome && <TopSearchBar />}
      <main className="flex-1 pb-24">{main}</main>
      {showChrome && (
        <footer className="mt-auto">
          <BottomTabs />
        </footer>
      )}
      {showChrome && <Verbie />}
    </div>
  );
}
