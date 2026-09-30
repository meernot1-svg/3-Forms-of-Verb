// SM-2 style spaced repetition for verbs.
// Intervals (days): 1 -> 2 -> 4 -> 7 -> 14 -> 30.
// Wrong answers push back; right answers advance. Leeched after 5+ wrong.

import type { SrsRecord, SrsStatus } from "./types";

export const SRS_INTERVALS = [1, 2, 4, 7, 14, 30];

export function defaultSrsRecord(id: string): SrsRecord {
  const now = Date.now();
  return {
    id,
    status: "new",
    attempts: 0,
    correct: 0,
    wrong: 0,
    lastSeen: now,
    nextDue: now, // due immediately
    interval: 0,
    ease: 2.5,
    streak: 0,
    leeched: false,
  };
}

function statusFromInterval(interval: number): SrsStatus {
  if (interval <= 0) return "new";
  if (interval <= 4) return "learning";
  if (interval >= 30) return "mastered";
  return "review";
}

/**
 * Update an SRS record given a correct/incorrect answer.
 * SM-2 inspired:
 *  - Correct: ease += 0.1, advance interval index, schedule nextDue
 *  - Wrong: ease -= 0.2 (min 1.3), reset to first interval, streak = 0
 *  - Leech after 5+ wrong answers
 */
export function updateSrs(rec: SrsRecord, correct: boolean): SrsRecord {
  const now = Date.now();
  const next: SrsRecord = { ...rec, lastSeen: now, attempts: rec.attempts + 1 };

  if (correct) {
    next.correct = rec.correct + 1;
    next.streak = rec.streak + 1;
    next.wrong = rec.wrong;
    next.ease = Math.min(2.8, rec.ease + 0.1);
    // find current interval index
    const idx = SRS_INTERVALS.indexOf(Math.round(rec.interval));
    const startIdx = idx < 0 ? 0 : idx;
    const newIdx = Math.min(SRS_INTERVALS.length - 1, startIdx + 1);
    next.interval = SRS_INTERVALS[newIdx];
    next.nextDue = now + next.interval * 24 * 60 * 60 * 1000;
    next.status = statusFromInterval(next.interval);
    // mastered requires 2+ consecutive correct AND interval >= 30
    if (next.streak >= 3 && next.interval >= 30) next.status = "mastered";
    next.leeched = rec.leeched; // stays flagged once flagged, can recover
  } else {
    next.wrong = rec.wrong + 1;
    next.streak = 0;
    next.correct = rec.correct;
    next.ease = Math.max(1.3, rec.ease - 0.2);
    // push back to first interval
    next.interval = SRS_INTERVALS[0];
    next.nextDue = now + next.interval * 24 * 60 * 60 * 1000;
    next.status = "review";
    if (next.wrong >= 5) next.leeched = true;
  }
  return next;
}

export function isDue(rec: SrsRecord, now = Date.now()): boolean {
  return rec.nextDue <= now;
}

export function statusColor(status: SrsStatus): string {
  switch (status) {
    case "mastered":
      return "text-emerald-600";
    case "learning":
      return "text-amber-600";
    case "review":
      return "text-rose-600";
    default:
      return "text-slate-500";
  }
}

export function statusBg(status: SrsStatus): string {
  switch (status) {
    case "mastered":
      return "bg-emerald-500";
    case "learning":
      return "bg-amber-500";
    case "review":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

export function statusLabel(status: SrsStatus): string {
  switch (status) {
    case "mastered":
      return "Mastered";
    case "learning":
      return "Learning";
    case "review":
      return "Needs Review";
    case "new":
      return "New";
  }
}
