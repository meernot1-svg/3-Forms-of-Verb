"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Star, BookOpen, Sparkles, Check, RotateCcw, NotebookPen, AlertTriangle, ChevronDown, Lightbulb, Swords, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudioButton } from "@/components/verbs/audio-button";
import { cn } from "@/lib/utils";
import { getDb } from "@/lib/dexie";
import { toast } from "sonner";

export function WordView() {
  const verbs = useStore((s) => s.verbs);
  const activeId = useStore((s) => s.activeVerbId);
  const setView = useStore((s) => s.setView);
  const openWord = useStore((s) => s.openWord);
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const notes = useStore((s) => s.notes);
  const setNote = useStore((s) => s.setNote);
  const ensureSrs = useStore((s) => s.ensureSrs);
  const recordAnswer = useStore((s) => s.recordAnswer);
  const srs = useStore((s) => s.srs);

  const idx = verbs.findIndex((v) => v.id === activeId);
  const verb = verbs[idx];
  const [showSenses, setShowSenses] = React.useState(false);
  const [showNotes, setShowNotes] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const [dragX, setDragX] = React.useState(0);

  React.useEffect(() => {
    setNoteText(notes[activeId || ""] || "");
    setShowSenses(false);
    setShowNotes(false);
    setDragX(0);
  }, [activeId, notes]);

  if (!verb) {
    return (
      <div className="p-6 text-center text-muted-foreground">Word not found.</div>
    );
  }

  const bd = verb.book_data;
  const ai = verb.additional_info;
  const fav = favorites.has(verb.id);
  const prevId = idx > 0 ? verbs[idx - 1].id : null;
  const nextId = idx < verbs.length - 1 ? verbs[idx + 1].id : null;

  async function knowIt() {
    if (!verb) return;
    await ensureSrs(verb.id);
    await recordAnswer(verb.id, true);
    toast.success("Marked as known — XP gained!", { duration: 1500 });
  }
  async function needReview() {
    if (!verb) return;
    await ensureSrs(verb.id);
    await recordAnswer(verb.id, false);
    toast("Marked for review.", { duration: 1500 });
  }

  async function reportMistake() {
    if (typeof window === "undefined") return;
    const note = prompt(`Report a mistake for "${bd.first_form}":\nDescribe the issue (optional):`, "");
    if (note === null) return;
    try {
      const db = getDb();
      await db.reports.put({ id: `${verb.id}-${Date.now()}`, verbId: verb.id, issue: "User-reported mistake", note, createdAt: Date.now() });
      toast.success("Report saved locally — your teacher can review it.");
    } catch {
      toast.error("Could not save report.");
    }
  }

  // swipe handlers
  function handleDragEnd(_: any, info: { offset: { x: number } }) {
    if (info.offset.x < -80 && nextId) openWord(nextId);
    else if (info.offset.x > 80 && prevId) openWord(prevId);
    setDragX(0);
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 pb-28">
      <header className="flex items-center justify-between mb-2">
        <button onClick={() => setView("chapter")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Back to list">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xs text-muted-foreground">{idx + 1} / {verbs.length}</span>
        <button onClick={() => toggleFavorite(verb.id)} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Toggle favorite">
          <Star className={cn("h-5 w-5", fav ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
        </button>
      </header>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDrag={(_, info) => setDragX(info.offset.x)}
        onDragEnd={handleDragEnd}
        animate={{ x: dragX }}
        className="space-y-3"
      >
        {/* Header card */}
        <Card className="p-5 rounded-2xl shadow-soft relative overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-4xl font-bold leading-none break-words">{bd.first_form}</h1>
              {ai.easy_pronunciation && <p className="text-sm text-muted-foreground mt-1">/{ai.easy_pronunciation}/</p>}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <AudioButton text={bd.first_form} accent="uk" label="British pronunciation" />
              <AudioButton text={bd.first_form} accent="us" label="American pronunciation" />
              <AudioButton text={bd.first_form} accent="us" slow label="Slow pronunciation" />
            </div>
          </div>

          {/* forms row */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FormChip label="1st" value={bd.first_form} active />
            <Arrow />
            <FormChip label="2nd" value={bd.second_form} />
            <Arrow />
            <FormChip label="3rd" value={bd.third_form} />
            {ai.irregular && (
              <motion.span
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-2 py-1 rounded-full"
              >
                🔴 IRREGULAR VERB
              </motion.span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 rounded bg-muted">ing: {ai.present_participle || bd.first_form + "ing"}</span>
            <span className="px-2 py-1 rounded bg-muted">3rd sing: {ai.third_person_singular || bd.first_form + "s"}</span>
          </div>
        </Card>

        {/* 📕 Book meaning (Sindhi) */}
        <Section icon={<BookOpen className="h-4 w-4" />} label="📕 From the Book">
          <Card className="p-4 rounded-2xl">
            <div className="text-xs font-semibold text-muted-foreground mb-1">Sindhi meaning</div>
            <p className="sindhi text-2xl leading-relaxed" dir="rtl">{bd.sindhi_meaning || "—"}</p>
            <div className="text-xs text-muted-foreground mt-2">Page {bd.page} of the source book</div>
          </Card>
        </Section>

        {/* ✨ Additional info */}
        <Section icon={<Sparkles className="h-4 w-4" />} label="✨ Additional Learning Information">
          <Card className="p-4 rounded-2xl space-y-2">
            <Row label="Part of speech" value={ai.part_of_speech} />
            {ai.english_meaning ? <Row label="English meaning" value={ai.english_meaning} /> : <Row label="English meaning" value="(add your own — not from the book)" muted />}
            {(ai.pronunciation_uk || ai.pronunciation_us) && (
              <Row label="Pronunciation" value={`UK ${ai.pronunciation_uk || "—"} · US ${ai.pronunciation_us || "—"}`} />
            )}
            <Row label="Difficulty" value={ai.difficulty} />
            <Row label="Frequency" value={ai.frequency} />
          </Card>
        </Section>

        {/* Basic Senses */}
        {ai.senses && ai.senses.length > 0 && (
          <Section icon={<Lightbulb className="h-4 w-4" />} label="Senses (meanings in context)">
            <div className="space-y-2">
              {ai.senses.filter((s) => s.level === "basic").map((s, i) => (
                <SenseCard key={i} s={s} />
              ))}
              {ai.senses.some((s) => s.level !== "basic") && (
                <button onClick={() => setShowSenses(!showSenses)} className="w-full text-sm text-primary flex items-center justify-center gap-1 py-2">
                  {showSenses ? "Hide more senses" : "Show more senses"}
                  <ChevronDown className={cn("h-4 w-4 transition", showSenses && "rotate-180")} />
                </button>
              )}
              <AnimatePresence>
                {showSenses && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-2 overflow-hidden">
                    {ai.senses.filter((s) => s.level !== "basic").map((s, i) => (
                      <SenseCard key={i} s={s} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Section>
        )}

        {/* Example sentences */}
        {(ai.examples.easy || ai.examples.medium || ai.examples.advanced) && (
          <Section icon={<Sparkles className="h-4 w-4" />} label="Example sentences">
            <div className="space-y-2">
              {(["easy", "medium", "advanced"] as const).map((lvl) => {
                const ex = ai.examples[lvl];
                if (!ex) return null;
                return (
                  <Card key={lvl} className="p-3 rounded-2xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">{lvl}</span>
                      <AudioButton text={ex} accent="us" size="sm" />
                    </div>
                    <HighlightedExample text={ex} word={bd.first_form} />
                  </Card>
                );
              })}
            </div>
          </Section>
        )}

        {/* Where do I use this word? */}
        {(ai.used_with?.length > 0 || ai.collocations?.length > 0) && (
          <Section icon={<Sparkles className="h-4 w-4" />} label="Where do I use this word?">
            <Card className="p-4 rounded-2xl">
              {ai.used_with?.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5">Used with</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ai.used_with.map((w) => <span key={w} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">{w}</span>)}
                  </div>
                </div>
              )}
              {ai.collocations?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5">Collocations</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ai.collocations.map((w) => <span key={w} className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">{w}</span>)}
                  </div>
                </div>
              )}
            </Card>
          </Section>
        )}

        {/* Synonyms / Antonyms / Mistakes / Related */}
        {(ai.synonyms?.length || ai.antonyms?.length || ai.common_mistakes?.length || ai.related_words?.length) ? (
          <Section icon={<Swords className="h-4 w-4" />} label="Synonyms, antonyms & tips">
            <Card className="p-4 rounded-2xl space-y-3 text-sm">
              {ai.synonyms?.length > 0 && <KV k="Synonyms" v={ai.synonyms.join(", ")} />}
              {ai.antonyms?.length > 0 && <KV k="Antonyms" v={ai.antonyms.join(", ")} />}
              {ai.common_mistakes?.length > 0 && <KV k="Common mistakes" v={ai.common_mistakes.join("; ")} />}
              {ai.related_words?.length > 0 && <KV k="Related words" v={ai.related_words.join(", ")} />}
            </Card>
          </Section>
        ) : null}

        {/* Memory tip */}
        {ai.memory_tip && (
          <Section icon={<Lightbulb className="h-4 w-4" />} label="Memory tip">
            <Card className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <p className="text-sm">{ai.memory_tip}</p>
            </Card>
          </Section>
        )}

        {/* Personal notes */}
        <Section icon={<NotebookPen className="h-4 w-4" />} label="My notes">
          <Card className="p-3 rounded-2xl">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={() => verb && setNote(verb.id, noteText)}
              placeholder="Write your own notes about this word…"
              className="w-full min-h-[60px] bg-transparent text-sm resize-none outline-none"
            />
          </Card>
        </Section>

        {/* Report a mistake */}
        <button onClick={reportMistake} className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1.5 py-2">
          <AlertTriangle className="h-3.5 w-3.5" /> Report a mistake in this entry
        </button>
      </motion.div>

      {/* sticky bottom bar */}
      <div className="fixed bottom-16 inset-x-0 z-30 px-3 pb-safe">
        <div className="mx-auto max-w-2xl flex items-center gap-2 bg-card/95 backdrop-blur border border-border rounded-2xl p-2 shadow-soft">
          <Button variant="ghost" size="sm" disabled={!prevId} onClick={() => prevId && openWord(prevId)} className="rounded-xl">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button variant="outline" size="sm" onClick={needReview} className="flex-1 rounded-xl text-rose-600">
            <RotateCcw className="h-4 w-4" /> Review
          </Button>
          <Button variant="outline" size="sm" onClick={knowIt} className="flex-1 rounded-xl text-emerald-600">
            <Check className="h-4 w-4" /> Know it
          </Button>
          <Button variant="ghost" size="sm" disabled={!nextId} onClick={() => nextId && openWord(nextId)} className="rounded-xl">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormChip({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={cn("px-2.5 py-1.5 rounded-xl border", active ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border")}>
      <div className="text-[9px] uppercase text-muted-foreground font-bold">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}
function Arrow() { return <ChevronRight className="h-4 w-4 text-muted-foreground/60" />; }

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1.5 px-1">
        {icon}
        <h2 className="text-sm font-semibold">{label}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-medium", muted && "text-muted-foreground/60 italic")}>{value}</span>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{k}</div>
      <div>{v}</div>
    </div>
  );
}

function HighlightedExample({ text, word }: { text: string; word: string }) {
  const parts = React.useMemo(() => text.split(new RegExp(`\\b(${word})\\b`, "gi")), [text, word]);
  return (
    <p className="text-sm leading-relaxed">
      {parts.map((p, i) =>
        p.toLowerCase() === word.toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-primary font-semibold rounded px-0.5">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </p>
  );
}

function SenseCard({ s }: { s: any }) {
  return (
    <Card className="p-3 rounded-2xl">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm">{s.meaning}</span>
        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.level}</span>
      </div>
      {s.sindhi && <p className="sindhi text-sm text-muted-foreground" dir="rtl">{s.sindhi}</p>}
      {s.explanation && <p className="text-xs text-muted-foreground mt-1">{s.explanation}</p>}
      {s.example && (
        <div className="mt-1.5 flex items-center gap-2">
          <p className="text-sm italic flex-1">"{s.example}"</p>
          <AudioButton text={s.example} accent="us" size="sm" />
        </div>
      )}
      {s.context && <p className="text-[11px] text-muted-foreground mt-1">📍 {s.context}</p>}
    </Card>
  );
}
