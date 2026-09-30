// Dexie (IndexedDB) schema for persistent user data: SRS, progress, favorites,
// notes, mistakes, reports, chat history, custom tests, quiz attempts, settings.

import Dexie, { type Table } from "dexie";
import type {
  SrsRecord,
  ReportEntry,
  MistakeNote,
  ChatMessage,
  CustomTest,
  QuizAttempt,
  UserProfile,
  UserSettings,
} from "./types";

export interface FavoriteRow {
  verbId: string;
  ts: number;
}
export interface NoteRow {
  verbId: string;
  text: string;
  updatedAt: number;
}
export interface DailyLogRow {
  date: string; // YYYY-MM-DD
  studied: number;
  xp: number;
  minutes: number;
}

export class VerbMasterDB extends Dexie {
  srs!: Table<SrsRecord, string>;
  favorites!: Table<FavoriteRow, string>;
  notes!: Table<NoteRow, string>;
  mistakes!: Table<MistakeNote, string>;
  reports!: Table<ReportEntry, string>;
  chat!: Table<ChatMessage, string>;
  customTests!: Table<CustomTest, string>;
  attempts!: Table<QuizAttempt, string>;
  dailyLog!: Table<DailyLogRow, string>;
  profile!: Table<UserProfile, string>;
  settings!: Table<UserSettings, string>;

  constructor() {
    super("verbmaster");
    this.version(1).stores({
      srs: "id, status, nextDue, leeched",
      favorites: "verbId, ts",
      notes: "verbId, updatedAt",
      mistakes: "id, verbId, ts",
      reports: "id, verbId, createdAt",
      chat: "id, ts",
      customTests: "id, createdAt",
      attempts: "testId, startedAt",
      dailyLog: "date",
      profile: "id",
      settings: "id",
    });
  }
}

let _db: VerbMasterDB | null = null;
export function getDb(): VerbMasterDB {
  if (typeof window === "undefined") {
    // SSR fallback: return a throwaway in-memory placeholder that won't be used
    throw new Error("Dexie can only be used in the browser");
  }
  if (!_db) _db = new VerbMasterDB();
  return _db;
}
