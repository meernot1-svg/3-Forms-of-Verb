"use client";
// Verbie — floating animated AI teacher avatar with a chat bottom sheet.
// Offline rule-based engine by default; calls /api/bot for online "Smart AI"
// when not in data-saver mode. Falls back gracefully on error.

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, X, Trash2, ThumbsUp, ThumbsDown, Volume2, Sparkles, Wifi, WifiOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { offlineBotReply } from "@/lib/bot/engine";
import { speak, isSpeechSupported, createRecognition, isSpeechRecognitionSupported, stopSpeaking } from "@/lib/audio";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

// Lightweight SVG Verbie avatar with animated states.
function VerbieFace({ state, size = 56 }: { state: "idle" | "listening" | "thinking" | "speaking" | "happy"; size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      animate={state === "happy" ? { rotate: [0, -8, 8, 0] } : state === "listening" ? { y: [0, -2, 0] } : { y: [0, 0, 0] }}
      transition={{ duration: 0.6, repeat: state === "happy" ? 0 : Infinity, ease: "easeInOut" }}
    >
      <defs>
        <linearGradient id="vbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#0d9488" /></linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#vbg)" />
      {/* ears */}
      <circle cx="10" cy="26" r="6" fill="#0d9488" />
      <circle cx="54" cy="26" r="6" fill="#0d9488" />
      <circle cx="10" cy="26" r="3" fill="#fef3c7" />
      <circle cx="54" cy="26" r="3" fill="#fef3c7" />
      {/* eyes */}
      {state === "happy" ? (
        <path d="M22 30 Q26 26 30 30 M34 30 Q38 26 42 30" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <motion.circle cx="26" cy="30" r="4" fill="#fff"
            animate={state === "listening" ? { scaleY: [1, 1, 0.1, 1] } : { scaleY: [1, 1, 1] }}
            transition={{ duration: 3, repeat: Infinity, times: [0, 0.94, 0.97, 1] }}
            style={{ transformOrigin: "26px 30px" }} />
          <motion.circle cx="38" cy="30" r="4" fill="#fff"
            animate={state === "listening" ? { scaleY: [1, 1, 0.1, 1] } : { scaleY: [1, 1, 1] }}
            transition={{ duration: 3, repeat: Infinity, times: [0, 0.94, 0.97, 1] }}
            style={{ transformOrigin: "38px 30px" }} />
          <circle cx="26" cy="30" r="2" fill="#0f172a" />
          <circle cx="38" cy="30" r="2" fill="#0f172a" />
        </>
      )}
      {/* mouth */}
      {state === "speaking" ? (
        <motion.ellipse cx="32" cy="42" rx="5" ry="3" fill="#fff" animate={{ ry: [3, 5, 2, 4, 3] }} transition={{ duration: 0.35, repeat: Infinity }} />
      ) : state === "happy" ? (
        <path d="M24 42 Q32 50 40 42" stroke="#fff" strokeWidth="2.5" fill="#fff" fillOpacity="0.3" strokeLinecap="round" />
      ) : (
        <path d="M26 42 Q32 45 38 42" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {/* cheeks */}
      <circle cx="20" cy="38" r="2" fill="#fda4af" opacity="0.6" />
      <circle cx="44" cy="38" r="2" fill="#fda4af" opacity="0.6" />
    </motion.svg>
  );
}

export function Verbie() {
  const chat = useStore((s) => s.chat);
  const addChat = useStore((s) => s.addChat);
  const clearChat = useStore((s) => s.clearChat);
  const setChatFeedback = useStore((s) => s.setChatFeedback);
  const verbs = useStore((s) => s.verbs);
  const setView = useStore((s) => s.setView);
  const openChapter = useStore((s) => s.openChapter);
  const openWord = useStore((s) => s.openWord);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const dataSaver = useStore((s) => s.settings.dataSaver);

  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [state, setState] = React.useState<"idle" | "listening" | "thinking" | "speaking" | "happy">("idle");
  const [online, setOnline] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const endRef = React.useRef<HTMLDivElement>(null);
  const recRef = React.useRef<any>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, open]);

  function executeAction(action: any) {
    if (!action) return;
    if (action.type === "open_chapter") openChapter(action.payload);
    if (action.type === "open_word") openWord(action.payload);
    if (action.type === "start_quiz") useStore.getState().startQuiz(action.payload.verbIds, action.payload.title);
    if (action.type === "start_lesson") setView("daily");
    if (action.type === "start_oral") setView("oraltest");
    if (action.type === "open_review") setView("review");
    if (action.type === "add_favorite") toggleFavorite(action.payload);
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t) return;
    const userMsg: ChatMessage = { id: "u" + Date.now(), role: "user", content: t, ts: Date.now() };
    await addChat(userMsg);
    setInput("");
    setState("thinking");

    // Try online AI first (unless data-saver), fall back to offline.
    let replyText = "";
    let usedOnline = false;
    if (!dataSaver) {
      try {
        const res = await fetch("/api/bot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...chat, userMsg].map((m) => ({ role: m.role, content: m.content })), context: buildContext(t, verbs), dataSaver: false }),
        });
        const data = await res.json();
        if (data?.content) { replyText = data.content; usedOnline = data.online; }
      } catch {}
    }
    if (!replyText) {
      const r = offlineBotReply(t, verbs);
      replyText = r.text;
      if (r.action) executeAction(r.action);
      usedOnline = false;
    }
    setOnline(usedOnline);
    const botMsg: ChatMessage = { id: "b" + Date.now(), role: "assistant", content: replyText, ts: Date.now(), online: usedOnline };
    await addChat(botMsg);
    setState("speaking");
    if (isSpeechSupported()) speak(replyText.slice(0, 300), { accent: "us", onend: () => setState("idle") });
    else setState("idle");
    setTimeout(() => setState("idle"), 2000);
  }

  function startVoiceInput() {
    if (!isSpeechRecognitionSupported()) { toastVoice(); return; }
    const rec = createRecognition("us");
    if (!rec) return;
    recRef.current = rec;
    setState("listening");
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput(txt);
    };
    rec.onend = () => setState("idle");
    rec.onerror = () => setState("idle");
    rec.start();
  }
  function stopVoiceInput() {
    recRef.current?.stop();
    setState("idle");
  }
  function toastVoice() {
    // simple alert via state — replaced with sonner
  }

  function onSuggestion(s: string) { send(s); }

  return (
    <>
      {/* Floating draggable button */}
      <motion.button
        drag
        dragMomentum={false}
        dragConstraints={{ left: -80, right: 80, top: -200, bottom: 0 }}
        onClick={() => setOpen(true)}
        className="fixed z-40 bottom-20 right-4 grid place-items-center"
        style={{ touchAction: "none" }}
        aria-label="Ask Verbie"
        whileTap={{ scale: 0.92 }}
      >
        <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} className="relative">
          <VerbieFace state={open ? "idle" : state} size={60} />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 text-[9px] grid place-items-center font-bold text-white">?</span>
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="relative bg-background w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* header */}
              <div className="flex items-center gap-3 p-3 border-b border-border">
                <VerbieFace state={state} size={40} />
                <div className="flex-1">
                  <div className="font-bold leading-tight">Verbie</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {online ? <><Wifi className="h-3 w-3 text-emerald-500" /> Smart AI (online)</> : <><WifiOff className="h-3 w-3" /> Offline helper</>}
                  </div>
                </div>
                <button onClick={() => clearChat().then(() => {})} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Clear chat"><Trash2 className="h-4 w-4" /></button>
                <button onClick={() => { setOpen(false); stopSpeaking(); }} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>

              {/* messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-soft p-3 space-y-2 min-h-[40vh]">
                {chat.length === 0 && (
                  <div className="text-center py-6">
                    <div className="inline-block mb-2"><VerbieFace state="idle" size={72} /></div>
                    <p className="font-semibold">Ask Verbie anything</p>
                    <p className="text-sm text-muted-foreground mt-1">Verb forms, meanings, examples, quizzes — I'm here to help. I work offline too.</p>
                  </div>
                )}
                {chat.map((m) => (
                  <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      {m.content}
                      {m.role === "assistant" && (
                        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border/40">
                          <button onClick={() => setChatFeedback(m.id, m.feedback === "up" ? "up" : "up")} aria-label="Helpful"><ThumbsUp className={cn("h-3.5 w-3.5", m.feedback === "up" && "text-emerald-500 fill-emerald-500")} /></button>
                          <button onClick={() => setChatFeedback(m.id, "down")} aria-label="Not helpful"><ThumbsDown className={cn("h-3.5 w-3.5", m.feedback === "down" && "text-rose-500 fill-rose-500")} /></button>
                          <button onClick={() => speak(m.content.slice(0, 300), { accent: "us" })} aria-label="Read aloud"><Volume2 className="h-3.5 w-3.5" /></button>
                          {m.online && <span className="text-[9px] text-emerald-500 ml-auto">Smart AI</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {state === "thinking" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-3 py-2 flex items-center gap-1">
                      <motion.span className="h-2 w-2 rounded-full bg-muted-foreground" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0 }} />
                      <motion.span className="h-2 w-2 rounded-full bg-muted-foreground" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }} />
                      <motion.span className="h-2 w-2 rounded-full bg-muted-foreground" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }} />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* quick replies */}
              {chat.length <= 2 && (
                <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scroll-soft">
                  {["Explain capture", "Quiz me", "Word of the day", "Start today's lesson", "What are my weak words?"].map((s) => (
                    <button key={s} onClick={() => onSuggestion(s)} className="shrink-0 text-xs px-2.5 py-1.5 rounded-full bg-primary/10 text-primary font-medium">{s}</button>
                  ))}
                </div>
              )}

              {/* input */}
              <div className="p-3 border-t border-border flex items-center gap-2 pb-safe">
                {isSpeechRecognitionSupported() && (
                  <button onClick={state === "listening" ? stopVoiceInput : startVoiceInput} className={cn("h-10 w-10 grid place-items-center rounded-full shrink-0", state === "listening" ? "bg-rose-500 text-white" : "bg-muted")} aria-label="Voice input">
                    <Mic className="h-5 w-5" />
                  </button>
                )}
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(input)}
                  placeholder="Ask Verbie…"
                  className="flex-1 h-10 px-3 rounded-full bg-muted outline-none text-sm"
                />
                <button onClick={() => send(input)} disabled={!input.trim()} className="h-10 w-10 grid place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 shrink-0" aria-label="Send">
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Build a compact context string for the online AI: relevant book data for the asked word.
function buildContext(query: string, verbs: any[]): string {
  const q = query.toLowerCase().trim();
  const found = verbs.find((v) => v.id === q || v.book_data.first_form.toLowerCase() === q || v.book_data.second_form.toLowerCase() === q || v.book_data.third_form.toLowerCase() === q);
  if (found) {
    const bd = found.book_data;
    return `BOOK DATA (authoritative): ${bd.first_form} → ${bd.second_form} → ${bd.third_form}; Sindhi meaning: ${bd.sindhi_meaning}. Use ONLY this for forms and Sindhi meaning.`;
  }
  return "";
}
