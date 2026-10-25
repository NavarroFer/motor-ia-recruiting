"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DocStatus } from "@/components/app/doc-status";
import { PageHeader } from "@/components/app/page-header";
import { MetricNumber } from "@/components/brand/metric-number";
import { Illo } from "@/components/brand/brand";
import { BrandIcon, type BrandIconName } from "@/components/brand/icons";
import { cn } from "@/lib/utils";

interface Settings { apiEnabled: boolean; autoProcess: boolean; monthlyBudgetUsd: number; keys: { anthropic: boolean; openai: boolean } }
interface Usage {
  budget: { budgetUsd: number; spentUsd: number; remainingUsd: number; pct: number; level: string };
  byKind: { kind: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }[];
  documents: Record<string, number>;
}
interface Doc { id: string; file_name: string; status: string }

// Pasos del pipeline. El documento pasa por received → extracting → structuring → indexed;
// la anonimización corre sincrónica justo antes de la llamada al modelo, ya dentro de "structuring".
const STEPS = ["received", "extract", "anonymize", "structure", "index"] as const;
const STEP_ICON: Record<(typeof STEPS)[number], BrandIconName> = { received: "disk", extract: "document", anonymize: "keys", structure: "computer", index: "globe" };
const STAGE_BY_STATUS: Record<string, number> = { extracting: 1, structuring: 3, indexed: 4, duplicate: 4 };
type StepState = "todo" | "doing" | "done" | "failed" | "blocked";
interface Run {
  phase: "running" | "done" | "failed" | "waiting" | "empty" | "error";
  stage: number; // pasos completos (0..STEPS.length)
  startedAt: number;
  docId?: string;
  fileName?: string;
  durationMs?: number;
  message?: string;
  waiting?: "api_disabled" | "budget_exhausted";
  duplicate?: boolean;
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
const compactMoney = (n: number) => `$${n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const Glyph = ({ children, className }: { children: React.ReactNode; className?: string }) => <span aria-hidden className={cn("inline-block leading-none", className)}>{children}</span>;

/** Interruptor accesible (role=switch) con el look de la marca. */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none", checked ? "border-primary bg-primary" : "border-border bg-muted")}
    >
      <span className={cn("block size-3.5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-[17px]" : "translate-x-[2px]")} />
    </button>
  );
}

/** Marca de estado del paso con los glifos del mockup: ✓ hecho, ◌ en curso, ○ pendiente, × error, ! en espera. */
function StepMark({ state }: { state: StepState }) {
  const box = "grid size-5 shrink-0 place-items-center rounded-sm text-xs font-bold";
  if (state === "done") return <span aria-hidden className={cn(box, "animate-in bg-primary text-primary-foreground duration-300 fade-in zoom-in-50")}>✓</span>;
  if (state === "doing") return <span aria-hidden className={cn(box, "text-primary")}><Glyph className="animate-spin text-base [animation-duration:2.2s]">◌</Glyph></span>;
  if (state === "failed") return <span aria-hidden className={cn(box, "animate-in bg-destructive-bg text-destructive duration-300 fade-in zoom-in-50")}>×</span>;
  if (state === "blocked") return <span aria-hidden className={cn(box, "animate-in bg-warning-bg text-warning duration-300 fade-in")}>!</span>;
  return <span aria-hidden className={cn(box, "text-sm font-normal text-muted-foreground/60")}>○</span>;
}

export function UsageView({ t, lang }: { t: Dict; lang: Lang }) {
  const [s, setS] = useState<Settings | null>(null);
  const [u, setU] = useState<Usage | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [budget, setBudget] = useState("");
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState("");
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(0);
  const runRef = useRef<Run | null>(null);
  const budgetInput = useRef<HTMLInputElement>(null);
  const loc = lang === "es" ? "es-AR" : "en-US";
  const money = (n: number, max = 2) => n.toLocaleString(loc, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: max });
  useEffect(() => { runRef.current = run; }, [run]);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([fetch("/api/admin/settings"), fetch("/api/admin/usage"), fetch("/api/documents")]);
    const sj = (await a.json()) as Settings;
    setS(sj);
    setBudget((b0) => b0 || String(sj.monthlyBudgetUsd));
    setU(await b.json());
    setDocs((await c.json()).documents);
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  // Mientras procesa: lee el estado real del documento cada ~0,4 s para avanzar los pasos en vivo.
  const phase = run?.phase;
  useEffect(() => {
    if (phase !== "running") return;
    let alive = true;
    const tick = async () => {
      try {
        const list = ((await (await fetch("/api/documents")).json()).documents ?? []) as Doc[];
        if (!alive) return;
        setRun((p) => {
          if (!p || p.phase !== "running") return p;
          const d = p.docId ? list.find((x) => x.id === p.docId) : list.find((x) => x.status === "extracting" || x.status === "structuring");
          if (!d) return p;
          return { ...p, docId: d.id, fileName: d.file_name, stage: Math.max(p.stage, STAGE_BY_STATUS[d.status] ?? 0) };
        });
      } catch { /* el próximo tick reintenta */ }
    };
    tick();
    const poll = setInterval(tick, 400);
    const clock = setInterval(() => setNow(Date.now()), 100);
    return () => { alive = false; clearInterval(poll); clearInterval(clock); };
  }, [phase]);

  const save = async (patch: Partial<{ apiEnabled: boolean; autoProcess: boolean; monthlyBudgetUsd: number }>) => {
    const r = await fetch("/api/admin/settings", { method: "POST", body: JSON.stringify(patch) });
    setS(await r.json());
    load();
  };

  const openEdit = () => {
    setEditing(true);
    setTimeout(() => budgetInput.current?.focus(), 0);
  };
  const saveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    await save({ monthlyBudgetUsd: Number(budget) });
    setEditing(false);
  };

  /** Revela en orden los pasos que ya terminaron y que el sondeo no llegó a ver. */
  const catchUp = async () => {
    const from = runRef.current?.stage ?? 0;
    for (let st = from + 1; st <= STEPS.length; st++) {
      setRun((p) => (p ? { ...p, stage: Math.max(p.stage, st) } : p));
      if (!reducedMotion()) await sleep(240);
    }
  };

  const processOne = async () => {
    const target = pick ? docs.find((d) => d.id === pick) : undefined;
    const startedAt = Date.now();
    setNow(startedAt);
    setRun({ phase: "running", stage: 0, startedAt, docId: target?.id, fileName: target?.file_name });
    setRunning(true);
    const r = await fetch("/api/admin/process-one", { method: "POST", body: JSON.stringify(pick ? { documentId: pick } : {}) });
    const j = await r.json();
    const fileName = docs.find((d) => d.id === j.documentId)?.file_name;
    if (!r.ok) setRun((p) => p && { ...p, phase: "error", message: j.error });
    else if (j.status === "empty") setRun((p) => p && { ...p, phase: "empty" });
    else if (j.result?.ok) {
      setRun((p) => p && { ...p, docId: j.documentId, fileName: p.fileName ?? fileName });
      await catchUp();
      setRun((p) => p && { ...p, phase: "done", stage: STEPS.length, durationMs: j.durationMs, duplicate: !!j.result.duplicateOf });
    } else if (j.result?.waiting) setRun((p) => p && { ...p, phase: "waiting", stage: 0, waiting: j.result.waiting, fileName: p.fileName ?? fileName });
    else setRun((p) => p && { ...p, phase: "failed", stage: Math.max(p.stage, 1), message: j.result?.error ?? "error", durationMs: j.durationMs, fileName: p.fileName ?? fileName });
    setRunning(false);
    setPick("");
    load();
  };

  if (!s || !u) {
    return (
      <div className="flex max-w-[1240px] flex-col gap-6">
        <div className="h-16 w-2/3 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-6 lg:grid-cols-[1.95fr_1fr]"><div className="h-60 animate-pulse rounded-xl bg-muted" /><div className="h-60 animate-pulse rounded-xl bg-muted" /></div>
      </div>
    );
  }

  const pending = docs.filter((d) => ["received", "paused", "queued_budget", "error"].includes(d.status));
  const pct = Math.min(1, Math.max(0, u.budget.pct));
  const out = u.budget.level === "exhausted";
  const high = u.budget.level === "warn80";
  const waitingN = (u.documents.received ?? 0) + (u.documents.paused ?? 0) + (u.documents.queued_budget ?? 0);
  const d0 = new Date();
  const resetDate = new Date(d0.getFullYear(), d0.getMonth() + 1, 1).toLocaleDateString(loc, { month: "short", day: "numeric", year: "numeric" });
  const kindLabel = (k: string) => t.usage.kinds[k as keyof Dict["usage"]["kinds"]] ?? k;
  const stepState = (i: number): StepState => {
    if (!run) return "todo";
    if (i < run.stage) return "done";
    if (i === run.stage) {
      if (run.phase === "running") return "doing";
      if (run.phase === "failed") return "failed";
      if (run.phase === "waiting") return "blocked";
    }
    return "todo";
  };
  const showSteps = run && run.phase !== "empty" && run.phase !== "error";
  const elapsed = run ? (run.phase === "running" ? Math.max(0, now - run.startedAt) : run.durationMs ?? 0) / 1000 : 0;
  const cardCls = "animate-wt-enter gap-0 px-[22px] pt-6 pb-6";
  const banner = "flex items-start gap-2 rounded-sm px-3 py-2.5 text-[13px] font-bold";
  const linkCls = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

  return (
    <div className="flex max-w-[1240px] flex-col gap-6">
      <PageHeader title={t.usage.title} sub={t.usage.sub} className="mb-2" />

      {/* API de modelos */}
      <Card className={cn(cardCls, "[animation-delay:60ms]")}>
        <div className="flex flex-wrap items-center gap-5">
          <span
            key={s.apiEnabled ? "on" : "off"}
            className={cn("grid size-11 shrink-0 animate-wt-fade place-items-center rounded-md", s.apiEnabled ? "bg-success-bg text-primary" : "bg-warning-bg text-warning")}
          >
            <BrandIcon name={s.apiEnabled ? "keys" : "hourglass"} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{t.usage.modelApi}</h2>
            <p className={cn("mt-1.5 text-sm", s.apiEnabled ? "text-muted-foreground" : "text-warning")}>{s.apiEnabled ? t.usage.apiActiveLine : t.usage.apiPausedLine}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("flex h-7 min-w-36 items-center gap-2 rounded-sm px-2.5 text-xs font-bold", s.apiEnabled ? "bg-success-bg text-primary" : "bg-warning-bg text-warning")}>
              <Glyph className="text-[10px]">{s.apiEnabled ? "●" : "○"}</Glyph>
              {s.apiEnabled ? t.usage.apiActive : t.usage.apiPaused}
            </span>
            <Button variant={s.apiEnabled ? "outline" : "default"} onClick={() => save({ apiEnabled: !s.apiEnabled })} className="min-w-44 justify-start px-4">
              {s.apiEnabled ? t.usage.pause : t.usage.resume}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t pt-4 text-[13px]">
          <div className="flex items-center gap-3">
            <Switch checked={s.autoProcess} onChange={(v) => save({ autoProcess: v })} label={t.usage.auto} />
            <span><span className="font-bold">{t.usage.auto}</span> <span className="text-muted-foreground">· {t.usage.autoHelp}</span></span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <BrandIcon name="keys" className="size-4 text-primary" />
            {t.usage.keys}:
            {([["Anthropic", s.keys.anthropic], ["OpenAI", s.keys.openai]] as const).map(([name, ok]) => (
              <span key={name} className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-bold", ok ? "bg-success-bg text-primary" : "bg-destructive-bg text-destructive")}>
                <Glyph>{ok ? "✓" : "×"}</Glyph> {name}{!ok && ` · ${t.usage.missing}`}
              </span>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)]">
        {/* Presupuesto mensual */}
        <Card className={cn(cardCls, "[animation-delay:120ms]")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">{t.usage.monthly}</h2>
              <div className="mt-4 flex items-end gap-6">
                <span className="text-forest"><MetricNumber value={compactMoney(u.budget.spentUsd)} size={54.4} label={money(u.budget.spentUsd, 4)} /></span>
                <span className="pb-0.5 text-[15px] text-muted-foreground">{t.usage.of} {money(u.budget.budgetUsd)}</span>
              </div>
            </div>
            {!editing && <Button variant="outline" onClick={openEdit} className="min-w-41 justify-start px-4">{t.usage.edit}</Button>}
          </div>

          {editing && (
            <form onSubmit={saveBudget} className="mt-5 flex animate-wt-fade flex-wrap items-center gap-2">
              <div className="relative w-40">
                <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input ref={budgetInput} type="number" min={0} step="1" value={budget} onChange={(e) => setBudget(e.target.value)} aria-label={t.usage.budget} className="bg-paper pl-7 tabular-nums" />
              </div>
              <Button type="submit">{t.usage.save}</Button>
              <Button type="button" variant="ghost" onClick={() => { setEditing(false); setBudget(String(s.monthlyBudgetUsd)); }}>{t.usage.cancel}</Button>
            </form>
          )}

          <div className="mt-7">
            <div
              className="relative h-2.5 overflow-hidden rounded-sm bg-muted"
              role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label={t.usage.spent}
            >
              <div
                className={cn("h-full animate-in rounded-sm transition-[width] duration-1000 ease-out fill-mode-both slide-in-from-left [animation-delay:300ms]", out ? "bg-destructive" : pct >= 0.8 ? "bg-warning" : "bg-primary")}
                style={{ width: `${Math.max(1, pct * 100)}%` }}
              />
              <span className="absolute inset-y-0 left-1/2 w-px bg-white/70" />
              <span className="absolute inset-y-0 left-[80%] w-px bg-white/70" />
            </div>
            <div aria-hidden className="relative mt-2 h-4 text-[11px] text-muted-foreground tabular-nums">
              <span className="absolute left-0">0%</span>
              <span className="absolute left-1/2 -translate-x-1/2">50%</span>
              <span className="absolute left-[80%] -translate-x-1/2">80%</span>
              <span className="absolute right-0">100%</span>
            </div>
          </div>

          <p className="mt-6 text-[13px] text-muted-foreground">{fill(t.usage.resets, { date: resetDate, v: money(u.budget.remainingUsd) })}</p>
          {out && <div role="status" className={cn(banner, "mt-4 animate-wt-fade bg-warning-bg text-warning")}><Glyph>!</Glyph> {t.usage.reached}</div>}
          {high && <div role="status" className={cn(banner, "mt-4 animate-wt-fade bg-warning-bg text-warning")}><Glyph>!</Glyph> {t.usage.high}</div>}
        </Card>

        {/* Cola */}
        <Card className={cn(cardCls, "[animation-delay:180ms]")}>
          <h2 className="text-lg font-bold">{t.usage.queueTitle}</h2>
          <div className="mt-4 flex items-end gap-5">
            <span className="text-forest"><MetricNumber value={waitingN} size={54.4} /></span>
            <span className="pb-0.5 text-sm text-muted-foreground">{!s.apiEnabled ? t.usage.waitApi : out ? t.usage.waitBudget : t.usage.waitQueue}</span>
          </div>
          <p className="mt-5 text-[13px] text-muted-foreground">{!s.apiEnabled ? t.usage.helpApi : out ? t.usage.helpBudget : t.usage.helpQueue}</p>
          {Object.keys(u.documents).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-xs">
              {Object.entries(u.documents).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><DocStatus status={k} t={t} /> <b className="tabular-nums">{v}</b></span>)}
            </div>
          )}
          {!s.apiEnabled ? (
            <Button onClick={() => save({ apiEnabled: true })} className="mt-auto w-full justify-start px-4">{t.usage.resume}</Button>
          ) : out ? (
            <Button onClick={openEdit} className="mt-auto w-full justify-start px-4">{t.usage.increase}</Button>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)]">
        {/* Consumo por operación */}
        <Card className={cn(cardCls, "[animation-delay:240ms]")}>
          <h2 className="text-lg font-bold">{t.usage.usageTitle}</h2>
          <div className="mt-5 text-sm">
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)] gap-4 pb-3 text-[11px] font-bold tracking-wide text-foreground/80 uppercase">
              <span>{t.usage.operation}</span><span>{t.usage.tokensCol}</span><span>{t.usage.costCol}</span>
            </div>
            {u.byKind.map((k, i) => (
              <div key={k.kind} className="grid animate-wt-enter grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)] items-baseline gap-4 border-b py-4" style={{ animationDelay: `${300 + i * 60}ms` }}>
                <span className="min-w-0">
                  <span className="block text-[15px]">{kindLabel(k.kind)}</span>
                  <span className="text-xs text-muted-foreground">{fill(t.usage.callsN, { n: k.calls.toLocaleString(loc) })}</span>
                </span>
                <span className="min-w-0 text-[13px] text-muted-foreground tabular-nums" title={t.usage.tokens}>
                  <span className="block">{(k.inputTokens + k.outputTokens).toLocaleString(loc)}</span>
                  <span className="text-xs">{fill(t.usage.inOut, { i: k.inputTokens.toLocaleString(loc), o: k.outputTokens.toLocaleString(loc) })}</span>
                </span>
                <span className="font-bold tabular-nums">{money(k.costUsd, 4)}</span>
              </div>
            ))}
            {u.byKind.length === 0 && <p className="border-t py-6 text-[13px] text-muted-foreground">{t.usage.noCalls}</p>}
          </div>
        </Card>

        {/* Procesamiento en vivo */}
        <Card className={cn(cardCls, "[animation-delay:300ms]")}>
          <h2 className="text-lg font-bold">{t.usage.live}</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{t.usage.liveSub}</p>

          <div className="relative mt-4 -ml-2">
            <select
              value={pick} onChange={(e) => setPick(e.target.value)} disabled={running} aria-label={t.usage.pick}
              className="h-9 w-full appearance-none truncate rounded-md border border-transparent bg-transparent pr-8 pl-2 text-sm font-bold text-foreground transition-colors outline-none hover:border-border hover:bg-paper focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-transparent disabled:hover:bg-transparent"
            >
              <option value="">{t.usage.pick}</option>
              {pending.map((d) => <option key={d.id} value={d.id}>{d.file_name} — {t.docStatus[d.status as keyof Dict["docStatus"]]}</option>)}
            </select>
            <Glyph className="pointer-events-none absolute top-1/2 right-3 -translate-y-[65%] text-sm text-muted-foreground">⌄</Glyph>
          </div>

          {showSteps ? (
            <div className="mt-4" aria-live="polite">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-bold text-foreground">{run.fileName ?? "…"}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{elapsed.toFixed(1)} s</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-sm bg-muted">
                <div
                  className={cn("h-full rounded-sm transition-[width] duration-500 ease-out", run.phase === "failed" ? "bg-destructive" : run.phase === "waiting" ? "bg-warning" : "bg-primary")}
                  style={{ width: `${((run.stage + (run.phase === "running" ? 0.5 : 0)) / STEPS.length) * 100}%` }}
                />
              </div>
              <ol className="mt-4 flex flex-col">
                {STEPS.map((step, i) => {
                  const st = stepState(i);
                  const label = t.usage.steps[step][st === "done" ? "done" : st === "todo" ? "todo" : "doing"];
                  return (
                    <li key={step} className="relative flex animate-wt-enter gap-3 pb-3 last:pb-0" style={{ animationDelay: `${i * 100}ms` }}>
                      {i < STEPS.length - 1 && (
                        <span aria-hidden className={cn("absolute top-6 bottom-0.5 left-[9.5px] w-px transition-colors duration-500", st === "done" ? "bg-primary" : "bg-border")} />
                      )}
                      <StepMark key={st} state={st} />
                      <div className="min-w-0 flex-1 pt-px">
                        <div className={cn("text-sm", st === "todo" && "text-muted-foreground", st === "doing" && "font-bold text-foreground", st === "failed" && "font-bold text-destructive", st === "blocked" && "font-bold text-warning")}>
                          {label}
                        </div>
                        {st === "doing" && (
                          <div className="mt-0.5 animate-wt-fade text-xs text-muted-foreground">
                            {t.usage.hints[step]}<Glyph className="ml-0.5 animate-wt-blink text-primary">▍</Glyph>
                          </div>
                        )}
                      </div>
                      <BrandIcon
                        name={STEP_ICON[step]}
                        className={cn("mt-0.5 size-[18px] shrink-0 transition-colors duration-300", st === "doing" ? "animate-pulse text-primary" : st === "done" ? "text-primary/70" : st === "failed" ? "text-destructive" : "text-muted-foreground/35")}
                      />
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="flex flex-1 items-center py-5">
              <Illo name="windows" className="w-24 animate-wt-globe opacity-90 [animation-delay:450ms]" />
            </div>
          )}

          {run?.phase === "done" && (
            <div role="status" className={cn(banner, "mt-5 animate-wt-enter flex-wrap", run.duplicate ? "bg-warning-bg text-warning" : "bg-success-bg text-success")}>
              <Glyph className="mt-px">{run.duplicate ? "!" : "✓"}</Glyph>
              <span className="flex-1">{fill(run.duplicate ? t.usage.duplicateIn : t.usage.indexedIn, { s: elapsed.toFixed(1) })}</span>
              <Link href="/candidates" className={linkCls}>{t.usage.viewCandidates} <Glyph>↗</Glyph></Link>
            </div>
          )}
          {run?.phase === "failed" && (
            <div role="alert" className={cn(banner, "mt-5 animate-wt-enter flex-col bg-destructive-bg text-destructive")}>
              <span><Glyph>×</Glyph> {t.usage.failed}</span>
              {run.message && <span className="line-clamp-3 font-normal">{run.message}</span>}
            </div>
          )}
          {run?.phase === "waiting" && (
            <div role="status" className={cn(banner, "mt-5 animate-wt-enter bg-warning-bg text-warning")}>
              <Glyph>!</Glyph> {run.waiting === "api_disabled" ? t.usage.apiPausedLine : t.usage.reached}
            </div>
          )}
          {run?.phase === "empty" && (
            <div role="status" className={cn(banner, "mt-4 animate-wt-enter flex-wrap bg-muted text-muted-foreground")}>
              <span className="flex-1">{t.usage.emptyQueue}</span>
              <Link href="/upload" className={cn(linkCls, "text-primary")}>{t.nav.upload} <Glyph>↗</Glyph></Link>
            </div>
          )}
          {run?.phase === "error" && run.message && (
            <div role="alert" className={cn(banner, "mt-4 animate-wt-enter bg-destructive-bg text-destructive")}><Glyph>×</Glyph> {run.message}</div>
          )}

          {!running && (
            <div className="mt-auto pt-5">
              <Button onClick={processOne} disabled={!s.apiEnabled} title={!s.apiEnabled ? t.usage.enableFirst : ""} className="w-full justify-start px-4">
                {t.usage.processOne}
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">{s.apiEnabled ? t.usage.limits : t.usage.enableFirst}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Umbrales del presupuesto */}
      <Card className={cn(cardCls, "flex-row flex-wrap items-center justify-between gap-6 [animation-delay:360ms]")}>
        <div>
          <h2 className="text-lg font-bold">{t.usage.alerts}</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{t.usage.alertsSub}</p>
        </div>
        <div className="flex flex-wrap gap-4">
          {[0.5, 0.8, 1].map((th) => {
            const reached = u.budget.pct >= th;
            return (
              <span key={th} className={cn("flex h-7 min-w-37 items-center gap-1.5 rounded-sm px-2.5 text-xs font-bold", reached ? (th >= 1 ? "bg-destructive-bg text-destructive" : "bg-warning-bg text-warning") : "bg-success-bg text-primary")}>
                <Glyph>{reached ? "!" : "✓"}</Glyph> {Math.round(th * 100)}%{reached && ` · ${t.usage.thresholdReached}`}
              </span>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
