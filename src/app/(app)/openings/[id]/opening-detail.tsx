"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Requirements } from "@/lib/ai/prompts";
import type { SearchOutput } from "@/lib/search";
import type { Opening } from "@/lib/openings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/page-header";
import { RequirementsEditor } from "@/components/app/requirements-editor";
import { ResultsBoard } from "@/components/app/results-board";
import { SearchInfo } from "@/app/(app)/search/search-view";
import { OpeningStatus, fmtDate } from "../openings-view";
import { cn } from "@/lib/utils";

export function OpeningDetail({ id, t, lang, canEdit }: { id: string; t: Dict; lang: Lang; canEdit: boolean }) {
  const [opening, setOpening] = useState<Opening | null>(null);
  const [ranking, setRanking] = useState<SearchOutput | null>(null);
  const [reqs, setReqs] = useState<Requirements | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/openings/${id}`);
    if (!r.ok) return;
    const j = await r.json();
    setOpening(j.opening); setRanking(j.ranking); setReqs(j.opening.requirements); setDirty(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // El aviso "Requisitos guardados" se va solo.
  useEffect(() => {
    if (!saved) return;
    const h = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(h);
  }, [saved]);

  const patch = async (body: object) => {
    setBusy(true);
    const r = await fetch(`/api/openings/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await load();
    setBusy(false);
    return r.ok;
  };
  const saveReqs = async () => { setSaved(false); if (await patch({ requirements: reqs })) setSaved(true); };
  const closeOpening = async () => { setConfirmClose(false); await patch({ status: "closed" }); };

  if (!opening || !ranking || !reqs) {
    return (
      <div className="flex max-w-6xl flex-col gap-5" aria-busy>
        <div className="h-9 w-80 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-14 animate-pulse rounded-xl border bg-card" />
        <div className="h-32 animate-pulse rounded-xl border bg-card" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  const closed = opening.status === "closed";

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <Link href="/openings" className="-mb-2 flex w-fit items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft className="size-3.5" /> {t.nav.openings}
      </Link>

      <PageHeader
        title={opening.title}
        sub={`${t.open.created} ${fmtDate(opening.created_at, lang)}`}
        actions={
          <>
            <OpeningStatus status={opening.status} t={t} className="min-w-23" />
            {canEdit && (
              <Button variant="outline" className="min-w-46 justify-start" disabled={busy} onClick={() => (closed ? patch({ status: "open" }) : setConfirmClose(true))}>
                {closed ? t.open.reopenVacancy : t.open.closeVacancy}
              </Button>
            )}
          </>
        }
      />

      {/* Descripción original del puesto (colapsable) */}
      <section className="rounded-xl border bg-card animate-wt-enter [animation-delay:60ms]">
        <button
          type="button"
          aria-expanded={showDesc}
          onClick={() => setShowDesc(!showDesc)}
          className="group flex w-full items-center justify-between gap-4 rounded-xl px-5 py-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex items-center gap-1.5 text-sm font-bold">
            <ChevronRight className={cn("size-4 transition-transform", showDesc && "rotate-90")} /> {t.open.descLabel}
          </span>
          <span className="text-[13px] text-primary group-hover:underline">{showDesc ? t.open.hideDesc : t.open.viewDesc}</span>
        </button>
        {showDesc && (
          <p className="animate-wt-fade border-t px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{opening.description}</p>
        )}
      </section>

      {/* Requisitos editables + guardar y recalcular (06 / 06b) */}
      <div className="animate-wt-enter [animation-delay:120ms]">
        <RequirementsEditor
          reqs={reqs}
          t={t}
          readOnly={!canEdit || closed}
          onChange={(r) => { setReqs(r); setDirty(true); setSaved(false); }}
          footer={
            <div className="flex flex-col gap-2">
              {dirty && <p className="animate-wt-fade text-[13px] text-warning">{t.open.dirty}</p>}
              {saved && <p role="status" className="animate-wt-fade rounded-md bg-success-bg px-3 py-1.5 text-xs font-bold text-success">✓ {t.open.saved}</p>}
              <SearchInfo
                data={ranking}
                t={t}
                lang={lang}
                action={canEdit ? (
                  <Button className="min-w-48 justify-start" disabled={!dirty || busy || closed} onClick={saveReqs}>
                    {busy && dirty ? t.open.saving : t.open.saveRecalc}
                  </Button>
                ) : null}
              />
            </div>
          }
        />
      </div>

      {/* Vacante cerrada (06c) */}
      {closed && opening.retention_until && (
        <p role="status" className="animate-wt-enter rounded-md bg-warning-bg px-4 py-3 text-[13px] text-warning [animation-delay:160ms]">
          {t.open.closedBanner
            .replace("{closed}", opening.closed_at ? fmtDate(opening.closed_at, lang) : "")
            .replace("{until}", fmtDate(opening.retention_until, lang))}
        </p>
      )}

      {/* Sin animación con transform: el panel del candidato adentro es position:fixed. */}
      <ResultsBoard key={ranking.durationMs + ranking.results.length} data={ranking} t={t} lang={lang} canDecide={canEdit} locked={closed} openingId={opening.id} />

      {/* Confirmar cierre (06d) */}
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="max-w-[580px] gap-0 p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-normal normal-case">{t.open.closeTitle}</DialogTitle>
            <DialogDescription className="mt-3">{t.open.closeBody}</DialogDescription>
          </DialogHeader>
          <p className="mt-5 text-sm text-muted-foreground">{t.open.closeBody2}</p>
          <DialogFooter className="mt-12 gap-3">
            <Button variant="outline" className="min-w-28 justify-start" onClick={() => setConfirmClose(false)}>{t.search.cancel}</Button>
            <Button className="min-w-46 justify-start" disabled={busy} onClick={closeOpening}>{t.open.closeVacancy}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
