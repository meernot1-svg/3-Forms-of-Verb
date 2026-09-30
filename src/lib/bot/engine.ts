// Verbie — offline rule-based intent engine.
// Answers from verbs.json ONLY for book data (labelled 📕 From the Book).
// Anything else labelled ✨ Additional info. Handles navigation/action commands.
// Falls back to online LLM via /api/bot when enabled (handled in component).

import type { Verb } from "../types";
import { normalizeSindhi } from "../search";

export type BotSource = "book" | "extra";

export interface BotReply {
  text: string;
  sources: BotSource[];
  action?: { type: "open_chapter" | "open_word" | "start_quiz" | "start_lesson" | "add_favorite" | "start_oral" | "open_review"; payload?: any };
  suggestions?: string[];
}

function findVerb(query: string, verbs: Verb[]): Verb | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  let v = verbs.find((x) => x.id === q);
  if (v) return v;
  v = verbs.find(
    (x) =>
      x.book_data.first_form.toLowerCase() === q ||
      x.book_data.second_form.toLowerCase() === q ||
      x.book_data.third_form.toLowerCase() === q
  );
  if (v) return v;
  v = verbs.find((x) => x.book_data.first_form.toLowerCase().includes(q));
  if (v) return v;
  const nq = normalizeSindhi(q);
  if (nq) {
    v = verbs.find((x) => normalizeSindhi(x.book_data.sindhi_meaning).includes(nq));
    if (v) return v;
  }
  return null;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const GREETINGS = [
  "Hi! I'm Verbie 🐾 — your English-verbs teacher. Ask me about verbs, forms, meanings, or say \"quiz me\"!",
  "Hello there! Ready to learn some verbs today? 📘",
  "Hey! I can help with verb forms, meanings, examples, quizzes and more. What do you need?",
];

