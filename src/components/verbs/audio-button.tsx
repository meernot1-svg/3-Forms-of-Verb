"use client";
import * as React from "react";
import { Volume2, Loader2 } from "lucide-react";
import { speak, stopSpeaking, isSpeechSupported, hasVoice } from "@/lib/audio";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  accent?: "uk" | "us";
  label?: string;
  className?: string;
  slow?: boolean;
  size?: "sm" | "md";
}

// Animated audio button. Falls back gracefully if no voice is installed.
export function AudioButton({ text, accent = "us", label, className, slow = false, size = "md" }: Props) {
  const [speaking, setSpeaking] = React.useState(false);
  const supported = React.useMemo(() => isSpeechSupported(), []);
  const voiceMissing = React.useMemo(() => supported && !hasVoice(accent), [supported, accent]);
  const rate = useStore((s) => s.settings.audioRate);
  const animations = useStore((s) => s.settings.animations);

  function onClick() {
    if (!supported) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, {
      accent,
      rate: slow ? Math.max(0.5, rate * 0.6) : rate,
      onend: () => setSpeaking(false),
    });
  }

  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  if (!supported) {
    return (
      <span
        title="Audio not supported on this device"
        className={cn(dim, "inline-grid place-items-center rounded-full bg-muted text-muted-foreground/50", className)}
      >
        <Volume2 className="h-4 w-4" />
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={label || `Play ${accent === "uk" ? "British" : "American"} pronunciation${slow ? " (slow)" : ""}`}
      title={voiceMissing ? `${accent === "uk" ? "British" : "American"} voice not installed on this device` : label}
      className={cn(
        dim,
        "relative inline-grid place-items-center rounded-full transition active:scale-90",
        accent === "uk" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        speaking && "ring-2 ring-primary",
        className,
      )}
    >
      {speaking && animations !== "off" ? (
        <span className="flex items-end gap-0.5 h-4">
          <span className="w-0.5 bg-current rounded animate-[eq1_0.7s_ease-in-out_infinite]" />
          <span className="w-0.5 bg-current rounded animate-[eq2_0.7s_ease-in-out_infinite]" />
          <span className="w-0.5 bg-current rounded animate-[eq3_0.7s_ease-in-out_infinite]" />
          <span className="w-0.5 bg-current rounded animate-[eq4_0.7s_ease-in-out_infinite]" />
        </span>
      ) : (
        <Volume2 className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
      )}
      {slow && <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-background rounded px-0.5 font-bold">🐢</span>}
    </button>
  );
}
