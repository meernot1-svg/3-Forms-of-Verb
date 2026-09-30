# VerbMaster – English Verbs Learning

A complete, mobile-first, installable **PWA** for Sindhi-speaking students to learn
English verb forms and meanings, built from the source book
*"English Verbs with Forms and Meaning" by Majid Ali Lashari Baloch*.

It works **fully offline** after the first load — no login, no ads, no paid APIs for
core features. All data stays on the device (IndexedDB).

---

## What it does

- **676 verbs** extracted from the book (A–Z), each with 1st/2nd/3rd form, Sindhi
  meaning, and page number — faithfully copied from the source.
- **Book data vs. generated data are clearly separated everywhere** (UI, bot answers):
  📕 *From the Book* (locked, read-only) and ✨ *Additional Learning Information*
  (generated). Per-word "Report a mistake" button for a teacher to verify.
- **26 chapters A–Z** with progress rings; empty chapters (only X) show the
  "No verbs available for this chapter" message.
- **Word screen**: large headword, UK/US/slow audio, 1st→2nd→3rd forms with 🔴
  IRREGULAR badge, Sindhi RTL meaning, basic + more senses, example sentences,
  collocations, synonyms/antonyms, memory tip, personal notes, swipe nav,
  sticky bottom bar (Prev · Need review · Know it · Next).
- **Pronunciation trainer**: Web Speech API (en-GB / en-US) with friendly fallback
  if no voice installed, slow/normal speed, "Repeat after me" using
  SpeechRecognition where supported, minimal pairs for sounds Sindhi speakers
  find hard, "Which word did you hear?" listening quiz.
- **Flashcards**: 3D flip, swipe right=Know / left=Don't know, modes (English /
  Sindhi / audio), frequently-missed words weighted higher, undo.
- **Quizzes**: meaning, Sindhi↔English, past form, third form, fill-in, sense,
  listening, spelling, true/false, odd-one-out, error-correction — with instant
  feedback, explanations, animated timer ring, and **Exam Mode** lock.
- **Chapter tests + Exam Mode**: up to 50 questions, hides nav, intercepts back,
  detects leaving the app (violations), single Quit button.
- **Daily oral test**: HARD, timed (10 min total + 20s/question), voice-graded
  with typed-answer fallback, transcript breakdown, "I said it correctly" path.
- **Daily lesson**: guided 6-step flow (Warm-up → New words → Flashcards →
  Mini quiz → Pronunciation → Summary). **Progress saved mid-lesson** so the
  student can resume after closing the app.
- **Spaced repetition (SM-2)**: intervals 1→2→4→7→14→30 days. Wrong → back, right
  → forward. Statuses: 🟢 Mastered / 🟡 Learning / 🔴 Needs Review. **Leech
  detection** (missed 5+ times) → flagged for extra help.
- **Search**: Fuse.js fuzzy search over English words, Sindhi (Arabic-script
  normalised), any verb form, single-letter jump, filters (irregular /
  favorites / mastered / review), autocomplete, history.
- **Gamification**: XP, levels, daily streak (with streak-freeze), badges,
  weekly activity chart, accuracy trend, forgetting-risk list, export
  (JSON/backup-restore).
- **Verbie — the AI teacher**: a draggable animated SVG avatar on every screen
  (idle / listening / thinking / speaking / happy states). Opens a chat bottom
  sheet. Two layers:
  1. **Offline helper** (default, always works): a rule-based intent engine over
     `verbs.json` — lookup, forms, meaning, examples, "quiz me", navigation
     commands ("Show verbs starting with C", "Quiz me on irregular verbs",
     "Start today's lesson", "Add capture to favorites"…).
  2. **Smart AI (online, optional)**: a serverless proxy at `/api/bot` using
     `z-ai-web-dev-sdk` with a strict system prompt that enforces book-data
     accuracy (must label 📕 From the Book), child-safe content, and on-topic
     English learning. Rate-limited (40/hour), daily-capable, graceful fallback
     to offline on error or when **Data saver** is on.
- **PWA**: manifest + service worker, installable, offline shell + cached
  vocabulary + bundled Arabic-script font (Noto Naskh Arabic) for Sindhi.
- **Animations**: Framer Motion page/card transitions, 3D flashcard flip,
  animated progress rings/bars, canvas-confetti celebrations, animated Verbie
  — with **Full / Reduced / Off** settings and `prefers-reduced-motion` support.
- **Accessibility & themes**: light/dark/auto, large-text mode, high-contrast,
  44–48px tap targets, semantic HTML, RTL for Sindhi.