export function offlineBotReply(input: string, verbs: Verb[]): BotReply {
  const text = (input || "").trim();
  const low = text.toLowerCase();

  if (/^(hi|hello|hey|salam|assalam)\b/i.test(text) || text.length < 3) {
    return { text: pick(GREETINGS), sources: [], suggestions: ["Show verbs starting with C", "Quiz me on irregular verbs", "What are my weak words?", "Explain 'capture'"] };
  }
  if (/(thanks|thank you|thx|shukria)/i.test(low)) {
    return { text: "You're welcome! 😊 Keep going — every word makes you stronger.", sources: [], suggestions: ["Quiz me", "Word of the day", "Start today's lesson"] };
  }

  let m = low.match(/(?:verbs? (?:starting|beginning|that start) with|chapter )\s*([a-z])\b/);
  if (m) {
    const letter = m[1].toUpperCase();
    return { text: `Opening the "${letter}" chapter for you. 📚`, sources: [], action: { type: "open_chapter", payload: letter }, suggestions: ["Start learning", "Practice this chapter"] };
  }
  if (/(quiz|test|practice) me (?:on )?(irregular|irregular verbs?)/.test(low)) {
    const irr = verbs.filter((v) => v.additional_info.irregular).map((v) => v.id);
    return { text: `Let's quiz you on irregular verbs! I found ${irr.length} irregular verbs. Starting the quiz… 🧠`, sources: [], action: { type: "start_quiz", payload: { verbIds: irr.slice(0, 20), title: "Irregular Verbs Quiz" } } };
  }
  if (/(quiz|test|practice) me/.test(low)) {
    return { text: "Starting a quick mixed quiz for you. 📝", sources: [], action: { type: "start_quiz", payload: { verbIds: verbs.slice(0, 20).map((v) => v.id), title: "Quick Quiz" } } };
  }
  if (/(start|begin) today'?s lesson|start lesson|daily lesson/.test(low)) {
    return { text: "Great! Let's start today's lesson. 🎯", sources: [], action: { type: "start_lesson" }, suggestions: ["Show me an example", "Make it easier"] };
  }
  if (/add .* to favorites?|favorite this/.test(low)) {
    const v = findVerb(text.replace(/add|to favorites?/gi, " "), verbs);
    if (v) return { text: `Added "${v.book_data.first_form}" to your favorites. ⭐`, sources: [], action: { type: "add_favorite", payload: v.id } };
    return { text: "Tell me which word to favorite, e.g. \"Add capture to favorites\".", sources: [] };
  }
  if (/(oral|pronunciation) test|test my pronunciation|test my speaking/.test(low)) {
    return { text: "Starting the daily oral test. 🎤 Make sure your mic is on!", sources: [], action: { type: "start_oral" } };
  }
  if (/(weak|review|hard) words?|what (are my |do i have )?weak/.test(low)) {
    return { text: "Opening your Review list — these are the words you missed recently. 🔁", sources: [], action: { type: "open_review" } };
  }
  if (/word of the day/.test(low)) {
    const v = verbs[new Date().getDate() % verbs.length];
    return { text: `🌟 Word of the day: **${v.book_data.first_form}**\n📕 ${v.book_data.first_form} → ${v.book_data.second_form} → ${v.book_data.third_form}\n📕 Meaning: ${v.book_data.sindhi_meaning}`, sources: ["book"], action: { type: "open_word", payload: v.id } };
  }

  m = low.match(/(?:explain|what is|what are|meaning of|forms? of|tell me about|define)\s+([a-z' -]+)/);
  if (!m) m = low.match(/^([a-z][a-z'-]+)$/);
  const word = m ? m[1].trim() : "";

  const diff = low.match(/difference between\s+([a-z]+)\s+and\s+([a-z]+)/);
  if (diff) {
    const a = findVerb(diff[1], verbs);
    const b = findVerb(diff[2], verbs);
    if (a && b) {
      const lines = [
        `Comparing "${a.book_data.first_form}" and "${b.book_data.first_form}":`,
        `📕 ${a.book_data.first_form} (${a.book_data.sindhi_meaning}) — forms: ${a.book_data.first_form}/${a.book_data.second_form}/${a.book_data.third_form}`,
        `📕 ${b.book_data.first_form} (${b.book_data.sindhi_meaning}) — forms: ${b.book_data.first_form}/${b.book_data.second_form}/${b.book_data.third_form}`,
        `✨ Tip: ${a.additional_info.memory_tip || "Use them in different contexts to feel the difference."}`,
      ];
      return { text: lines.join("\n"), sources: ["book", "extra"], suggestions: ["Give an example", "Quiz me on these"] };
    }
  }

  if (word) {
    const v = findVerb(word, verbs);
    if (v) {
      const bd = v.book_data;
      const ai = v.additional_info;
      const lines = [
        `**${bd.first_form}** ${ai.irregular ? "🔴 (irregular)" : ""}`,
        `📕 From the Book: ${bd.first_form} → ${bd.second_form} → ${bd.third_form}`,
        `📕 Sindhi meaning: ${bd.sindhi_meaning}`,
        ai.english_meaning ? `✨ English meaning: ${ai.english_meaning}` : "✨ English meaning: (additional info)",
        ai.easy_pronunciation ? `✨ Pronunciation: ${ai.easy_pronunciation}` : "",
        ai.memory_tip ? `✨ Memory tip: ${ai.memory_tip}` : "",
      ].filter(Boolean);
      return { text: lines.join("\n"), sources: ["book", "extra"], action: { type: "open_word", payload: v.id }, suggestions: ["Give an example", "Explain in Sindhi", "Make it easier", "Quiz me on this"] };
    }
  }

  if (/(give|show) (me )?an? example|example of/.test(low) && word) {
    const v = findVerb(word, verbs);
    if (v) {
      const ex = v.additional_info.examples.medium || v.additional_info.examples.easy || v.additional_info.examples.advanced;
      return { text: ex ? `✨ Example: ${ex}` : "I don't have an example saved yet, but try forming your own sentence!", sources: ["extra"], suggestions: ["Another example", "Explain the meaning"] };
    }
  }

  if (/explain in sindhi|sindhi mein/.test(low)) {
    const v = findVerb(word || text, verbs);
    if (v) {
      return { text: `📕 ${v.book_data.first_form} — ${v.book_data.sindhi_meaning}\n(forms: ${v.book_data.first_form} / ${v.book_data.second_form} / ${v.book_data.third_form})`, sources: ["book"] };
    }
  }

  const fallback = findVerb(text, verbs);
  if (fallback) {
    return { text: `📕 From the Book: **${fallback.book_data.first_form}** → ${fallback.book_data.second_form} → ${fallback.book_data.third_form}\nMeaning: ${fallback.book_data.sindhi_meaning}`, sources: ["book"], action: { type: "open_word", payload: fallback.id } };
  }

  if (/(politic|religion|violence|drug|weapon|adult|sex)/i.test(low)) {
    return { text: "I can only help with English learning and this app. Let's stay on verbs! 📘", sources: [] };
  }

  return { text: "I'm not sure I caught that. I can help with verb forms, meanings, examples, quizzes and navigation. Try \"Explain capture\", \"Quiz me on irregular verbs\", or \"Show verbs starting with C\".", sources: [], suggestions: ["Explain capture", "Quiz me", "Word of the day", "Start today's lesson"] };
}
