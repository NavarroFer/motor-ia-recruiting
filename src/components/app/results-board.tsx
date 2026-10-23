"use client";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, CircleHelp, Sparkles, X } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import type { ReqCheck, Result, SearchOutput } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CandidatePanel } from "@/app/(app)/search/candidate-panel";
import { cn } from "@/lib/utils";

export type Decision = "selected" | "shortlisted" | "discarded";
export type Explanation = { match: string[]; gaps: string[]; summary: string; by: "ai" | "rules" | "cache" };

/** Tablero de resultados: lo usan la búsqueda libre y el detalle de una vacante. */
export function ResultsBoard({ data, t, lang, canDecide, locked }: { data: SearchOutput; t: Dict; lang: Lang; canDecide: boolean; locked?: boolean }) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [expl, setExpl] = useState<Record<string, Explanation | "loading">>({});
  const [tab, setTab] = useState<"all" | Decision>("all");
  const [openNot, setOpenNot] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const [reason, setReason] = useState<{ ids: string[]; status: Decision } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const decideAllowed = canDecide && !locked;

  // Decisiones previas (vacantes) + explicaciones del top 10 en segundo plano
  useEffect(() => {
    let alive = true;
    fetch(`/api/decisions?searchId=${data.searchId}`).then((r) => r.json()).then((j) => {
      if (!alive) return;
      setDecisions(Object.fromEntries((j.decisions ?? []).map((d: { candidate_id: string; status: Decision }) => [d.candidate_id, d.status])));
    });
    const queue = data.results.slice(0, 10).map((r) => r.candidateId);
    const worker = async () => {
      while (queue.length && alive) {
        const id = queue.shift()!;
        setExpl((e) => ({ ...e, [id]: "loading" }));
        const r = await fetch("/api/explain", { method: "POST", body: JSON.stringify({ searchId: data.searchId, candidateId: id, lang }) });
        const x = r.ok ? ((await r.json()) as Explanation) : null;
        if (alive) setExpl((e) => { const n = { ...e }; if (x) n[id] = x; else delete n[id]; return n; });
      }
    };
    worker(); worker(); worker();
    return () => { alive = false; };
  }, [data, lang]);

  const decide = async (ids: string[], status: Decision | "none", opts?: { againstAi?: boolean; reason?: string }) => {
    const res = await fetch("/api/decisions", {
      method: "POST",
      body: JSON.stringify({ searchId: data.searchId, candidateIds: ids, status, againstAi: !!opts?.againstAi, reason: opts?.reason }),
    });
    if (!res.ok) return;
    setDecisions((d) => {
      const n = { ...d };
      for (const id of ids) { if (status === "none") delete n[id]; else n[id] = status; }
      return n;
    });
  };
  const onAction = (r: Result, status: Decision) => {
    if (decisions[r.candidateId] === status) return decide([r.candidateId], "none");
    if (!r.meetsMandatory && status !== "discarded") { setReason({ ids: [r.candidateId], status }); setReasonText(""); return; }
    decide([r.candidateId], status);
  };
  const visible = (list: Result[]) => (tab === "all" ? list : list.filter((r) => decisions[r.candidateId] === tab));
  const count = (s: Decision) => Object.values(decisions).filter((d) => d === s).length;

  return (
    <>
      <div className="flex gap-1 border-b">
        {(["all", "shortlisted", "selected", "discarded"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === k ? "border-primary font-medium" : "border-transparent text-muted-foreground")}>
            {t.search.tabs[k]} {k !== "all" && <span className="text-xs">({count(k)})</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {visible(data.results).length === 0 && tab === "all" && <p className="text-sm text-muted-foreground">{t.search.empty}</p>}
        {visible(data.results).map((r, i) => (
          <ResultCard key={r.candidateId} r={r} rank={i + 1} t={t} expl={expl[r.candidateId]} decision={decisions[r.candidateId]}
            canDecide={decideAllowed} onAction={(s) => onAction(r, s)} onOpen={() => setPanel(r.candidateId)} />
        ))}
      </div>

      {data.notMeeting.length > 0 && (
        <div className="rounded-lg border border-dashed">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setOpenNot(!openNot)} className="flex items-center gap-2 text-sm font-medium">
              {openNot ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              {t.search.notMeeting} ({data.notMeeting.length})
              <Badge variant="muted"><Sparkles /> {t.search.aiTag}</Badge>
            </button>
            {decideAllowed && <Button size="sm" variant="destructive" onClick={() => decide(data.notMeeting.map((r) => r.candidateId), "discarded")}>{t.search.discardAll}</Button>}
          </div>
          {openNot && (
            <div className="flex flex-col gap-2 px-4 pb-4">
              {visible(data.notMeeting).map((r) => (
                <ResultCard key={r.candidateId} r={r} t={t} compact decision={decisions[r.candidateId]} canDecide={decideAllowed}
                  onAction={(s) => onAction(r, s)} onOpen={() => setPanel(r.candidateId)} />
              ))}
            </div>
          )}
        </div>
      )}

      {panel && <CandidatePanel id={panel} t={t} lang={lang} onClose={() => setPanel(null)} explanation={expl[panel]} />}

      <Dialog open={!!reason} onOpenChange={(o) => !o && setReason(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.search.reasonTitle}</DialogTitle>
            <DialogDescription>{t.search.reasonHelp}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {t.search.reasonQuick.map((q) => <button key={q} onClick={() => setReasonText(q)} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">{q}</button>)}
          </div>
          <Textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReason(null)}>{t.search.cancel}</Button>
            <Button disabled={!reasonText.trim()} onClick={async () => { await decide(reason!.ids, reason!.status, { againstAi: true, reason: reasonText }); setReason(null); }}>{t.search.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CheckChip({ c, t }: { c: ReqCheck; t: Dict }) {
  const Icon = c.status === "met" ? Check : c.status === "unmet" ? X : CircleHelp;
  return (
    <span title={c.detail} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
      c.status === "met" ? "bg-success/10 text-success" : c.status === "unmet" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
      <Icon className="size-3" /> {c.label}
      <span className="sr-only">{t.status[c.status]}</span>
      <span className="opacity-70">· {c.detail.replace(/^.*?:\s*/, "")}</span>
    </span>
  );
}

function ResultCard({ r, rank, t, expl, decision, canDecide, onAction, onOpen, compact }: {
  r: Result; rank?: number; t: Dict; expl?: Explanation | "loading"; decision?: Decision; canDecide: boolean;
  onAction: (s: Decision) => void; onOpen: () => void; compact?: boolean;
}) {
  const failed = r.checks.filter((c) => c.mandatory && c.status === "unmet");
  return (
    <div className={cn("flex gap-4 rounded-lg border bg-card p-4", decision === "discarded" && "opacity-50")}>
      {!compact && (
        <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-md bg-muted">
          <div className="font-display text-2xl font-semibold">{r.score}</div>
          <div className="text-[10px] uppercase text-muted-foreground">#{rank}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <button onClick={onOpen} className="text-left">
            <div className="font-medium hover:underline">{r.headline}</div>
            <div className="text-xs text-muted-foreground">{[r.seniority, `${r.totalYears.toLocaleString()} ${t.search.years}`, r.country, r.workMode].filter(Boolean).join(" · ")}</div>
          </button>
          {decision && <Badge variant={decision === "discarded" ? "destructive" : "default"}>{t.search.tabs[decision]}</Badge>}
        </div>
        {compact && failed.length > 0 ? (
          <div className="text-sm text-destructive">{failed.map((f) => `${f.label}: ${f.detail.replace(/^.*?:\s*/, "")}`).join(" · ")}</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">{r.checks.map((c, i) => <CheckChip key={i} c={c} t={t} />)}</div>
        )}
        {!compact && (
          <div className="text-sm">
            {expl === "loading" && <span className="animate-pulse text-muted-foreground">{t.search.explaining}</span>}
            {expl && expl !== "loading" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-3" /> {expl.by === "rules" ? t.search.rulesTag : t.search.aiTag}</div>
                {expl.match.length > 0 ? (
                  <ul className="list-disc pl-5">{expl.match.map((m, i) => <li key={i}>{m}</li>)}{expl.gaps.map((g, i) => <li key={`g${i}`} className="text-muted-foreground">{g}</li>)}</ul>
                ) : <p className="text-muted-foreground">{expl.summary}</p>}
              </div>
            )}
          </div>
        )}
        {canDecide && (
          <div className="flex gap-2">
            <Button size="sm" variant={decision === "selected" ? "default" : "outline"} onClick={() => onAction("selected")}>{t.search.select}</Button>
            <Button size="sm" variant={decision === "shortlisted" ? "secondary" : "outline"} onClick={() => onAction("shortlisted")}>{t.search.shortlist}</Button>
            <Button size="sm" variant={decision === "discarded" ? "destructive" : "ghost"} onClick={() => onAction("discarded")}>{t.search.discard}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
