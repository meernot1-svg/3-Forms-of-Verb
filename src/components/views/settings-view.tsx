"use client";
import * as React from "react";
import { ChevronLeft, Bell, Palette, Type, Zap, Save, Trash2, Download, Upload } from "lucide-react";
import { useStore, DEFAULT_SETTINGS } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const setView = useStore((s) => s.setView);

  function exportBackup() {
    const data = { settings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "verbmaster-backup.json"; a.click();
    URL.revokeObjectURL(url);
  }
  async function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const txt = await f.text();
      const data = JSON.parse(txt);
      if (data.settings) await update(data.settings);
      toast.success("Backup restored.");
    } catch { toast.error("Invalid backup file."); }
  }
  async function clearAll() {
    if (!confirm("Erase all local progress? This can't be undone.")) return;
    const db = (await import("@/lib/dexie")).getDb();
    await db.srs.clear(); await db.favorites.clear(); await db.notes.clear(); await db.mistakes.clear();
    await db.reports.clear(); await db.chat.clear(); await db.customTests.clear(); await db.dailyLog.clear();
    await db.profile.clear(); await db.settings.clear();
    location.reload();
  }

  async function askNotifications() {
    if (!("Notification" in window)) { toast("Notifications not supported on this device."); return; }
    const perm = await Notification.requestPermission();
    if (perm === "granted") toast.success("Notifications enabled — we'll gently remind you to study.");
    else toast("Notifications blocked — we'll show in-app reminders instead.");
    update({ reminders: { ...settings.reminders, enabled: perm === "granted" } });
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 space-y-3">
      <header className="flex items-center gap-2">
        <button onClick={() => setView("more")} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      <Section icon={<Bell className="h-4 w-4" />} title="Reminders">
        <Row label="Enable smart reminders">
          <Switch checked={settings.reminders.enabled} onCheckedChange={(v) => update({ reminders: { ...settings.reminders, enabled: v } })} />
        </Row>
        <Button onClick={askNotifications} variant="outline" size="sm" className="rounded-xl w-full mt-2">Ask for notification permission</Button>
        <p className="text-xs text-muted-foreground mt-1">We only ask after you've completed a lesson. If blocked or unsupported, in-app reminders + a badge are used instead — the app never crashes.</p>
        <p className="text-xs text-muted-foreground">iPhone: install to Home Screen (iOS 16.4+) for web notifications. True device lock needs a native wrapper (Capacitor) — see README.</p>
      </Section>

      <Section icon={<Palette className="h-4 w-4" />} title="Appearance">
        <Row label="Theme">
          <Select value={settings.theme} onValueChange={(v) => update({ theme: v as any })}>
            <SelectTrigger className="w-32 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="auto">Auto</SelectItem></SelectContent>
          </Select>
        </Row>
        <Row label="Large text">
          <Switch checked={settings.largeText} onCheckedChange={(v) => update({ largeText: v })} />
        </Row>
        <Row label="High contrast">
          <Switch checked={settings.highContrast} onCheckedChange={(v) => update({ highContrast: v })} />
        </Row>
      </Section>

      <Section icon={<Zap className="h-4 w-4" />} title="Animations & motion">
        <div className="flex gap-2">
          {["full", "reduced", "off"].map((m) => (
            <button key={m} onClick={() => update({ animations: m as any })} className={cn("flex-1 p-2 rounded-xl text-sm border-2 capitalize", settings.animations === m ? "border-primary bg-primary/10" : "border-border")}>{m}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Reduced/off respects your device and data-saver. Confetti and transitions become simple fades.</p>
      </Section>

      <Section icon={<Type className="h-4 w-4" />} title="Learning">
        <Row label="Daily goal (words)">
          <Select value={String(settings.dailyGoal)} onValueChange={(v) => update({ dailyGoal: parseInt(v) })}>
            <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{[5, 10, 15, 20, 30].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </Row>
        <Row label="New words per lesson">
          <Select value={String(settings.newWordsPerLesson)} onValueChange={(v) => update({ newWordsPerLesson: parseInt(v) })}>
            <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{[5, 10, 15, 20].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </Row>
        <Row label="Language mode">
          <Select value={settings.languageMode} onValueChange={(v) => update({ languageMode: v as any })}>
            <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="english">English only</SelectItem>
              <SelectItem value="english_sindhi">English + Sindhi</SelectItem>
              <SelectItem value="sindhi_english">Sindhi → English</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Audio speed">
          <Select value={String(settings.audioRate)} onValueChange={(v) => update({ audioRate: parseFloat(v) })}>
            <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{["0.7", "0.85", "1", "1.15"].map((n) => <SelectItem key={n} value={n}>{n}×</SelectItem>)}</SelectContent>
          </Select>
        </Row>
        <Row label="Data saver (disables online AI)">
          <Switch checked={settings.dataSaver} onCheckedChange={(v) => update({ dataSaver: v })} />
        </Row>
      </Section>

      <Section icon={<Save className="h-4 w-4" />} title="Backup & data">
        <div className="flex gap-2">
          <Button onClick={exportBackup} variant="outline" className="flex-1 rounded-xl"><Download className="h-4 w-4" /> Export</Button>
          <label className="flex-1">
            <Button asChild variant="outline" className="w-full rounded-xl"><span><Upload className="h-4 w-4" /> Import</span></Button>
            <input type="file" accept="application/json" className="hidden" onChange={importBackup} />
          </label>
        </div>
        <Button onClick={clearAll} variant="outline" className="w-full rounded-xl text-rose-600 mt-2"><Trash2 className="h-4 w-4" /> Erase all local data</Button>
      </Section>
      <p className="text-center text-xs text-muted-foreground pb-2">VerbMaster · No login · No ads · Data stays on your device</p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 rounded-2xl shadow-soft space-y-2">
      <h2 className="font-semibold flex items-center gap-2">{icon} {title}</h2>
      {children}
    </Card>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between py-1.5"><span className="text-sm">{label}</span>{children}</div>;
}
