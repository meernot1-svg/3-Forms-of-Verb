// Central Zustand store: holds the verb dataset, SRS state, user progress,
// navigation (active view), settings, and actions that persist to IndexedDB.
// Client-side only — the page.tsx renders this as a client component.

"use client";

import { create } from "zustand";
import type {
  Verb,
  SrsRecord,
  UserSettings,
  UserProfile,
  ChatMessage,
  CustomTest,
  QuizType,
} from "./types";
import { getDb, type FavoriteRow, type NoteRow, type DailyLogRow } from "./dexie";
import { defaultSrsRecord, updateSrs, isDue } from "./srs";

export type View =
  | "home"
  | "chapters"
  | "chapter"
  | "word"
  | "flashcards"
  | "quiz"
  | "progress"
  | "more"
  | "search"
  | "pronunciation"
  | "oraltest"
  | "customtests"
  | "favorites"
  | "review"
  | "daily"
  | "settings"
  | "onboarding";

export const DEFAULT_SETTINGS: UserSettings = {
  uiLanguage: "en",
  languageMode: "english_sindhi",
  theme: "auto",
  accentColor: "emerald",
  animations: "full",
  largeText: false,
  highContrast: false,
  dataSaver: false,
  dailyGoal: 10,
  newWordsPerLesson: 10,
  reminders: {
    enabled: false,
    times: ["20:00"],
    days: [0, 1, 2, 3, 4, 5, 6],
    type: "lesson",
    language: "en",
  },
  audioRate: 1,
};

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function xpForLevel(level: number): number {
  return Math.round(50 * Math.pow(1.35, level - 1));
}

function levelFromXp(xp: number): number {
  let lvl = 1;
  let need = xpForLevel(lvl);
  let total = need;
  while (xp >= total) {
    lvl++;
    total += xpForLevel(lvl);
  }
  return lvl;
}

function xpIntoLevel(xp: number): { level: number; into: number; need: number } {
  let lvl = 1;
  let remaining = xp;
  let need = xpForLevel(lvl);
  while (remaining >= need) {
    remaining -= need;
    lvl++;
    need = xpForLevel(lvl);
  }
  return { level: lvl, into: remaining, need };
}

interface StoreState {
  verbs: Verb[];
  loaded: boolean;
  view: View;
  navStack: View[];
  activeChapter: string | null;
  activeVerbId: string | null;
  activeQuizVerbIds: string[];
  activeQuizTitle: string;
  activeQuizTypes: QuizType[];
  activeQuizExamMode: boolean;
  activeCustomTestId: string | null;
  srs: Record<string, SrsRecord>;
  favorites: Set<string>;
  notes: Record<string, string>;
  settings: UserSettings;
  profile: UserProfile;
  chat: ChatMessage[];
  remindersAcknowledged: number;

  // data loading
  loadVerbs: () => Promise<void>;
  loadPersisted: () => Promise<void>;

  // navigation
  setView: (v: View) => void;
  goBack: () => void;
  openChapter: (c: string) => void;
  openWord: (id: string) => void;
  startQuiz: (verbIds: string[], title: string, types?: QuizType[], exam?: boolean) => void;
  startCustomTest: (testId: string) => void;

  // SRS + progress
  recordAnswer: (verbId: string, correct: boolean) => Promise<void>;
  ensureSrs: (verbId: string) => Promise<void>;
  markLearned: (verbId: string) => Promise<void>;
  dueWords: () => string[];
  leechWords: () => string[];

  // favorites + notes
  toggleFavorite: (verbId: string) => Promise<void>;
  setNote: (verbId: string, text: string) => Promise<void>;

  // settings
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  addXp: (amount: number) => Promise<void>;
  bumpStreak: () => Promise<void>;

  // chat
  addChat: (msg: ChatMessage) => Promise<void>;
  clearChat: () => Promise<void>;
  setChatFeedback: (id: string, fb: "up" | "down") => Promise<void>;

  // custom tests
  saveCustomTest: (t: CustomTest) => Promise<void>;
  deleteCustomTest: (id: string) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  verbs: [],
  loaded: false,
  view: "home",
  navStack: ["home"],
  activeChapter: null,
  activeVerbId: null,
  activeQuizVerbIds: [],
  activeQuizTitle: "",
  activeQuizTypes: ["meaning", "past_form", "third_form", "sindhi_to_english", "true_false"],
  activeQuizExamMode: false,
  activeCustomTestId: null,
  srs: {},
  favorites: new Set(),
  notes: {},
  settings: DEFAULT_SETTINGS,
  profile: {
    id: "default",
    name: "Student",
    createdAt: Date.now(),
    xp: 0,
    level: 1,
    streak: 0,
    streakFreeze: 1,
    wordsLearnedToday: 0,
    badges: [],
    customTests: [],
  },
  chat: [],
  remindersAcknowledged: 0,

