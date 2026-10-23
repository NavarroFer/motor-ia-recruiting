"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dict, Lang } from "@/lib/i18n";
import type { Requirements } from "@/lib/ai/prompts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface O { id: string; title: string; status: "open" | "closed"; created_at: string; matches: number; shortlisted: number; selected: number; requirements: Requirements }

export function OpeningsView({ t, lang, canEdit }: { t: Dict; lang: Lang; canEdit: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<O[] | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const loc = lang === "es" ? "es-AR" : "en-US";

  useEffect(() => { fetch("/api/openings").then((r) => r.json()).then((j) => setList(j.openings)); }, []);

  const create = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/openings", { method: "POST", body: JSON.stringify({ title, description: desc }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error);
    router.push(`/openings/${j.id}`);
  };

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t.nav.openings}</h1>
        {canEdit && <Button onClick={() => setOpen(true)}>{t.open.new}</Button>}
      </div>

      {list && list.length === 0 && <p className="text-sm text-muted-foreground">{t.open.none}</p>}
      <div className="grid grid-cols-2 gap-4">
        {list?.map((o) => (
          <Link key={o.id} href={`/openings/${o.id}`} className={cn("flex flex-col gap-3 rounded-lg border bg-card p-5 hover:border-primary", o.status === "closed" && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div className="font-display text-lg font-semibold">{o.title}</div>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", o.status === "open" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{t.open.status[o.status]}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {o.requirements.mandatory.map((r, i) => <span key={i} className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">{r.label}</span>)}
              {o.requirements.nice_to_have.map((r, i) => <span key={`n${i}`} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{r.label}</span>)}
            </div>
            <div className="flex gap-4 text-sm">
              <span><b className="font-display text-lg">{o.matches}</b> <span className="text-muted-foreground">{t.open.matches}</span></span>
              <span><b className="font-display text-lg">{o.shortlisted}</b> <span className="text-muted-foreground">{t.open.shortlisted}</span></span>
              <span><b className="font-display text-lg">{o.selected}</b> <span className="text-muted-foreground">{t.open.selected}</span></span>
            </div>
            <div className="text-xs text-muted-foreground">{t.open.created} {new Date(o.created_at).toLocaleDateString(loc)}</div>
          </Link>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t.open.new}</DialogTitle></DialogHeader>
          <label className="flex flex-col gap-1 text-sm">{t.open.title}<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.open.titlePh} /></label>
          <label className="flex flex-col gap-1 text-sm">{t.open.desc}<Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t.open.descPh} className="min-h-48" /></label>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t.search.cancel}</Button>
            <Button disabled={busy || title.length < 3 || desc.length < 10} onClick={create}>{busy ? t.open.creating : t.open.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
