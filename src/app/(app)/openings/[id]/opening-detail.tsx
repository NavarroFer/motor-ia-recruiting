"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Requirements } from "@/lib/ai/prompts";
import type { SearchOutput } from "@/lib/search";
import type { Opening } from "@/lib/openings";
import { Button } from "@/components/ui/button";
import { RequirementsEditor } from "@/components/app/requirements-editor";
import { ResultsBoard } from "@/components/app/results-board";
import { SearchInfo } from "@/app/(app)/search/search-view";
import { cn } from "@/lib/utils";

export function OpeningDetail({ id, t, lang, canEdit }: { id: string; t: Dict; lang: Lang; canEdit: boolean }) {
  const [opening, setOpening] = useState<Opening | null>(null);
  const [ranking, setRanking] = useState<SearchOutput | null>(null);
  const [reqs, setReqs] = useState<Requirements | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [busy, setBusy] = useState(false);
  const loc = lang === "es" ? "es-AR" : "en-US";

  const load = useCallback(async () => {
    const r = await fetch(`/api/openings/${id}`);
    if (!r.ok) return;
    const j = await r.json();
    setOpening(j.opening); setRanking(j.ranking); setReqs(j.opening.requirements); setDirty(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const patch = async (body: object) => {
    setBusy(true);
    await fetch(`/api/openings/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setBusy(false);
    load();
  };

  if (!opening || !ranking || !reqs) return <div className="h-40 max-w-6xl animate-pulse rounded-lg bg-muted" />;
  const closed = opening.status === "closed";

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <Link href="/openings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> {t.nav.openings}</Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{opening.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn("rounded-full px-2 py-0.5 text-xs", closed ? "bg-muted" : "bg-success/10 text-success")}>{t.open.status[opening.status]}</span>
            {t.open.created} {new Date(opening.created_at).toLocaleDateString(loc)}
          </div>
        </div>
        {canEdit && (
          <Button variant={closed ? "outline" : "destructive"} disabled={busy} onClick={() => patch({ status: closed ? "open" : "closed" })}>
            {closed ? t.open.reopen : t.open.close}
          </Button>
        )}
      </div>

      {closed && opening.retention_until && (
        <p className="rounded-lg bg-muted p-3 text-sm">{t.open.closedInfo.replace("{date}", new Date(opening.retention_until).toLocaleDateString(loc))}</p>
      )}

      <div className="rounded-lg border bg-card">
        <button onClick={() => setShowDesc(!showDesc)} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium">
          {showDesc ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />} {t.open.showDesc}
        </button>
        {showDesc && <p className="whitespace-pre-wrap px-4 pb-4 text-sm text-muted-foreground">{opening.description}</p>}
      </div>

      <RequirementsEditor reqs={reqs} t={t} readOnly={!canEdit || closed} onChange={(r) => { setReqs(r); setDirty(true); }}
        footer={<SearchInfo data={ranking} t={t} lang={lang} action={dirty ? <Button size="sm" disabled={busy} onClick={() => patch({ requirements: reqs })}>{t.open.save}</Button> : null} />} />

      <ResultsBoard key={ranking.durationMs + ranking.results.length} data={ranking} t={t} lang={lang} canDecide={canEdit} locked={closed} />
    </div>
  );
}
