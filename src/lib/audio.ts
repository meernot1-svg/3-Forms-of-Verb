// Web Speech API helpers: pronunciation (en-GB, en-US), speed control,
// voice availability detection, fallback messaging.
// Client-side only.

export type Accent = "uk" | "us";

export function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis || null;
}

export function isSpeechSupported(): boolean {
  return !!getSpeechSynthesis() && typeof window.SpeechSynthesisUtterance !== "undefined";
}

export function listVoices(): SpeechSynthesisVoice[] {
  const synth = getSpeechSynthesis();
  return synth ? synth.getVoices() : [];
}

export function voicesByLang(): { uk: SpeechSynthesisVoice[]; us: SpeechSynthesisVoice[] } {
  const voices = listVoices();
  return {
    uk: voices.filter((v) => /en[-_]?GB/i.test(v.lang)),
    us: voices.filter((v) => /en[-_]?US/i.test(v.lang)),
  };
}

export function hasVoice(accent: Accent): boolean {
  const { uk, us } = voicesByLang();
  return accent === "uk" ? uk.length > 0 : us.length > 0;
}

let cachedVoices: SpeechSynthesisVoice[] | null = null;
let voicesReady = false;
export function onVoicesReady(cb: () => void): () => void {
  const synth = getSpeechSynthesis();
  if (!synth) return () => {};
  if (synth.getVoices().length > 0 || voicesReady) {
    cb();
    return () => {};
  }
  const handler = () => {
    cachedVoices = synth.getVoices();
    voicesReady = true;
    cb();
  };
  synth.addEventListener("voiceschanged", handler);
  return () => synth.removeEventListener("voiceschanged", handler);
}

export interface SpeakOptions {
  accent?: Accent;
  rate?: number; // 0.5 slow .. 1 normal .. 1.2 fast
  onstart?: () => void;
  onend?: () => void;
  onboundary?: (e: SpeechSynthesisEvent) => void;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  const synth = getSpeechSynthesis();
  if (!synth) {
    opts.onend?.();
    return false;
  }
  // cancel anything queued
  synth.cancel();
  if (!text) {
    opts.onend?.();
    return false;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 1;
  u.pitch = 1;
  const { uk, us } = voicesByLang();
  const voice = opts.accent === "uk" ? uk[0] : us[0];
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    // fallback to default
    u.lang = opts.accent === "uk" ? "en-GB" : "en-US";
  }
  if (opts.onstart) u.onstart = opts.onstart;
  if (opts.onend) u.onend = opts.onend;
  if (opts.onboundary) u.onboundary = opts.onboundary;
  currentUtterance = u;
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  const synth = getSpeechSynthesis();
  if (synth) synth.cancel();
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  const synth = getSpeechSynthesis();
  return !!synth && synth.speaking;
}

// SpeechRecognition helpers (for oral test + repeat-after-me)
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
}

export function createRecognition(lang: Accent = "us"): any | null {
  if (typeof window === "undefined") return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = lang === "uk" ? "en-GB" : "en-US";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  return rec;
}

// normalise a transcript: lowercase, strip punctuation, tolerate simple
// homophones like chose/choose
export function normalizeTranscript(s: string): string {
  let out = (s || "").toLowerCase();
  out = out.replace(/[.,!?;:"'`()]/g, " ");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

// tolerant compare for oral test: ignores punctuation/case, allows partial match
export function fuzzyMatchAnswer(transcript: string, acceptable: string[]): { match: boolean; confidence: number } {
  const t = normalizeTranscript(transcript);
  if (!t) return { match: false, confidence: 0 };
  const acc = acceptable.map((a) => normalizeTranscript(a)).filter(Boolean);
  // exact
  for (const a of acc) {
    if (t === a) return { match: true, confidence: 1 };
  }
  // contains
  for (const a of acc) {
    if (t.includes(a) || a.includes(t)) {
      const ratio = Math.min(a.length, t.length) / Math.max(a.length, t.length);
      if (ratio > 0.6) return { match: true, confidence: ratio };
    }
  }
  // token overlap
  const tTokens = new Set(t.split(" "));
  for (const a of acc) {
    const aTokens = a.split(" ");
    if (!aTokens.length) continue;
    const hits = aTokens.filter((w) => tTokens.has(w)).length;
    const conf = hits / aTokens.length;
    if (conf >= 0.6) return { match: true, confidence: conf };
  }
  return { match: false, confidence: 0 };
}
