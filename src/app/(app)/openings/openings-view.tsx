"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Requirements } from "@/lib/ai/prompts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/page-header";
import { Illo } from "@/components/brand/brand";
import { cn } from "@/lib/utils";

interface O { id: string; title: string; status: "open" | "closed"; created_at: string; matches: number; shortlisted: number; selected: number; new_alerts: number; requirements: Requirements }
type Filter = "open" | "closed" | "all";

/** "Oct 22, 2026" / "22 oct 2026" */
export const fmtDate = (d: string, lang: Lang) =>
  new Date(d).toLocaleDateString(lang === "es" ? "es-AR" : "en-US", { month: "short", day: "numeric", year: "numeric" });

/** Estado de la vacante: siempre punto + texto, verde abierta y rojo cerrada. */
export function OpeningStatus({ status, t, className }: { status: "open" | "closed"; t: Dict; className?: string }) {
  return (
    <Badge variant={status === "open" ? "default" : "destructive"} className={cn("h-7 min-w-20 gap-1.5 px-2.5", className)}>
      <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden />
      {t.open.status[status]}
    </Badge>
  );
}

export function OpeningsView({ t, lang, canEdit }: { t: Dict; lang: Lang; canEdit: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<O[] | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/openings").then((r) => r.json()).then((j) => {
      const all: O[] = j.openings;
      // Arranca en "Abiertas"; si no hay ninguna pero sí cerradas, muestra todas.
      if (!all.some((o) => o.status === "open") && all.length > 0) setFilter("all");
      setList(all);
    });
  }, []);

  const create = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/openings", { method: "POST", body: JSON.stringify({ title, description: desc }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error);
    router.push(`/openings/${j.id}`);
  };

  const counts = {
    open: list?.filter((o) => o.status === "open").length ?? 0,
    closed: list?.filter((o) => o.status === "closed").length ?? 0,
    all: list?.length ?? 0,
  };
  const shown = list?.filter((o) => filter === "all" || o.status === filter) ?? [];
  const newBtn = (label: string) => (
    <Button className="min-w-44 justify-start" onClick={() => setOpen(true)}><Plus /> {label}</Button>
  );

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader title={t.open.heroTitle} sub={t.open.heroSub} actions={canEdit ? newBtn(t.open.newVacancy) : null} />

      <div role="group" aria-label={t.nav.openings} className="flex flex-wrap gap-4 animate-wt-fade">
        {(["open", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "h-7 min-w-28 rounded-md px-2.5 text-left text-xs font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
            )}
          >
            {t.open.filter[f]} <span className="tabular-nums">{list ? counts[f] : "–"}</span>
          </button>
        ))}
      </div>

      {/* Cargando */}
      {!list && (
        <div className="flex flex-col gap-5 pt-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-[150px] animate-pulse rounded-xl border bg-card" />)}
        </div>
      )}

      {/* Sin vacantes (05b) */}
      {list && list.length === 0 && (
        <div className="flex items-center justify-between gap-10 px-[70px] py-28 max-md:flex-col max-md:px-0 max-md:text-center">
          <div className="max-w-md animate-wt-enter">
            <h2 className="text-[26px] leading-tight font-bold">{t.open.emptyTitle}</h2>
            <p className="mt-4 text-[15px] text-muted-foreground">{t.open.emptySub}</p>
            {canEdit && <div className="mt-10">{newBtn(t.open.createFirst)}</div>}
          </div>
          <Illo name="windows" className="w-52 shrink-0 animate-wt-globe [animation-delay:150ms]" />
        </div>
      )}

      {/* Hay vacantes pero ninguna en este filtro */}
      {list && list.length > 0 && shown.length === 0 && (
        <p className="animate-wt-fade py-10 text-sm text-muted-foreground">{t.open.noneInView}</p>
      )}

      {/* Lista (05) */}
      {shown.length > 0 && (
        <ul className="flex flex-col gap-5 pt-3">
          {shown.map((o, i) => {
            const must = o.requirements.mandatory.map((r) => r.label);
            const nice = o.requirements.nice_to_have.length;
            const sub = must.length || nice ? [...must, ...(nice ? [`+${nice} ${t.open.nice}`] : [])].join(" · ") : t.open.noReqs;
            return (
              <li key={`${filter}-${o.id}`} className="animate-wt-enter" style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}>
                <Link
                  href={`/openings/${o.id}`}
                  className={cn(
                    "group grid grid-cols-1 gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:grid-cols-[minmax(0,1fr)_435px]",
                  )}
                >
                  <div className="relative flex min-w-0 flex-col justify-center rounded-xl border bg-card px-6 py-5 pr-12 transition-colors group-hover:border-primary">
                    <h2 className={cn("truncate text-xl font-bold", o.status === "closed" && "text-muted-foreground")}>{o.title}</h2>
                    <p className="mt-2 truncate text-sm text-muted-foreground" title={sub}>{sub}</p>
                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <OpeningStatus status={o.status} t={t} />
                      {o.new_alerts > 0 && <Badge variant="selected" className="h-7 px-2.5">{o.new_alerts} {t.learn.newAlerts}</Badge>}
                      <span className="text-[13px] text-muted-foreground">{t.open.created} {fmtDate(o.created_at, lang)}</span>
                    </div>
                    <ArrowUpRight aria-hidden className="absolute top-6 right-5 size-5 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      [o.matches, t.open.kpi.eligible],
                      [o.shortlisted, t.open.kpi.shortlisted],
                      [o.selected, t.open.kpi.selected],
                    ] as const).map(([n, label], step) => (
                      <div key={label} className={cn("flex min-w-0 flex-col items-center justify-center rounded-xl border border-primary/10 px-2 py-5 text-center transition-colors group-hover:border-primary", ["bg-primary/10 text-forest", "bg-primary/30 text-forest", "bg-primary text-white"][step])}>
                        <span className="inline-flex size-[72px] items-center justify-center text-[32px] leading-none font-bold tabular-nums">{n}</span>
                        <span className="mt-3 text-[13px]">{label}</span>
                      </div>
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Crear vacante (05c) y análisis de requisitos (05d) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[580px] gap-0 p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-normal normal-case">{t.open.createTitle}</DialogTitle>
            <DialogDescription className="mt-2">{t.open.createSub}</DialogDescription>
          </DialogHeader>
          <label className="mt-6 flex flex-col gap-2 text-[13px] font-bold">
            {t.open.title}
            <Input value={title} readOnly={busy} onChange={(e) => setTitle(e.target.value)} placeholder={t.open.titlePh} className="bg-paper font-normal" />
          </label>
          <label className="mt-6 flex flex-col gap-2 text-[13px] font-bold">
            {t.open.descLabel}
            <Textarea value={desc} readOnly={busy} onChange={(e) => setDesc(e.target.value)} placeholder={t.open.descPh} className="max-h-[40vh] min-h-32 bg-paper font-normal" />
          </label>
          {err && <p role="alert" className="mt-5 rounded-md bg-destructive-bg px-3 py-2 text-xs font-bold text-destructive animate-wt-fade">× {err}</p>}
          {busy ? (
            <div role="status" aria-live="polite" className="mt-8 flex items-center gap-3 animate-wt-fade">
              {/* Reloj de arena que se da vuelta a saltos (motion de marca: steps). */}
              <span className="block w-10 shrink-0 animate-spin" style={{ animationDuration: "2.4s", animationTimingFunction: "steps(2, end)" }}>
                <Illo name="hourglass" className="w-full" />
              </span>
              <div>
                <p className="text-sm font-bold text-primary">{t.open.analyzing}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{t.open.analyzingSub}</p>
              </div>
            </div>
          ) : (
            <DialogFooter className="mt-12 gap-3">
              <Button variant="outline" className="min-w-28 justify-start" onClick={() => setOpen(false)}>{t.search.cancel}</Button>
              <Button className="min-w-44 justify-start" disabled={title.length < 3 || desc.length < 10} onClick={create}>{t.open.createVacancy}</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
