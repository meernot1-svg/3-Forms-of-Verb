// Quiz generator + plausible distractor builder.
// Generates questions of many types from the verb dataset.

import type { Verb, QuizType } from "./types";

export interface QuizQuestion {
  id: string;
  type: QuizType;
  verbId: string;
  prompt: string;
  promptSindhi?: string;
  options?: string[]; // for MCQ
  answer: string; // canonical correct answer
  acceptableAnswers?: string[]; // alternative correct spellings
  explanation: string;
  hint?: string;
  audio?: string; // text to play for listening quizzes
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniqueDistractors(pool: string[], correct: string, n: number): string[] {
  const lower = correct.toLowerCase().trim();
  const seen = new Set<string>([lower]);
  const out: string[] = [];
  for (const item of shuffle(pool)) {
    const it = item.trim();
    if (!it) continue;
    if (seen.has(it.toLowerCase())) continue;
    // avoid distractors that are too similar (e.g. same as correct or forms)
    seen.add(it.toLowerCase());
    out.push(it);
    if (out.length >= n) break;
  }
  return out;
}

function uniqueVerbDistractors(pool: Verb[], correctId: string, n: number): Verb[] {
  const seen = new Set<string>([correctId]);
  const out: Verb[] = [];
  for (const v of shuffle(pool)) {
    if (seen.has(v.id)) continue;
    // avoid same-chapter repetition when possible to keep plausible
    seen.add(v.id);
    out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

// Build a question for one verb + type. Returns null if not buildable.
export function makeQuestion(
  verb: Verb,
  type: QuizType,
  allVerbs: Verb[]
): QuizQuestion | null {
  const bd = verb.book_data;
  const ai = verb.additional_info;
  const id = `${verb.id}-${type}-${Math.random().toString(36).slice(2, 7)}`;

  const meaningPool = allVerbs
    .map((v) => v.book_data.sindhi_meaning)
    .filter((m) => m && m !== bd.sindhi_meaning);
  const wordPool = allVerbs.filter((v) => v.id !== verb.id);

  switch (type) {
    case "meaning": {
      // English verb -> choose Sindhi meaning
      const distractors = uniqueDistractors(meaningPool, bd.sindhi_meaning, 3);
      if (distractors.length < 3) return null;
      const options = shuffle([bd.sindhi_meaning, ...distractors]);
      return {
        id,
        type,
        verbId: verb.id,
        prompt: `What is the Sindhi meaning of "${bd.first_form}"?`,
        promptSindhi: bd.sindhi_meaning,
        options,
        answer: bd.sindhi_meaning,
        explanation: `📕 From the Book: "${bd.first_form}" means "${bd.sindhi_meaning}".`,
      };
    }
    case "sindhi_to_english": {
      const distractors = uniqueVerbDistractors(wordPool, verb.id, 3);
      if (distractors.length < 3) return null;
      const opts = shuffle([bd.first_form, ...distractors.map((d) => d.book_data.first_form)]);
      return {
        id,
        type,
        verbId: verb.id,
        prompt: `Which English verb means "${bd.sindhi_meaning}"?`,
        promptSindhi: bd.sindhi_meaning,
        options: opts,
        answer: bd.first_form,
        acceptableAnswers: [bd.first_form],
        explanation: `📕 "${bd.sindhi_meaning}" = "${bd.first_form}" (forms: ${bd.first_form} / ${bd.second_form} / ${bd.third_form}).`,
      };
    }
    case "english_to_sindhi": {
      const distractors = uniqueDistractors(meaningPool, bd.sindhi_meaning, 3);
      if (distractors.length < 3) return null;
      const options = shuffle([bd.sindhi_meaning, ...distractors]);
      return {
        id,
        type,
        verbId: verb.id,
        prompt: `What is the Sindhi meaning of "${bd.first_form}"?`,
        options,
        answer: bd.sindhi_meaning,
        explanation: `📕 "${bd.first_form}" = "${bd.sindhi_meaning}".`,
      };
    }
    case "past_form": {
      const distractors = uniqueVerbDistractors(wordPool, verb.id, 3);
      const opts = shuffle([bd.second_form, ...distractors.map((d) => d.book_data.second_form)]);
      return {
        id,
        type,
        verbId: verb.id,
        prompt: `What is the 2nd form (past) of "${bd.first_form}"?`,
        options: opts,
        answer: bd.second_form,
        acceptableAnswers: [bd.second_form],
        explanation: `📕 ${bd.first_form} → ${bd.second_form} → ${bd.third_form}`,
        hint: ai.irregular ? "Irregular verb — the past form changes." : "Regular verb — add -ed.",
      };
    }
    case "third_form": {
      const distractors = uniqueVerbDistractors(wordPool, verb.id, 3);
      const opts = shuffle([bd.third_form, ...distractors.map((d) => d.book_data.third_form)]);
      return {
        id,
        type,
        verbId: verb.id,
        prompt: `What is the 3rd form (past participle) of "${bd.first_form}"?`,
        options: opts,
        answer: bd.third_form,
        acceptableAnswers: [bd.third_form],
        explanation: `📕 ${bd.first_form} → ${bd.second_form} → ${bd.third_form}`,
      };
    }
    case "fill_in": {
      const example = ai.examples.medium || ai.examples.easy || ai.examples.advanced;
      if (!example) return null;
      const re = new RegExp(`\\b${escapeRegExp(bd.first_form)}\\b`, "i");
      const blanked = example.replace(re, "_____");
      const distractors = uniqueVerbDistractors(wordPool, verb.id, 3);
      const opts = shuffle([bd.first_form, ...distractors.map((d) => d.book_data.first_form)]);
      return {
        id,
        type,
        verbId: verb.id,
        prompt: `Fill in the blank: "${blanked}"`,
        options: opts,
        answer: bd.first_form,
        explanation: `The correct verb is "${bd.first_form}". Full: ${example}`,
      };
    }
    case "sense":
    case "listening":
    case "spelling":
    case "match_pairs":
    case "true_false":
    case "odd_one_out":
    case "error_correction":
      return null; // handled by specialised generators below
  }
  return null;
}

export function makeSpellingQuestion(verb: Verb): QuizQuestion {
  const bd = verb.book_data;
  return {
    id: `${verb.id}-spelling-${Math.random().toString(36).slice(2, 6)}`,
    type: "spelling",
    verbId: verb.id,
    prompt: `Type the base form of this verb. Meaning: "${bd.sindhi_meaning}"`,
    promptSindhi: bd.sindhi_meaning,
    answer: bd.first_form,
    acceptableAnswers: [bd.first_form, bd.first_form.toLowerCase()],
    explanation: `📕 ${bd.first_form} → ${bd.second_form} → ${bd.third_form} (${bd.sindhi_meaning}).`,
    hint: `It has ${bd.first_form.length} letters and starts with "${bd.first_form[0]}".`,
  };
}

export function makeListeningQuestion(verb: Verb, allVerbs: Verb[]): QuizQuestion {
  const bd = verb.book_data;
  const distractors = uniqueVerbDistractors(allVerbs.filter((v) => v.id !== verb.id), verb.id, 3);
  const opts = shuffle([bd.first_form, ...distractors.map((d) => d.book_data.first_form)]);
  return {
    id: `${verb.id}-listening-${Math.random().toString(36).slice(2, 6)}`,
    type: "listening",
    verbId: verb.id,
    prompt: "🔊 Listen and choose the word you heard.",
    options: opts,
    answer: bd.first_form,
    audio: bd.first_form,
    explanation: `You heard "${bd.first_form}". 📕 Meaning: ${bd.sindhi_meaning}.`,
  };
}

export function makeTrueFalseQuestion(verb: Verb, allVerbs: Verb[]): QuizQuestion {
  const bd = verb.book_data;
  // 50/50 true or false
  const truthy = Math.random() < 0.5;
  if (truthy) {
    return {
      id: `${verb.id}-tf-${Math.random().toString(36).slice(2, 6)}`,
      type: "true_false",
      verbId: verb.id,
      prompt: `True or False: The past form of "${bd.first_form}" is "${bd.second_form}".`,
      options: ["True", "False"],
      answer: "True",
      explanation: `📕 True — ${bd.first_form} → ${bd.second_form}.`,
    };
  }
  // pick a wrong past form from another verb
  const other = pick(allVerbs.filter((v) => v.id !== verb.id && v.book_data.second_form !== bd.second_form));
  const wrong = other ? other.book_data.second_form : bd.first_form + "ed";
  return {
    id: `${verb.id}-tf-${Math.random().toString(36).slice(2, 6)}`,
    type: "true_false",
    verbId: verb.id,
    prompt: `True or False: The past form of "${bd.first_form}" is "${wrong}".`,
    options: ["True", "False"],
    answer: "False",
    explanation: `📕 False — the correct past form is "${bd.second_form}".`,
  };
}

export function makeOddOneOutQuestion(verb: Verb, allVerbs: Verb[]): QuizQuestion {
  const bd = verb.book_data;
  const sameChapter = allVerbs.filter((v) => v.id !== verb.id && v.chapter === verb.chapter);
  const distractors = (sameChapter.length >= 3 ? sameChapter : allVerbs.filter((v) => v.id !== verb.id)).slice(0, 3);
  if (distractors.length < 3) return makeTrueFalseQuestion(verb, allVerbs);
  // the odd one is `verb`; three others share a letter, verb may not
  const opts = shuffle([bd.first_form, ...distractors.map((d) => d.book_data.first_form)]);
  return {
    id: `${verb.id}-odd-${Math.random().toString(36).slice(2, 6)}`,
    type: "odd_one_out",
    verbId: verb.id,
    prompt: `Which word does NOT belong with the others?`,
    options: opts,
    answer: bd.first_form,
    explanation: `"${bd.first_form}" is the odd one here (forms: ${bd.first_form}/${bd.second_form}/${bd.third_form}).`,
  };
}

export function makeErrorCorrectionQuestion(verb: Verb): QuizQuestion | null {
  const ex = verb.additional_info.examples.medium || verb.additional_info.examples.easy;
  if (!ex) return null;
  const bd = verb.book_data;
  // corrupt the verb form in the example
  const wrong = bd.second_form.endsWith("ed") ? bd.first_form + "ing" : bd.first_form + "ed";
  const re = new RegExp(`\\b${escapeRegExp(bd.first_form)}\\b`, "i");
  const corrupted = ex.replace(re, wrong);
  return {
    id: `${verb.id}-err-${Math.random().toString(36).slice(2, 6)}`,
    type: "error_correction",
    verbId: verb.id,
    prompt: `Fix the mistake in: "${corrupted}"`,
    answer: bd.first_form,
    acceptableAnswers: [bd.first_form],
    explanation: `The correct verb form is "${bd.first_form}" in this sentence.`,
    hint: `Look at the verb "${wrong}".`,
  };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const ALL_QUIZ_TYPES: QuizType[] = [
  "meaning",
  "sindhi_to_english",
  "english_to_sindhi",
  "past_form",
  "third_form",
  "fill_in",
  "sense",
  "listening",
  "spelling",
  "match_pairs",
  "true_false",
  "odd_one_out",
  "error_correction",
];

export const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  meaning: "Meaning",
  sindhi_to_english: "Sindhi → English",
  english_to_sindhi: "English → Sindhi",
  past_form: "Past form",
  third_form: "Third form",
  fill_in: "Fill in the blank",
  sense: "Which sense?",
  listening: "Listening",
  spelling: "Spelling",
  match_pairs: "Match the pairs",
  true_false: "True / False",
  odd_one_out: "Odd one out",
  error_correction: "Fix the sentence",
};

/**
 * Build a quiz of N questions for a set of verbs, mixing types.
 * Returns questions ready for the quiz engine.
 */
export function buildQuiz(
  verbs: Verb[],
  types: QuizType[],
  count: number
): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  const pool = shuffle(verbs);
  let i = 0;
  const all = verbs;
  while (out.length < count && out.length < pool.length * 2) {
    const v = pool[i % pool.length];
    i++;
    if (!v) break;
    const type = types[Math.floor(Math.random() * types.length)] || "meaning";
    let q: QuizQuestion | null = null;
    switch (type) {
      case "spelling":
        q = makeSpellingQuestion(v);
        break;
      case "listening":
        q = makeListeningQuestion(v, all);
        break;
      case "true_false":
        q = makeTrueFalseQuestion(v, all);
        break;
      case "odd_one_out":
        q = makeOddOneOutQuestion(v, all);
        break;
      case "error_correction":
        q = makeErrorCorrectionQuestion(v);
        break;
      default:
        q = makeQuestion(v, type, all);
    }
    if (q) out.push(q);
  }
  return out;
}

export function checkAnswer(q: QuizQuestion, userAnswer: string): boolean {
  const ua = userAnswer.trim().toLowerCase();
  if (!ua) return false;
  if (q.acceptableAnswers && q.acceptableAnswers.length) {
    return q.acceptableAnswers.some((a) => a.trim().toLowerCase() === ua);
  }
  return q.answer.trim().toLowerCase() === ua;
}
