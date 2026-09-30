// Fast, forgiving offline search over the verb dataset using Fuse.js.
// - English word, Sindhi text, any verb form (captured -> capture), first letter,
//   typo tolerance, Sindhi/Arabic-script normalisation, autocomplete + history.

import Fuse from "fuse.js";
import type { Verb } from "./types";

// Normalise Sindhi/Arabic script so slight variations still match:
// - strip diacritics (tashkeel)
// - normalise alef variants, yaa, etc.
const ARABIC_NORMAL_MAP: Record<string, string> = {
  "\u0622": "\u0627", // آ -> ا
  "\u0623": "\u0627", // أ -> ا
  "\u0625": "\u0627", // إ -> ا
  "\u0671": "\u0627", // ٱ -> ا
  "\u0649": "\u064A", // ى -> ي
  "\u0629": "\u0647", // ة -> ه (often)
  "\u0643": "\u06A9", // ك -> ک (Persian/Sindhi kaf common)
  "\u0624": "\u0648", // ؤ -> و
  "\u0626": "\u064A", // ئ -> ي
};
const TASHKEEL = /[\u064B-\u065F\u0670\u0640]/g;

export function normalizeSindhi(s: string): string {
  let out = (s || "").replace(TASHKEEL, "");
  out = Array.from(out).map((ch) => ARABIC_NORMAL_MAP[ch] || ch).join("");
  return out.replace(/\s+/g, " ").trim();
}

export function normalizeEnglish(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z'\- ]/g, " ").replace(/\s+/g, " ").trim();
}

export interface SearchHit {
  verb: Verb;
  matchedField: "first" | "second" | "third" | "sindhi" | "id";
}

export class VerbSearch {
  private fuse: Fuse<Verb>;
  private sindhiFuse: Fuse<Verb>;
  private all: Verb[];
  constructor(verbs: Verb[]) {
    this.all = verbs;
    this.fuse = new Fuse(verbs, {
      keys: [
        { name: "id", weight: 0.5 },
        { name: "book_data.first_form", weight: 0.3 },
        { name: "book_data.second_form", weight: 0.2 },
        { name: "book_data.third_form", weight: 0.2 },
        { name: "additional_info.english_meaning", weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 1,
      ignoreLocation: true,
    });
    // build a parallel index where sindhi_meaning is normalised for matching
    const norm = verbs.map((v) => ({
      ...v,
      book_data: { ...v.book_data, sindhi_meaning: normalizeSindhi(v.book_data.sindhi_meaning) },
    }));
    this.sindhiFuse = new Fuse(norm as Verb[], {
      keys: [{ name: "book_data.sindhi_meaning", weight: 1 }],
      threshold: 0.35,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 1,
    });
  }

  query(q: string, limit = 20): SearchHit[] {
    const query = (q || "").trim();
    if (!query) return [];
    // single-letter jump
    if (/^[a-zA-Z]$/.test(query)) {
      const letter = query.toUpperCase();
      return this.all
        .filter((v) => v.chapter === letter)
        .map((verb) => ({ verb, matchedField: "id" as const }));
    }
    const out: SearchHit[] = [];
    const seen = new Set<string>();
    // English / form search via main fuse
    for (const r of this.fuse.search(query, { limit: limit * 2 })) {
      if (seen.has(r.item.id)) continue;
      seen.add(r.item.id);
      out.push({ verb: r.item, matchedField: "first" });
      if (out.length >= limit) return out;
    }
    // Sindhi search (normalised) when query contains Arabic-script chars
    const hasArabic = /[\u0600-\u06FF]/.test(query);
    if (hasArabic) {
      const nq = normalizeSindhi(query);
      for (const r of this.sindhiFuse.search(nq, { limit: limit * 2 })) {
        if (seen.has(r.item.id)) continue;
        seen.add(r.item.id);
        out.push({ verb: r.item, matchedField: "sindhi" });
        if (out.length >= limit) return out;
      }
    }
    return out;
  }
}

// simple autocomplete for the search bar
export function autocomplete(verbs: Verb[], q: string, limit = 6): string[] {
  const query = normalizeEnglish(q);
  if (!query) return [];
  const hits = verbs
    .filter((v) => v.id.startsWith(query) || v.book_data.first_form.startsWith(query))
    .slice(0, limit)
    .map((v) => v.book_data.first_form);
  return hits;
}