  loadVerbs: async () => {
    if (get().loaded) return;
    try {
      const res = await fetch("/verbs.json");
      const data: Verb[] = await res.json();
      // attach generated additional info defaults already in json; also compute
      set({ verbs: data, loaded: true });
      // initialize SRS records lazily as needed
    } catch (e) {
      console.error("Failed to load verbs.json", e);
      set({ loaded: true });
    }
  },

  loadPersisted: async () => {
    if (typeof window === "undefined") return;
    try {
      const db = getDb();
      // SRS
      const srsRecords = await db.srs.toArray();
      const srsMap: Record<string, SrsRecord> = {};
      for (const r of srsRecords) srsMap[r.id] = r;
      // favorites
      const favs = await db.favorites.toArray();
      const favSet = new Set(favs.map((f) => f.verbId));
      // notes
      const notesArr = await db.notes.toArray();
      const notesMap: Record<string, string> = {};
      for (const n of notesArr) notesMap[n.verbId] = n.text;
      // settings
      const settingsRow = await db.settings.get("default");
      const settings = settingsRow || DEFAULT_SETTINGS;
      // profile
      let profile = await db.profile.get("default");
      if (!profile) {
        profile = {
          id: "default",
          name: "Student",
          createdAt: Date.now(),
          xp: 0,
          level: 1,
          streak: 0,
          streakFreeze: 1,
          wordsLearnedToday: 0,
          badges: [],
          customTests: [],
        };
        await db.profile.put(profile);
      }
      // daily reset of wordsLearnedToday
      const today = todayStr();
      if (profile.todayDate !== today) {
        profile = { ...profile, wordsLearnedToday: 0, todayDate: today };
        await db.profile.put(profile);
      }
      // chat
      const chatArr = await db.chat.toArray();
      chatArr.sort((a, b) => a.ts - b.ts);
      // custom tests live inside profile
      set({ srs: srsMap, favorites: favSet, notes: notesMap, settings, profile, chat: chatArr });
    } catch (e) {
      console.error("Failed to load persisted data", e);
    }
  },

  setView: (v) => set((s) => ({ view: v, navStack: [...s.navStack, v].slice(-8) })),
  goBack: () =>
    set((s) => {
      if (s.navStack.length <= 1) return s;
      const stack = [...s.navStack];
      stack.pop();
      const prev = stack[stack.length - 1] || "home";
      return { view: prev, navStack: stack };
    }),
  openChapter: (c) => set({ activeChapter: c, view: "chapter", navStack: ["home", "chapter"] }),
  openWord: (id) =>
    set((s) => ({ activeVerbId: id, view: "word", navStack: [...s.navStack, "word"].slice(-8) })),

  startQuiz: (verbIds, title, types, exam = false) =>
    set({
      activeQuizVerbIds: verbIds,
      activeQuizTitle: title,
      activeQuizTypes: types || ["meaning", "past_form", "third_form", "sindhi_to_english", "true_false"],
      activeQuizExamMode: exam,
      view: "quiz",
      navStack: ["quiz"],
    }),
  startCustomTest: (testId) => set({ activeCustomTestId: testId, view: "customtests" }),

