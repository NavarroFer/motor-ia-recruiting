"use client";
import { Fragment, useEffect, useId, useState } from "react";
import { CalendarClock, Lightbulb } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import type { ReqCheck, Result, SearchOutput } from "@/lib/search";
import type { SuggestionsOutput } from "@/lib/learning";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Illo } from "@/components/brand/brand";
import { BrandIcon } from "@/components/brand/icons";
import { MetricNumber } from "@/components/brand/metric-number";
import { CandidatePanel, MARK, ScoreBlock, shortDetail } from "@/app/(app)/search/candidate-panel";
import { cn } from "@/lib/utils";

export type Decision = "selected" | "shortlisted" | "discarded";
export type Explanation = { match: string[]; gaps: string[]; summary: string; by: "ai" | "rules" | "cache" };

const DECISIONS = ["selected", "shortlisted", "discarded"] as const;
const DECISION_BADGE = { selected: "selected", shortlisted: "default", discarded: "destructive" } as const;
const DURATIONS = [30, 45, 60] as const;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Sugerencia inicial del diálogo: próximo día hábil a las 10:00, en la zona del navegador. */
function nextSlot() {
  const d = new Date();
  do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6);
  return { date: ymd(d), time: "10:00", minutes: 45 };
}

/** Tablero de resultados: lo usan la búsqueda libre y el detalle de una vacante. */
export function ResultsBoard({ data, t, lang, canDecide, locked, openingId, emptyState }: {
  data: SearchOutput; t: Dict; lang: Lang; canDecide: boolean; locked?: boolean; openingId?: string;
  /** Estado sin candidatos que cumplan (la búsqueda libre pasa el suyo con acciones). */
  emptyState?: React.ReactNode;
}) {
  const [sugg, setSugg] = useState<SuggestionsOutput | null>(null);
  const [tick, setTick] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [expl, setExpl] = useState<Record<string, Explanation | "loading">>({});
  const [explFailed, setExplFailed] = useState<Record<string, true>>({});
  const [names, setNames] = useState<{ visible: boolean; byId: Record<string, string | null> } | null>(null);
  const [tab, setTab] = useState<"all" | Decision>("all");
  const [openNot, setOpenNot] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const [reason, setReason] = useState<{ ids: string[]; status: "selected" | "shortlisted"; failed: string[] } | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [interviews, setInterviews] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<{ ids: string[]; againstAi: boolean; reason?: string } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [slot, setSlot] = useState(nextSlot);
  const [busy, setBusy] = useState(false);
  const reasonId = useId();
  const scheduleId = useId();
  const decideAllowed = canDecide && !locked;
  const loc = lang === "es" ? "es-AR" : "en-US";

  // Decisiones previas (vacantes) + explicaciones del top 10 en segundo plano
  useEffect(() => {
    let alive = true;
    fetch(`/api/decisions?searchId=${data.searchId}`).then((r) => r.json()).then((j) => {
      if (!alive) return;
      const rows: { candidate_id: string; status: Decision; interview_at: string | null }[] = j.decisions ?? [];
      setDecisions(Object.fromEntries(rows.map((d) => [d.candidate_id, d.status])));
      setInterviews(Object.fromEntries(rows.filter((d) => d.interview_at).map((d) => [d.candidate_id, d.interview_at!])));
    });
    const queue = data.results.slice(0, 10).map((r) => r.candidateId);
    const worker = async () => {
      while (queue.length && alive) {
        const id = queue.shift()!;
        setExpl((e) => ({ ...e, [id]: "loading" }));
        const r = await fetch("/api/explain", { method: "POST", body: JSON.stringify({ searchId: data.searchId, candidateId: id, lang }) });
        const x = r.ok ? ((await r.json()) as Explanation) : null;
        if (alive) setExpl((e) => { const n = { ...e }; if (x) n[id] = x; else delete n[id]; return n; });
        if (alive && !x) setExplFailed((f) => ({ ...f, [id]: true }));
      }
    };
    worker(); worker(); worker();
    return () => { alive = false; };
  }, [data, lang]);

  // Nombres (PII): la API solo los devuelve a roles que ven contacto; el resto ve "Candidato #id"
  useEffect(() => {
    let alive = true;
    fetch("/api/candidates").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!alive) return;
      setNames({
        visible: Boolean(j?.namesVisible),
        byId: Object.fromEntries(((j?.candidates ?? []) as { id: string; name: string | null }[]).map((c) => [c.id, c.name])),
      });
    }).catch(() => alive && setNames({ visible: false, byId: {} }));
    return () => { alive = false; };
  }, []);

  // Aprendizaje por decisiones (solo vacantes): se recalcula después de cada decisión
  useEffect(() => {
    if (!openingId) return;
    let alive = true;
    fetch(`/api/openings/${openingId}/suggestions`).then((r) => (r.ok ? r.json() : null)).then((j) => alive && setSugg(j));
    return () => { alive = false; };
  }, [openingId, tick]);

  const decide = async (ids: string[], status: Decision | "none", opts?: { againstAi?: boolean; reason?: string; interview?: { start: string; minutes: number } }) => {
    const res = await fetch("/api/decisions", {
      method: "POST",
      body: JSON.stringify({ searchId: data.searchId, candidateIds: ids, status, againstAi: !!opts?.againstAi, reason: opts?.reason, interview: opts?.interview }),
    });
    if (!res.ok) return;
    setTick((n) => n + 1);
    setDecisions((d) => {
      const n = { ...d };
      for (const id of ids) { if (status === "none") delete n[id]; else n[id] = status; }
      return n;
    });
    // Cada decisión reemplaza a la anterior: sin entrevista nueva, la previa deja de valer
    setInterviews((m) => {
      const n = { ...m };
      for (const id of ids) { if (opts?.interview) n[id] = opts.interview.start; else delete n[id]; }
      return n;
    });
  };
  // Seleccionar abre el diálogo de agenda: el evento con Meet sale recién cuando el reclutador elige día y horario
  const openSchedule = (ids: string[], extra?: { againstAi: boolean; reason: string }) => {
    setSchedule({ ids, againstAi: extra?.againstAi ?? false, reason: extra?.reason });
    setSlot(nextSlot());
    setScheduleOpen(true);
  };
  const slotStart = slot.date && slot.time ? new Date(`${slot.date}T${slot.time}`) : null;
  const slotValid = !!slotStart && !Number.isNaN(slotStart.getTime()) && slotStart.getTime() > Date.now();
  const confirmSelect = async (withInterview: boolean) => {
    if (!schedule) return;
    setBusy(true);
    await decide(schedule.ids, "selected", {
      againstAi: schedule.againstAi, reason: schedule.reason,
      interview: withInterview && slotValid ? { start: slotStart!.toISOString(), minutes: slot.minutes } : undefined,
    });
    setBusy(false);
    setScheduleOpen(false);
  };
  const interviewLabel = (id: string) =>
    interviews[id] ? new Date(interviews[id]).toLocaleString(loc, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined;
  const failedText = (c: ReqCheck) => {
    const got = shortDetail(c);
    return got ? t.search.requiresShows.replace("{req}", c.label).replace("{got}", got) : t.search.requiresNone.replace("{req}", c.label);
  };
  const failedOf = (r: Result) => r.checks.filter((c) => c.mandatory && c.status === "unmet").map(failedText);
  const onAction = (r: Result, status: Decision) => {
    if (decisions[r.candidateId] === status) return decide([r.candidateId], "none");
    if (!r.meetsMandatory && status !== "discarded") {
      setReason({ ids: [r.candidateId], status, failed: failedOf(r) });
      setReasonText("");
      setReasonOpen(true);
      return;
    }
    if (status === "selected") return openSchedule([r.candidateId]);
    decide([r.candidateId], status);
  };
  const visible = (list: Result[]) => (tab === "all" ? list : list.filter((r) => decisions[r.candidateId] === tab));
  const count = (s: Decision) => Object.values(decisions).filter((d) => d === s).length;

  // Top 10: la explicación se pide en segundo plano; hasta que llegue (o falle) se muestra cargando
  const top = new Set(data.results.slice(0, 10).map((r) => r.candidateId));
  const explOf = (id: string): Explanation | "loading" | undefined => expl[id] ?? (top.has(id) && !explFailed[id] ? "loading" : undefined);
  // IA solo a pedido: la explicación por requisitos es gratis; la de IA se paga una vez y queda cacheada
  const explainAi = async (id: string) => {
    const prev = expl[id];
    setExpl((e) => ({ ...e, [id]: "loading" }));
    const r = await fetch("/api/explain", { method: "POST", body: JSON.stringify({ searchId: data.searchId, candidateId: id, lang, ai: true }) });
    const x = r.ok ? ((await r.json()) as Explanation) : null;
    setExpl((e) => { const n = { ...e }; if (x) n[id] = x; else if (prev) n[id] = prev; else delete n[id]; return n; });
  };
  const anon = (id: string) => `${t.cands.hidden} #${id.slice(0, 6)}`;
  const nameOf = (id: string) => (names ? (names.visible ? names.byId[id] ?? anon(id) : anon(id)) : null);
  const avatarOf = (r: Result) => initials(names?.visible && names.byId[r.candidateId] ? names.byId[r.candidateId]! : r.headline);

  const shown = visible(data.results);
  const panelResult = panel ? [...data.results, ...data.notMeeting].find((r) => r.candidateId === panel) : undefined;

  return (
    <>
      {openingId && sugg && !locked && (
        <SuggestionsBox s={sugg} t={t} canDecide={decideAllowed} onOpen={setPanel}
          onShortlist={(id) => decide([id], "shortlisted")} />
      )}

      {data.results.length === 0 ? (emptyState ?? <NoResults t={t} />) : (
        <>
          <div role="tablist" aria-label={t.search.decision} className="flex gap-x-10 overflow-x-auto border-b min-[1400px]:gap-x-16">
            {(["all", "shortlisted", "selected", "discarded"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-2 border-b-2 pt-1 pb-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:text-foreground sm:min-w-28",
                  tab === k ? "border-primary font-bold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.search.tabs[k]} <span className="tabular-nums">{k === "all" ? data.results.length : count(k)}</span>
              </button>
            ))}
          </div>

          <div className="@container flex flex-col gap-4" role="tabpanel">
            {shown.length === 0 && (
              <p className="animate-wt-fade rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">{t.search.tabEmpty}</p>
            )}
            {shown.map((r, i) => (
              <ResultCard key={r.candidateId} r={r} index={i} t={t} lang={lang} name={nameOf(r.candidateId)} avatar={avatarOf(r)}
                expl={explOf(r.candidateId)} decision={decisions[r.candidateId]} interview={interviewLabel(r.candidateId)} canDecide={decideAllowed}
                onAction={(s) => onAction(r, s)} onOpen={() => setPanel(r.candidateId)} />
            ))}
          </div>
        </>
      )}

      {/* No cumplen obligatorios: nunca se descartan solos, quedan agrupados para revisión humana */}
      {data.notMeeting.length > 0 && (
        <section className={cn("rounded-lg border transition-colors", openNot ? "bg-card" : "bg-muted")}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <button onClick={() => setOpenNot(!openNot)} aria-expanded={openNot} className="flex items-center gap-2.5 text-left text-sm font-bold outline-none focus-visible:underline">
              <span aria-hidden className={cn("inline-block w-2.5 text-base leading-none transition-transform", openNot && "rotate-90")}>›</span>
              <span>{t.search.notMeeting} <span aria-hidden className="px-1 text-muted-foreground">·</span> {data.notMeeting.length} {t.search.found}</span>
            </button>
            <div className="flex items-center gap-4">
              <Badge variant="muted" className="px-2.5 py-1"><span aria-hidden>✦</span> {t.search.aiTag}</Badge>
              {openNot && decideAllowed && (
                <Button size="sm" variant="destructive" className="animate-wt-fade" onClick={() => setBulkOpen(true)}>{t.search.discardAll}</Button>
              )}
              <button tabIndex={-1} aria-hidden onClick={() => setOpenNot(!openNot)} className="text-[13px] font-bold text-primary hover:underline">
                {openNot ? t.search.hideGroup : t.search.reviewGroup}
              </button>
            </div>
          </div>
          {openNot && (
            <ul className="flex flex-col gap-3 border-t px-5 py-4">
              {visible(data.notMeeting).length === 0 && <li className="text-sm text-muted-foreground">{t.search.tabEmpty}</li>}
              {visible(data.notMeeting).map((r, i) => (
                <IneligibleRow key={r.candidateId} r={r} index={i} t={t} name={nameOf(r.candidateId)} failed={failedOf(r)}
                  decision={decisions[r.candidateId]} interview={interviewLabel(r.candidateId)} canDecide={decideAllowed}
                  onAction={(s) => onAction(r, s)} onOpen={() => setPanel(r.candidateId)} />
              ))}
            </ul>
          )}
        </section>
      )}

      {panel && (
        <CandidatePanel id={panel} t={t} lang={lang} onClose={() => setPanel(null)} explanation={explOf(panel)} onExplainAi={() => explainAi(panel)}
          score={panelResult?.score} checks={panelResult?.checks} decision={decisions[panel]}
          onAction={decideAllowed && panelResult ? (s) => onAction(panelResult, s) : undefined} />
      )}

      {/* Excepción: preseleccionar/seleccionar a alguien que no cumple un obligatorio exige motivo (01h) */}
      <Dialog open={reasonOpen} onOpenChange={(o) => !o && setReasonOpen(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl tracking-normal normal-case">{reason ? t.search.exception[reason.status] : t.search.reasonTitle}</DialogTitle>
            <DialogDescription>{t.search.reasonHelp}</DialogDescription>
          </DialogHeader>
          {reason && reason.failed.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-destructive">{reason.failed.map((f) => <li key={f}>{f}</li>)}</ul>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor={reasonId} className="text-[13px] font-bold">{t.search.reasonLabel}</label>
            <Textarea id={reasonId} value={reasonText} onChange={(e) => setReasonText(e.target.value)} className="min-h-20" />
          </div>
          <div className="flex flex-wrap gap-2">
            {t.search.reasonQuick.map((q) => (
              <button key={q} type="button" aria-pressed={reasonText === q} onClick={() => setReasonText(q)}
                className={cn("rounded-md bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary", reasonText === q && "bg-secondary ring-1 ring-primary/40")}>
                {q}
              </button>
            ))}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" className="min-w-28 justify-start" onClick={() => setReasonOpen(false)}>{t.search.cancel}</Button>
            <Button className="min-w-44 justify-start" disabled={!reasonText.trim() || busy} onClick={async () => {
              if (!reason) return;
              if (reason.status === "selected") {
                setReasonOpen(false);
                openSchedule(reason.ids, { againstAi: true, reason: reasonText });
                return;
              }
              setBusy(true);
              await decide(reason.ids, reason.status, { againstAi: true, reason: reasonText });
              setBusy(false);
              setReasonOpen(false);
            }}>
              {reason ? t.search.confirmException[reason.status] : t.search.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seleccionar = agendar: con día y horario, n8n crea el evento con Google Meet y avisa por Slack */}
      <Dialog open={scheduleOpen} onOpenChange={(o) => !o && setScheduleOpen(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl tracking-normal normal-case">{t.search.schedule.title}</DialogTitle>
            <DialogDescription>{t.search.schedule.help}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${scheduleId}-date`} className="text-[13px] font-bold">{t.search.schedule.date}</label>
              <Input id={`${scheduleId}-date`} type="date" min={ymd(new Date())} value={slot.date}
                onChange={(e) => setSlot((s) => ({ ...s, date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${scheduleId}-time`} className="text-[13px] font-bold">{t.search.schedule.time}</label>
              <Input id={`${scheduleId}-time`} type="time" step={900} value={slot.time}
                onChange={(e) => setSlot((s) => ({ ...s, time: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${scheduleId}-dur`} className="text-[13px] font-bold">{t.search.schedule.duration}</label>
              <NativeSelect id={`${scheduleId}-dur`} value={slot.minutes} onChange={(e) => setSlot((s) => ({ ...s, minutes: Number(e.target.value) }))}>
                {DURATIONS.map((m) => <option key={m} value={m}>{t.search.schedule.minutes.replace("{n}", String(m))}</option>)}
              </NativeSelect>
            </div>
          </div>
          {slot.date && slot.time && !slotValid && <p role="alert" className="text-[13px] text-destructive">{t.search.schedule.past}</p>}
          <DialogFooter className="mt-2">
            <Button variant="outline" className="min-w-28 justify-start" onClick={() => setScheduleOpen(false)}>{t.search.cancel}</Button>
            <Button variant="outline" className="justify-start" disabled={busy} onClick={() => confirmSelect(false)}>{t.search.schedule.skip}</Button>
            <Button className="min-w-44 justify-start" disabled={busy || !slotValid} onClick={() => confirmSelect(true)}>{t.search.schedule.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Descarte masivo del grupo que no cumple (01i): se registra una decisión por candidato */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !o && setBulkOpen(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl tracking-normal normal-case">{t.search.bulkTitle.replace("{n}", String(data.notMeeting.length))}</DialogTitle>
            <DialogDescription className="mt-2">{t.search.bulkBody}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t.search.bulkBody2}</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" className="min-w-28 justify-start" onClick={() => setBulkOpen(false)}>{t.search.cancel}</Button>
            <Button className="min-w-44 justify-start" disabled={busy} onClick={async () => {
              setBusy(true);
              await decide(data.notMeeting.map((r) => r.candidateId), "discarded");
              setBusy(false);
              setBulkOpen(false);
            }}>
              {t.search.bulkConfirm.replace("{n}", String(data.notMeeting.length))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Iniciales para el avatar: del nombre si se ve, si no del rol (nunca PII para quien no la ve). */
function initials(s: string) {
  return s.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "··";
}

function NoResults({ t }: { t: Dict }) {
  return (
    <div className="flex animate-wt-enter items-center justify-between gap-8 rounded-lg border bg-card px-8 py-8">
      <p className="text-lg font-bold">{t.search.empty}</p>
      <Illo name="windows" className="w-28 shrink-0 animate-wt-globe" />
    </div>
  );
}

export function DecisionChip({ decision, t, className }: { decision?: Decision; t: Dict; className?: string }) {
  return (
    <Badge key={decision ?? "none"} variant={decision ? DECISION_BADGE[decision] : "muted"}
      className={cn("animate-wt-fade justify-start px-2.5 py-1.5 text-xs", className)}>
      {decision ? t.search.tabs[decision] : t.search.noDecision}
    </Badge>
  );
}

/** "Seleccionar / Preseleccionar / Descartar": la acción activa queda subrayada y se puede deshacer con otro clic. */
function ActionLinks({ decision, onAction, t, only }: { decision?: Decision; onAction: (s: Decision) => void; t: Dict; only?: readonly Decision[] }) {
  const label = { selected: t.search.select, shortlisted: t.search.shortlist, discarded: t.search.discard };
  return (
    <div role="group" aria-label={t.search.decision} className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-primary">
      {(only ?? DECISIONS).map((s, i) => (
        <Fragment key={s}>
          {i > 0 && <span aria-hidden className="text-muted-foreground">/</span>}
          <button
            type="button"
            aria-pressed={decision === s}
            onClick={() => onAction(s)}
            className={cn(
              "rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50",
              decision === s && "underline decoration-2",
              s === "discarded" && "hover:text-destructive",
            )}
          >
            {label[s]}
          </button>
        </Fragment>
      ))}
    </div>
  );
}

function CheckItem({ c, t }: { c: ReqCheck; t: Dict }) {
  // Un deseable que falta no descalifica: se muestra apagado, no en rojo
  const cls = c.status === "unmet" && !c.mandatory ? "text-muted-foreground" : MARK[c.status].cls;
  return (
    <li title={c.detail} className={cn("min-w-0 leading-snug", cls)}>
      <span aria-hidden>{MARK[c.status].glyph}</span> {c.label}
      {c.status === "unknown" && <> · {t.search.verify}</>}
      <span className="sr-only"> — {t.status[c.status]}</span>
    </li>
  );
}

/** Día y horario de la entrevista agendada al seleccionar. */
function InterviewLine({ when, t }: { when: string; t: Dict }) {
  return (
    <p className="flex animate-wt-fade items-center gap-1.5 text-xs text-muted-foreground">
      <CalendarClock aria-hidden className="size-3.5 shrink-0 text-primary" /> {t.search.schedule.at} · {when}
    </p>
  );
}

function ResultCard({ r, index, t, lang, name, avatar, expl, decision, interview, canDecide, onAction, onOpen }: {
  r: Result; index: number; t: Dict; lang: Lang; name: string | null; avatar: string; expl?: Explanation | "loading"; decision?: Decision;
  interview?: string; canDecide: boolean; onAction: (s: Decision) => void; onOpen: () => void;
}) {
  const loc = lang === "es" ? "es-AR" : "en-US";
  const fmt = (n: number) => n.toLocaleString(loc, { maximumFractionDigits: 1 });
  const evidence = expl && expl !== "loading" ? expl.summary || expl.match[0] || "" : "";
  const skillsLine = r.topSkills.slice(0, 3).map((s) => `${s.skill} · ${fmt(s.years)} ${t.search.years}`).join(" / ");
  const mode = r.workMode && r.workMode !== "unknown" ? r.workMode : null;
  return (
    <article
      className="grid animate-wt-enter gap-5 rounded-lg border bg-card p-5 transition-shadow hover:shadow-[0_2px_10px_-4px_rgb(4_61_50/0.18)] @2xl:grid-cols-[minmax(0,1fr)_15rem]"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
          <div className="flex min-w-0 gap-3.5">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold text-primary">{avatar}</span>
            <div className="min-w-0">
              {name === null ? <div className="mt-1 h-5 w-40 animate-pulse rounded-md bg-muted" /> : (
                <button onClick={onOpen} className="rounded-sm text-left text-lg leading-snug font-bold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
                  {name}
                </button>
              )}
              <p className="mt-0.5 text-sm text-muted-foreground">
                {r.headline}
                {r.seniority && <> · <span className="capitalize">{r.seniority}</span></>}
                {" · "}{fmt(r.totalYears)} {t.search.years}
              </p>
              {(r.country || mode) && (
                <p className="text-sm text-muted-foreground">
                  {r.country}{r.country && mode && " · "}{mode && <span className="capitalize">{mode}</span>}
                </p>
              )}
            </div>
          </div>
          {r.checks.length > 0 && (
            <ul className="grid grid-cols-2 content-start gap-x-6 gap-y-2 text-sm">
              {r.checks.map((c, i) => <CheckItem key={i} c={c} t={t} />)}
            </ul>
          )}
        </div>

        {/* Evidencia: resumen de la explicación (IA o reglas); mientras llega, barras de carga */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-sm">
            {expl === "loading" ? (
              <div role="status" className="flex items-center gap-3">
                <BrandIcon name="hourglass" className="size-4 shrink-0 animate-pulse text-primary" />
                <span className="sr-only">{t.search.explaining}</span>
                <div className="flex w-full max-w-lg flex-col gap-2" aria-hidden>
                  <div className="h-2.5 w-[85%] animate-pulse rounded-md bg-muted" />
                  <div className="h-2.5 w-[55%] animate-pulse rounded-md bg-muted" />
                </div>
              </div>
            ) : evidence ? (
              <p className="animate-wt-fade">{evidence}</p>
            ) : (
              <p className="text-muted-foreground">{skillsLine}</p>
            )}
          </div>
          <Badge variant="muted" className="px-2.5 py-1">
            <span aria-hidden>✦</span> {expl && expl !== "loading" && expl.by === "rules" ? t.search.rulesTag : t.search.aiTag}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 @2xl:border-t-0 @2xl:border-l @2xl:pt-0 @2xl:pl-5">
        <ScoreBlock score={r.score} t={t} />
        <DecisionChip decision={decision} t={t} />
        {decision === "selected" && interview && <InterviewLine when={interview} t={t} />}
        {canDecide && <ActionLinks decision={decision} onAction={onAction} t={t} />}
      </div>
    </article>
  );
}

/** Fila del grupo "no cumple obligatorios" (01g): motivo concreto en rojo y acciones humanas. */
function IneligibleRow({ r, index, t, name, failed, decision, interview, canDecide, onAction, onOpen }: {
  r: Result; index: number; t: Dict; name: string | null; failed: string[]; decision?: Decision; interview?: string; canDecide: boolean;
  onAction: (s: Decision) => void; onOpen: () => void;
}) {
  return (
    <li className="flex animate-wt-enter flex-wrap items-center justify-between gap-4 rounded-lg border bg-card px-5 py-4" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <div className="min-w-0">
        <button onClick={onOpen} className="rounded-sm text-left font-bold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
          {name ?? "…"} · {r.headline}
        </button>
        {failed.map((f) => <p key={f} className="mt-1 text-[13px] text-destructive"><span aria-hidden>×</span> {f}</p>)}
        {decision === "selected" && interview && <div className="mt-1.5"><InterviewLine when={interview} t={t} /></div>}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {decision && <DecisionChip decision={decision} t={t} />}
        {canDecide && (
          <>
            <ActionLinks decision={decision} onAction={onAction} t={t} only={["selected", "discarded"]} />
            <Button variant="outline" aria-pressed={decision === "shortlisted"} className="min-w-36 justify-start" onClick={() => onAction("shortlisted")}>
              {t.search.shortlist}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function SuggestionsBox({ s, t, canDecide, onOpen, onShortlist }: {
  s: SuggestionsOutput; t: Dict; canDecide: boolean; onOpen: (id: string) => void; onShortlist: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold"><Lightbulb className="size-4 text-primary" /> {t.learn.title}</div>
        <Badge variant="muted" className="px-2.5 py-1"><span aria-hidden>✦</span> {t.learn.tag}</Badge>
      </div>
      {!s.ready && (
        <p className="text-sm text-muted-foreground">
          {s.reason === "few_decisions" ? t.learn.few.replace("{n}", String(s.needed)).replace("{k}", String(s.positives)) : t.learn.noVectors}
        </p>
      )}
      {s.ready && s.suggestions.length === 0 && <p className="text-sm text-muted-foreground">{t.learn.empty}</p>}
      {s.ready && s.suggestions.length > 0 && (
        <ul className="flex flex-col divide-y rounded-md border">
          {s.suggestions.map((x, i) => (
            <li key={x.candidateId} className="flex animate-wt-enter items-center gap-4 px-4 py-3" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex w-16 shrink-0 flex-col items-start gap-1">
                <MetricNumber value={`${x.similarity}%`} size={18} className="text-primary" />
                <div className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">{t.learn.similar}</div>
              </div>
              <button onClick={() => onOpen(x.candidateId)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2 font-bold hover:underline">
                  {x.headline} {x.isNew && <Badge>{t.learn.isNew}</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{t.learn.like}: {x.likePositives.join(" · ")}</div>
              </button>
              {canDecide && <Button size="sm" variant="outline" onClick={() => onShortlist(x.candidateId)}>{t.search.shortlist}</Button>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t.learn.note}</p>
    </div>
  );
}