- **Mobile-first**: designed for 360×800 Android first, scales up; bottom tab
  bar (Home · Chapters · Practice · Progress · More); 48px tap targets;
  safe-area insets; sticky footer; bottom-sheet popups.

---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (New York)
- **Zustand** for app state, **Dexie** (IndexedDB) for persistence
- **Fuse.js** for fuzzy search, **Recharts** for charts
- **Framer Motion** + **canvas-confetti** for animation
- **z-ai-web-dev-sdk** for the optional online AI proxy (server-only)

---

## Project structure

```
src/
  app/
    layout.tsx          # fonts (incl. Noto Naskh Arabic), PWA meta, ThemeProvider
    page.tsx            # client AppShell
    globals.css         # theme palette (no indigo/blue), RTL, large-text, anim
    api/bot/route.ts    # online AI proxy (server-only, rate-limited)
  lib/
    types.ts            # Verb, SrsRecord, Settings, ...
    dexie.ts            # IndexedDB schema (srs, favorites, notes, chat, ...)
    store.ts            # Zustand store (view nav + SRS + XP + streak + ...)
    srs.ts              # SM-2 spaced repetition
    quiz.ts             # quiz generator + plausible distractors
    search.ts           # Fuse.js + Sindhi normalisation
    audio.ts            # speechSynthesis + SpeechRecognition helpers
    bot/engine.ts       # offline rule-based Verbie intent engine
  components/
    verbs/              # AppShell, BottomTabs, TopSearchBar, Verbie, AudioButton, ...
    views/              # Home, Chapters, Chapter, Word, Flashcards, Quiz,
                        # Progress, More, Search, Pronunciation, OralTest,
                        # CustomTests, Favorites, Review, DailyLesson,
                        # Settings, Onboarding
public/
  verbs.json            # 676 extracted verbs (book data + generated fields)
  manifest.webmanifest
  sw.js                 # offline-first service worker
  icon.svg / icon-192.png / icon-512.png
extraction_report.json  # Step 2 extraction report
```

---

## Develop

```bash
bun install
bun run dev      # http://localhost:3000
bun run lint      # ESLint
bun run db:push   # (Prisma is available if you later add a backend)
```

## Deploy

The app is a static-friendly Next.js project — it deploys to **Vercel**,
**Netlify** or **GitHub Pages** with the standard Next.js build. The only
runtime endpoint is `/api/bot` (the optional online AI proxy); everything else
is client-side and works offline.

> Note: the offline bot, quizzes, SRS, flashcards and pronunciation all work
> with **no backend and no internet** after the first load.

---

## Privacy & safety

- Data stays on the device by default (IndexedDB). No login, no ads.
- Microphone audio is **not** stored — only the live transcript is used for
  grading and then discarded.
- The AI bot refuses unsafe / off-topic requests and only covers English
  learning and the app's features. Child-safe content only.

---

## Honest notes on platform limits

- **Exam Mode** locks everything *inside* the app (hides nav, intercepts back,
  detects leaving, counts violations). A web app **cannot** lock the phone's
  Home button or other apps. For true device lock, use Android's "Screen
  pinning" (Settings → Security → Screen pinning). A Capacitor wrapper could
  add kiosk mode later — the code is structured so that's a small add.
- **Reminders**: PWA Notifications + service worker are used; reliable
  scheduled push needs Web Push (FCM free tier) or a native wrapper. If
  permission is blocked/unsupported, the app falls back to an in-app "Today's
  reminder" banner — it never crashes.
- **SpeechRecognition** needs internet on most browsers and is unsupported on
  some (Firefox, some iPhones). The app detects this and offers typed-answer
  or self-marked fallbacks for the oral test.
- **iPhone web notifications** require installing to the Home Screen (iOS 16.4+).

---

## Extraction report (Step 2)

See `extraction_report.json`. Summary: **676 verbs**, all chapters except **X**
(which has no verbs in the source book — shown faithfully as empty). Only 4
entries (`burst`, `cut`, `let`, `put`) flagged `needs_review` — these are
same-form irregular verbs (cut→cut→cut) captured correctly; the flag is a
conservative heuristic that invites a teacher to confirm, matching the spec's
intent. Irregular verbs (arise→arose→arisen, begin→began→begun, beat→beat→beaten,
become→became→become, bear→bore→born/borne, …) are all captured correctly.
Sindhi meanings preserved exactly in Arabic script.

---

## Acceptance checklist (see final report)

All major items pass — verified by Agent Browser end-to-end:
home render, all 26 chapters, chapter view, word view (with Book/Additional
separation), Sindhi RTL rendering, flashcards, daily lesson, Verbie chat with
correct 📕/✨ labelling, no console errors.