  recordAnswer: async (verbId, correct) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    const cur = get().srs[verbId] || defaultSrsRecord(verbId);
    const next = updateSrs(cur, correct);
    set((s) => ({ srs: { ...s.srs, [verbId]: next } }));
    await db.srs.put(next);
    // XP
    if (correct) await get().addXp(verbXpReward(next.status));
  },

  ensureSrs: async (verbId) => {
    if (get().srs[verbId]) return;
    const db = getDb();
    const rec = defaultSrsRecord(verbId);
    set((s) => ({ srs: { ...s.srs, [verbId]: rec } }));
    await db.srs.put(rec);
  },

  markLearned: async (verbId) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    const cur = get().srs[verbId] || defaultSrsRecord(verbId);
    const now = Date.now();
    const next: SrsRecord = {
      ...cur,
      status: "learning",
      attempts: cur.attempts + 1,
      correct: cur.correct + 1,
      streak: cur.streak + 1,
      lastSeen: now,
      interval: 1,
      nextDue: now + 1 * 86400000,
    };
    set((s) => ({ srs: { ...s.srs, [verbId]: next } }));
    await db.srs.put(next);
    // daily log + words learned today
    const today = todayStr();
    const profile = { ...get().profile };
    profile.wordsLearnedToday = (profile.todayDate === today ? profile.wordsLearnedToday : 0) + 1;
    profile.todayDate = today;
    await db.profile.put(profile);
    await logDaily(db, today, 1, 10, 1);
    set({ profile });
    await get().addXp(5);
  },

  dueWords: () => {
    const srs = get().srs;
    const now = Date.now();
    return Object.values(srs)
      .filter((r) => isDue(r, now) && r.status !== "new")
      .map((r) => r.id);
  },

  leechWords: () => {
    const srs = get().srs;
    return Object.values(srs)
      .filter((r) => r.leeched)
      .map((r) => r.id);
  },

  toggleFavorite: async (verbId) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    const cur = new Set(get().favorites);
    if (cur.has(verbId)) {
      cur.delete(verbId);
      await db.favorites.delete(verbId);
    } else {
      cur.add(verbId);
      const row: FavoriteRow = { verbId, ts: Date.now() };
      await db.favorites.put(row);
    }
    set({ favorites: cur });
  },

  setNote: async (verbId, text) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    const row: NoteRow = { verbId, text, updatedAt: Date.now() };
    await db.notes.put(row);
    set((s) => ({ notes: { ...s.notes, [verbId]: text } }));
  },

  updateSettings: async (patch) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await db.settings.put({ id: "default", ...next } as any);
  },

  addXp: async (amount) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    const profile = { ...get().profile };
    profile.xp = Math.max(0, profile.xp + amount);
    profile.level = levelFromXp(profile.xp);
    set({ profile });
    await db.profile.put(profile);
  },

  bumpStreak: async () => {
    if (typeof window === "undefined") return;
    const db = getDb();
    const today = todayStr();
    const profile = { ...get().profile };
    if (profile.lastStudyDate === today) return; // already counted
    // check yesterday to continue streak
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    if (profile.lastStudyDate === yStr) {
      profile.streak += 1;
    } else if (!profile.lastStudyDate) {
      profile.streak = 1;
    } else {
      // streak broken — use freeze if available
      if (profile.streakFreeze > 0) {
        profile.streakFreeze -= 1;
        profile.streak += 1;
      } else {
        profile.streak = 1;
      }
    }
    profile.lastStudyDate = today;
    set({ profile });
    await db.profile.put(profile);
  },

  addChat: async (msg) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    await db.chat.put(msg);
    set((s) => ({ chat: [...s.chat, msg].slice(-200) }));
  },
  clearChat: async () => {
    if (typeof window === "undefined") return;
    const db = getDb();
    await db.chat.clear();
    set({ chat: [] });
  },
  setChatFeedback: async (id, fb) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    const msg = get().chat.find((m) => m.id === id);
    if (!msg) return;
    const updated = { ...msg, feedback: fb };
    await db.chat.put(updated);
    set((s) => ({ chat: s.chat.map((m) => (m.id === id ? updated : m)) }));
  },

  saveCustomTest: async (t) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    await db.customTests.put(t);
    const profile = { ...get().profile };
    const idx = profile.customTests.findIndex((x) => x.id === t.id);
    if (idx >= 0) profile.customTests[idx] = t;
    else profile.customTests.push(t);
    await db.profile.put(profile);
    set({ profile });
  },
  deleteCustomTest: async (id) => {
    if (typeof window === "undefined") return;
    const db = getDb();
    await db.customTests.delete(id);
    const profile = { ...get().profile };
    profile.customTests = profile.customTests.filter((t) => t.id !== id);
    await db.profile.put(profile);
    set({ profile });
  },
}));

function verbXpReward(status: SrsRecord["status"]): number {
  switch (status) {
    case "mastered":
      return 15;
    case "learning":
      return 10;
    case "review":
      return 8;
    default:
      return 5;
  }
}

async function logDaily(db: ReturnType<typeof getDb>, date: string, studied: number, xp: number, minutes: number) {
  const existing = await db.dailyLog.get(date);
  const row: DailyLogRow = {
    date,
    studied: (existing?.studied || 0) + studied,
    xp: (existing?.xp || 0) + xp,
    minutes: (existing?.minutes || 0) + minutes,
  };
  await db.dailyLog.put(row);
}

export { xpForLevel, levelFromXp, xpIntoLevel, todayStr };
