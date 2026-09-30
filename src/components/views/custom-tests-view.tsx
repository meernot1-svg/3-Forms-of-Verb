"use client";
import * as React from "react";
import { ChevronLeft, Plus, ClipboardList, Trash2, Play, Share2, Edit, Download, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CustomTest, QuizType, Difficulty } from "@/lib/types";

const TYPES: { id: QuizType; label: string }[] = [
  { id: "meaning", label: "Meaning" },
  { id: "sindhi_to_english", label: "Sindhi → English" },
  { id: "english_to_sindhi", label: "English → Sindhi" },
  { id: "past_form", label: "Past form" },
  { id: "third_form", label: "Third form" },
  { id: "true_false", label: "True / False" },
  { id: "odd_one_out", label: "Odd one out" },
  { id: "listening", label: "Listening" },
  { id: "spelling", label: "Spelling" },
];

const QUICK = [
  { id: "mistakes", label: "Test me on my mistakes" },
  { id: "hard10", label: "10 random hard words" },
  { id: "yesterday", label: "Yesterday's words" },
];

export function CustomTestsView() {
  const profile = useStore((s) => s.profile);
  const verbs = useStore((s) => s.verbs);
  const srs = useStore((s) => s.srs);
  const favorites = useStore((s) => s.favorites);
  const saveCustomTest = useStore((s) => s.saveCustomTest);
  const deleteCustomTest = useStore((s) => s.deleteCustomTest);
  const setView = useStore((s) => s.setView);
  const [building, setBuilding] = React.useState(false);

  function runQuick(id: string) {
    let ids: string[] = [];
    let name = "";
    if (id === "mistakes") { ids = Object.values(srs).filter((r) => r.leeched || r.wrong > 0).map((r) => r.id); name = "My Mistakes"; }
    if (id === "hard10") { ids = verbs.filter((v) => v.additional_info.difficulty === "hard").map((v) => v.id).sort(() => Math.random() - 0.5).slice(0, 10); name = "10 Random Hard Words"; if (!ids.length) ids = verbs.slice(0, 10).map((v) => v.id); }
    if (id === "yesterday") { ids = verbs.slice(0, 15).map((v) => v.id); name = "Yesterday's Words"; }
    if (!ids.length) { toast("No words found for that quick test."); return; }
    useStore.getState().startQuiz(ids, name, ["meaning", "past_form", "third_form", "sindhi_to_english", "true_false"]);
  }

  function startExisting(t: CustomTest) {
    useStore.getState().startQuiz(t.wordIds, t.name, t.questionTypes, t.examMode);
  }
  function share(t: CustomTest) {
    const code = btoa(JSON.stringify(t)).slice(0, 24);
    const text = `VerbMaster test "${t.name}" — code: ${code}. Import via the app's Custom Tests → Import.`;
    if (navigator.share) navigator.share({ title: "VerbMaster test", text }).catch(() => {});
    else { navigator.clipboard?.writeText(text); toast.success("Share code copied!"); }
  }
  function importCode() {
    const code = prompt("Paste a VerbMaster test code:");
    if (!code) return;
    try {
      const t = JSON.parse(atob(code)) as CustomTest;
      saveCustomTest({ ...t, id: "import-" + Date.now() });
      toast.success("Test imported!");
    } catch { toast.error("Invalid code."); }
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <header className="flex items-center gap-2">
        <button onClick={() => setView("more")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold flex-1">Custom Tests</h1>
        <Button onClick={importCode} variant="outline" size="sm" className="rounded-xl"><Upload className="h-4 w-4" /> Import</Button>
      </header>

      <Card className="p-4 rounded-2xl shadow-soft">
        <h2 className="font-semibold mb-2">Quick create</h2>
        <div className="space-y-2">
          {QUICK.map((q) => <Button key={q.id} onClick={() => runQuick(q.id)} variant="outline" className="w-full rounded-xl justify-start">{q.label}</Button>)}
        </div>
      </Card>

      <Button onClick={() => setBuilding(true)} className="w-full rounded-2xl h-12"><Plus className="h-5 w-5" /> Build a custom test</Button>

      {profile.customTests.length === 0 ? (
        <Card className="p-6 text-center rounded-2xl text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
          No saved tests yet. Build one above.
        </Card>
      ) : (
        <div className="space-y-2">
          {profile.customTests.map((t) => (
            <Card key={t.id} className="p-3 rounded-2xl shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.wordIds.length} words · {t.questionTypes.length} types · {t.difficulty} {t.examMode ? "· 🔒 exam" : ""}</div>
                </div>
                <div className="flex gap-1">
                  <Button onClick={() => startExisting(t)} size="sm" className="rounded-xl"><Play className="h-4 w-4" /></Button>
                  <Button onClick={() => share(t)} size="sm" variant="outline" className="rounded-xl"><Share2 className="h-4 w-4" /></Button>
                  <Button onClick={() => deleteCustomTest(t.id)} size="sm" variant="outline" className="rounded-xl text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {building && <Builder onClose={() => setBuilding(false)} onSave={(t) => { saveCustomTest(t); setBuilding(false); toast.success("Test saved!"); }} verbs={verbs} favorites={Array.from(favorites)} srs={srs} />}
    </div>
  );
}

function Builder({ onClose, onSave, verbs, favorites, srs }: { onClose: () => void; onSave: (t: CustomTest) => void; verbs: any[]; favorites: string[]; srs: any }) {
  const [name, setName] = React.useState("My custom test");
  const [source, setSource] = React.useState<"chapters" | "favorites" | "weak" | "mastered" | "irregular" | "random">("weak");
  const [rangeStart, setRangeStart] = React.useState("A");
  const [rangeEnd, setRangeEnd] = React.useState("F");
  const [count, setCount] = React.useState(10);
  const [types, setTypes] = React.useState<QuizType[]>(["meaning", "past_form", "true_false"]);
  const [difficulty, setDifficulty] = React.useState<Difficulty | "mixed">("mixed");
  const [examMode, setExamMode] = React.useState(false);

  function toggleType(t: QuizType) { setTypes((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]); }

  function buildWordIds(): string[] {
    let pool: any[] = [];
    if (source === "chapters") {
      const letters = new Set<string>();
      const start = rangeStart.charCodeAt(0), end = rangeEnd.charCodeAt(0);
      for (let c = start; c <= end; c++) letters.add(String.fromCharCode(c));
      pool = verbs.filter((v) => letters.has(v.chapter));
    } else if (source === "favorites") pool = verbs.filter((v) => favorites.includes(v.id));
    else if (source === "weak") pool = verbs.filter((v) => srs[v.id]?.leeched || srs[v.id]?.status === "review");
    else if (source === "mastered") pool = verbs.filter((v) => srs[v.id]?.status === "mastered");
    else if (source === "irregular") pool = verbs.filter((v) => v.additional_info.irregular);
    else pool = verbs;
    if (difficulty !== "mixed") pool = pool.filter((v) => v.additional_info.difficulty === difficulty);
    pool = pool.sort(() => Math.random() - 0.5).slice(0, count);
    return pool.map((v) => v.id);
  }

  function save() {
    if (!types.length) { toast.error("Pick at least one question type."); return; }
    const ids = buildWordIds();
    if (!ids.length) { toast.error("No words match that source."); return; }
    onSave({ id: "test-" + Date.now(), name, source: source === "chapters" ? `Chapters ${rangeStart}-${rangeEnd}` : source, wordIds: ids, questionTypes: types, count, difficulty, timeMode: "none", timeValue: 0, examMode, createdAt: Date.now() });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-end sm:place-items-center" onClick={onClose}>
      <div className="bg-background w-full max-w-2xl rounded-t-3xl sm:rounded-3xl p-4 max-h-[90vh] overflow-y-auto scroll-soft" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-3">Build a custom test</h2>
        <label className="text-sm font-semibold">Test name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="mb-3 rounded-xl" />
        <label className="text-sm font-semibold">Word source</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[["chapters", "Chapters"], ["favorites", "Favorites"], ["weak", "Weak"], ["mastered", "Mastered"], ["irregular", "Irregular"], ["random", "Random"]].map(([id, l]) => (
            <button key={id} onClick={() => setSource(id as any)} className={cn("p-2 rounded-xl text-sm border-2", source === id ? "border-primary bg-primary/10" : "border-border")}>{l}</button>
          ))}
        </div>
        {source === "chapters" && (
          <div className="flex items-center gap-2 mb-3">
            <select value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="rounded-xl border p-2 bg-card">{"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => <option key={c}>{c}</option>)}</select>
            <span>to</span>
            <select value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="rounded-xl border p-2 bg-card">{"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => <option key={c}>{c}</option>)}</select>
          </div>
        )}
        <label className="text-sm font-semibold">Number of questions</label>
        <div className="flex gap-2 mb-3">
          {[5, 10, 20, 50, 100].map((n) => <button key={n} onClick={() => setCount(n)} className={cn("px-3 py-1.5 rounded-xl text-sm border-2", count === n ? "border-primary bg-primary/10" : "border-border")}>{n}</button>)}
        </div>
        <label className="text-sm font-semibold">Question types</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {TYPES.map((t) => (
            <button key={t.id} onClick={() => toggleType(t.id)} className={cn("p-2 rounded-xl text-xs border-2", types.includes(t.id) ? "border-primary bg-primary/10" : "border-border")}>{t.label}</button>
          ))}
        </div>
        <label className="text-sm font-semibold">Difficulty</label>
        <div className="flex gap-2 mb-3">
          {["easy", "medium", "hard", "mixed"].map((d) => <button key={d} onClick={() => setDifficulty(d as any)} className={cn("px-3 py-1.5 rounded-xl text-sm border-2 capitalize", difficulty === d ? "border-primary bg-primary/10" : "border-border")}>{d}</button>)}
        </div>
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={examMode} onChange={(e) => setExamMode(e.target.checked)} /> Lock in Exam Mode (hide nav, block back)
        </label>
        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl">Cancel</Button>
          <Button onClick={save} className="flex-1 rounded-xl">Save test</Button>
        </div>
      </div>
    </div>
  );
}
