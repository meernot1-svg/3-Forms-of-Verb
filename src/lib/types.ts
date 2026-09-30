// Core verb data types. Book data is locked/read-only; additional_info is generated.

export type Difficulty = "easy" | "medium" | "hard";
export type Frequency = "high" | "medium" | "low";

export interface Sense {
  level: "basic" | "intermediate" | "advanced";
  meaning: string;
  sindhi?: string;
  explanation?: string;
  example?: string;
  context?: string;
  difficulty?: Difficulty;
}

export interface BookData {
  first_form: string;
  second_form: string;
  third_form: string;
  sindhi_meaning: string;
  page: number;
}

export interface AdditionalInfo {
  part_of_speech: string;
  english_meaning: string;
  pronunciation_uk: string;
  pronunciation_us: string;
  easy_pronunciation: string;
  present_participle: string;
  third_person_singular: string;
  irregular: boolean;
  difficulty: Difficulty;
  frequency: Frequency;
  senses: Sense[];
  examples: { easy: string; medium: string; advanced: string };
  collocations: string[];
  used_with: string[];
  synonyms: string[];
  antonyms: string[];
  common_mistakes: string[];
  related_words: string[];
  phrasal_verbs: string[];
  memory_tip: string;
}

export interface Verb {
  id: string;
  chapter: string;
  book_data: BookData;
  additional_info: AdditionalInfo;
  needs_review?: boolean;
}

export type SrsStatus = "new" | "learning" | "mastered" | "review";
export type QuizType =
  | "meaning"
  | "sindhi_to_english"
  | "english_to_sindhi"
  | "past_form"
  | "third_form"
  | "fill_in"
  | "sense"
  | "listening"
  | "spelling"
  | "match_pairs"
  | "true_false"
  | "odd_one_out"
  | "error_correction";

export interface SrsRecord {
  id: string; // verb id
  status: SrsStatus;
  attempts: number;
  correct: number;
  wrong: number;
  lastSeen: number; // epoch ms
  nextDue: number; // epoch ms
  interval: number; // days
  ease: number; // SM-2 ease factor
  streak: number; // consecutive correct
  leeched: boolean; // missed 5+ times
}

export interface ReportEntry {
  id: string;
  verbId: string;
  issue: string;
  note?: string;
  createdAt: number;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earnedAt?: number;
}

export interface CustomTest {
  id: string;
  name: string;
  source: string; // description of word source
  wordIds: string[];
  questionTypes: QuizType[];
  count: number;
  difficulty: Difficulty | "mixed";
  timeMode: "none" | "per_question" | "total";
  timeValue: number;
  examMode: boolean;
  createdAt: number;
  lastAttempt?: {
    score: number;
    total: number;
    takenAt: number;
  };
}

export interface QuizAttempt {
  testId: string;
  startedAt: number;
  finishedAt?: number;
  answers: { verbId: string; type: QuizType; correct: boolean }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  online?: boolean; // whether answered by online AI
  feedback?: "up" | "down";
}

export interface ReminderSettings {
  enabled: boolean;
  times: string[]; // ["08:00","14:00","20:00"]
  days: number[]; // 0-6 (Sun-Sat)
  type: "lesson" | "review" | "oral" | "streak";
  quietStart?: string;
  quietEnd?: string;
  language: "en" | "sd" | "ur";
}

export interface UserSettings {
  uiLanguage: "en" | "sd" | "ur";
  languageMode: "english" | "english_sindhi" | "sindhi_english";
  theme: "light" | "dark" | "auto";
  accentColor: string;
  animations: "full" | "reduced" | "off";
  largeText: boolean;
  highContrast: boolean;
  dataSaver: boolean;
  dailyGoal: number;
  newWordsPerLesson: number;
  reminders: ReminderSettings;
  audioRate: number;
  audioVoiceUK?: string;
  audioVoiceUS?: string;
}

export interface MistakeNote {
  id: string;
  verbId: string;
  type: QuizType;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  ts: number;
}

export interface UserProfile {
  id: string;
  name: string;
  createdAt: number;
  xp: number;
  level: number;
  streak: number;
  streakFreeze: number;
  lastStudyDate?: string; // YYYY-MM-DD
  wordsLearnedToday: number;
  todayDate?: string;
  badges: Badge[];
  customTests: CustomTest[];
}
