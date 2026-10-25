"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n";
import type { ReqCheck, ReqStatus } from "@/lib/search";
import type { Decision } from "@/components/app/results-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricNumber } from "@/components/brand/metric-number";
import { BrandIcon } from "@/components/brand/icons";
import { FilePreviewDialog, type PreviewDoc } from "@/components/app/file-preview";
import { cn } from "@/lib/utils";

interface Data {
  candidate: {
    headline: string; seniority: string; total_years: string; country: string | null; work_mode: string | null; summary: string;
    experience: { title: string; company_type?: string; start: string; end: string; summary?: string }[];
    leadership: { evidence: string }[]; languages: { name: string; level?: string }[]; education: { degree: string; field?: string }[];
    file_name: string | null; mime_type: string | null; document_id: string | null;
  };
  skills: { skill: string; years: string; evidence: string | null }[];
  contact: { name?: string; emails: string[]; phones: string[]; links: string[] } | null;
  contactLocked: boolean;
  history: { action: string; detail: { reason?: string }; created_at: string; user_name: string }[];
  openings: { openingId: string; title: string; meetsMandatory: boolean; missing: string[]; niceMet: string; fit: number; decision: string | null }[];
}

// ---------- Piezas compartidas con el tablero de resultados ----------

/** Nivel del score según la hoja de componentes: alto ≥ 80, medio 50-79, bajo < 50. */
export type ScoreLevel = "high" | "medium" | "low";
export const scoreLevel = (s: number): ScoreLevel => (s >= 80 ? "high" : s >= 50 ? "medium" : "low");
const LEVEL_BADGE = { high: "success", medium: "warning", low: "destructive" } as const;

/** Score en dígitos sans serif + "MATCH / 100" + nivel en texto (el estado nunca va solo en color). */
export function ScoreBlock({ score, t, size = 30, stacked }: { score: number; t: Dict; size?: number; stacked?: boolean }) {
  const level = scoreLevel(score);
  return (
    <div className={cn("flex", stacked ? "flex-col items-center gap-1.5" : "items-center gap-3")}>
      <MetricNumber value={score} size={size} className="text-primary" label={`${t.search.match.replace("/ 100", "")}${score} / 100 · ${t.search.level[level]}`} />
      <div className={cn("flex gap-1", stacked ? "flex-col items-center" : "flex-col items-start")} aria-hidden>
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap text-foreground uppercase">{t.search.match}</span>
        <Badge variant={LEVEL_BADGE[level]} className="px-1.5 py-0 text-[10px]">{t.search.level[level]}</Badge>
      </div>
    </div>
  );
}

/** Marca de requisito: ✓ verificado, ? a verificar, × no cumple. */
export const MARK: Record<ReqStatus, { glyph: string; cls: string }> = {
  met: { glyph: "✓", cls: "text-success" },
  unknown: { glyph: "?", cls: "text-warning" },
  unmet: { glyph: "×", cls: "text-destructive" },
};

/** "python: 7,3 y" → "7,3 y"; el detalle de liderazgo es la cita, no un dato corto. */
export const shortDetail = (c: ReqCheck) => {
  const m = c.detail.match(/^.+?:\s*(.+)$/);
  if (m) return m[1] === "—" ? null : m[1];
  return c.detail === "—" || c.detail.length > 24 ? null : c.detail;
};

const Skel = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
const eyebrow = "text-[11px] font-bold tracking-wide text-muted-foreground uppercase";

export function CandidatePanel({ id, t, lang, onClose, explanation, score, checks, decision, onAction, onExplainAi }: {
  id: string; t: Dict; lang: Lang; onClose: () => void;
  explanation?: { match: string[]; gaps: string[]; summary: string; by: string } | "loading";
  /** Desde el ranking: score, requisitos evaluados y decisión actual (en la ficha de Candidatos no vienen). */
  score?: number; checks?: ReqCheck[]; decision?: Decision; onAction?: (s: Decision) => void;
  /** Pide la explicación narrativa a la IA (solo a pedido; se cachea). */
  onExplainAi?: () => void;
}) {
  const [d, setD] = useState<Data | null>(null);
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setD(null);
    fetch(`/api/candidates/${id}`).then((r) => r.json()).then(setD);
  }, [id]);
  useEffect(() => { asideRef.current?.focus(); }, []);
  const loc = lang === "es" ? "es-AR" : "en-US";
  const anon = `${t.cands.hidden} #${id.slice(0, 6)}`;

  // Cita del CV para cada requisito: evidencia de liderazgo o de la skill evaluada
  const quoteFor = (c: ReqCheck): string | null => {
    if (!d || c.status === "unmet") return null;
    if (d.candidate.leadership.some((l) => l.evidence === c.detail)) return c.detail;
    const m = c.detail.match(/^(.+?):\s/);
    if (!m) return null;
    const key = m[1].toLowerCase();
    const pool = key === "cloud" ? ["aws", "gcp", "azure"] : [key];
    return d.skills.find((s) => pool.includes(s.skill.toLowerCase()) && s.evidence)?.evidence ?? null;
  };
  const year = (s: string) => (/^\d{4}/.test(s) ? s.slice(0, 4) : /present|actual|now|hoy/i.test(s) ? t.cand.now : s);
  const linkHref = (l: string) => (/^https?:\/\//i.test(l) ? l : `https://${l}`);
  const linkLabel = (l: string) => {
    if (/linkedin\./i.test(l)) return "LinkedIn";
    if (/github\./i.test(l)) return "GitHub";
    try { return new URL(linkHref(l)).hostname.replace(/^www\./, ""); } catch { return l; }
  };
  const decisionLabel = { selected: t.search.select, shortlisted: t.search.shortlist, discarded: t.search.discard } as const;
  const exp = explanation && explanation !== "loading" ? explanation : null;
  const showWhy = (checks && checks.length > 0) || !!explanation;

  const node = (
    <div className="fixed inset-0 z-40 flex animate-in justify-end bg-forest/30 duration-200 fade-in" onClick={onClose}>
      <aside
        ref={asideRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t.cand.eyebrow}
        onKeyDown={(e) => { if (e.key === "Escape" && !preview) { e.stopPropagation(); onClose(); } }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-[44rem] animate-in overflow-y-auto border-l bg-background px-8 pt-6 pb-12 shadow-xl outline-none duration-300 ease-out slide-in-from-right"
      >
        <div className="flex items-center justify-between">
          <span className={eyebrow}>{t.cand.eyebrow}</span>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-md text-xl leading-none text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t.cand.close}><span aria-hidden>×</span></button>
        </div>

        {!d ? (
          <div role="status" aria-label={t.cand.loading} className="mt-6 flex flex-col gap-3">
            <Skel className="h-9 w-2/3" />
            <Skel className="h-4 w-1/2" />
            <Skel className="h-4 w-1/3" />
            <div className="mt-4 flex gap-3"><Skel className="h-11 w-40" /><Skel className="h-11 w-40" /><Skel className="h-11 w-40" /></div>
            <Skel className="mt-6 h-16 w-full" />
            <Skel className="h-28 w-full" />
          </div>
        ) : (
          <div className="flex animate-wt-fade flex-col">
            {/* Encabezado: nombre (o anónimo para quien no ve contacto), rol, ubicación y score */}
            <header className="mt-5 flex items-start justify-between gap-6">
              <div className="min-w-0">
                <h2 className="text-[30px] leading-tight font-bold">{d.contactLocked ? anon : d.contact?.name ?? anon}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {d.candidate.headline}
                  {d.candidate.seniority && <> · <span className="capitalize">{d.candidate.seniority}</span></>}
                  {" · "}{Number(d.candidate.total_years).toLocaleString(loc)} {t.search.years}
                </p>
                {(d.candidate.country || (d.candidate.work_mode && d.candidate.work_mode !== "unknown")) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {d.candidate.country}
                    {d.candidate.country && d.candidate.work_mode && d.candidate.work_mode !== "unknown" && " · "}
                    {d.candidate.work_mode && d.candidate.work_mode !== "unknown" && <span className="capitalize">{d.candidate.work_mode}</span>}
                  </p>
                )}
              </div>
              {score !== undefined && <ScoreBlock score={score} t={t} size={38} stacked />}
            </header>

            {/* Decisión humana (solo roles que deciden) */}
            {onAction && (
              <div className="mt-6 flex flex-wrap gap-3" role="group" aria-label={t.search.decision}>
                {(["selected", "shortlisted", "discarded"] as const).map((s) => {
                  const active = decision === s;
                  return (
                    <Button
                      key={s}
                      aria-pressed={active}
                      variant={active ? (s === "discarded" ? "destructive" : "default") : "outline"}
                      className="min-w-40 justify-start"
                      onClick={() => onAction(s)}
                    >
                      {decisionLabel[s]}
                    </Button>
                  );
                })}
              </div>
            )}

            <hr className="my-6" />

            {/* Contacto: PII descifrada solo para roles habilitados */}
            <section>
              <h3 className={cn(eyebrow, "mb-2.5")}>{t.cand.contact}</h3>
              {d.contactLocked ? (
                <p className="flex items-center gap-2 rounded-md bg-muted px-4 py-3.5 text-sm text-muted-foreground"><BrandIcon name="keys" className="size-4 shrink-0" /> {t.cand.locked}</p>
              ) : d.contact ? (
                <div className="flex flex-col gap-1.5 text-sm">
                  {d.contact.emails.length + d.contact.phones.length > 0 && <p className="break-words">{[...d.contact.emails, ...d.contact.phones].join(" · ")}</p>}
                  {d.contact.links.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {d.contact.links.map((l) => (
                        <a key={l} href={linkHref(l)} target="_blank" rel="noopener noreferrer" title={l} className="inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline">
                          {linkLabel(l)} <span aria-hidden>↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </section>

            {/* Por qué matchea: requisitos con su evidencia + explicación de la IA */}
            {showWhy && (
              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">{t.cand.why}</h3>
                  <Badge variant="muted" className="px-2.5 py-1"><span aria-hidden>✦</span> {exp?.by === "rules" ? t.search.rulesTag : t.search.aiTag}</Badge>
                </div>
                {checks && checks.length > 0 && (
                  <ul className="flex flex-col gap-3">
                    {checks.map((c, i) => {
                      const quote = quoteFor(c);
                      const short = shortDetail(c);
                      return (
                        <li key={i} className="animate-wt-enter" style={{ animationDelay: `${i * 50}ms` }}>
                          <div className="flex items-baseline justify-between gap-4">
                            <span className={cn("text-sm font-bold", MARK[c.status].cls)}><span aria-hidden>{MARK[c.status].glyph}</span> {c.label}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{t.status[c.status]}{short ? ` · ${short}` : ""}</span>
                          </div>
                          {quote && <blockquote className="mt-1.5 rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">“{quote}”</blockquote>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {explanation === "loading" && (
                  <div role="status" className="mt-4 flex flex-col gap-2">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground"><BrandIcon name="hourglass" className="size-4 animate-pulse text-primary" /> {t.search.explaining}</span>
                    <Skel className="h-3 w-4/5" /><Skel className="h-3 w-1/2" />
                  </div>
                )}
                {exp && (exp.match.length > 0 || exp.gaps.length > 0 ? (
                  <ul className="mt-4 flex animate-wt-fade flex-col gap-1 text-sm">
                    {exp.match.map((m, i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-success">✓</span>{m}</li>)}
                    {exp.gaps.map((g, i) => <li key={`g${i}`} className="flex gap-2 text-muted-foreground"><span aria-hidden className="text-warning">?</span>{g}</li>)}
                  </ul>
                ) : exp.summary ? <p className="mt-4 animate-wt-fade text-sm text-muted-foreground">{exp.summary}</p> : null)}
                {exp?.by === "rules" && onExplainAi && (
                  <button type="button" onClick={onExplainAi}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold text-primary hover:bg-muted">
                    <span aria-hidden>✦</span> {t.search.explainAi}
                  </button>
                )}
              </section>
            )}

            {/* Match inverso con las vacantes abiertas */}
            <section className="mt-8">
              <h3 className="mb-2 text-lg font-bold">{t.cand.alsoFits}</h3>
              {d.openings.length === 0 ? <p className="text-sm text-muted-foreground">{t.cand.noFit}</p> : (
                <ul className="flex flex-col">
                  {d.openings.map((o) => (
                    <li key={o.openingId}>
                      <Link href={`/openings/${o.openingId}`} className="group -mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                        <span className="truncate font-bold group-hover:underline">
                          <span aria-hidden className={o.meetsMandatory ? "text-success" : "text-warning"}>{o.meetsMandatory ? "✓" : "?"}</span> {o.title}
                        </span>
                        <span className={cn("text-[13px]", o.meetsMandatory ? "text-success" : "text-warning")}>
                          {!o.meetsMandatory && `${t.cand.missingList.replace("{list}", o.missing.join(", "))} · `}
                          {o.niceMet} {t.cand.preferred}
                          {o.decision ? ` · ${t.search.tabs[o.decision as Decision]}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <hr className="my-6" />

            {/* Skills, experiencia, idiomas y formación (perfil anonimizado) */}
            <section>
              <h3 className="mb-3 text-lg font-bold">{t.cand.skillsExp}</h3>
              {d.candidate.summary && <p className="mb-4 text-sm leading-relaxed">{d.candidate.summary}</p>}
              {d.skills.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label={t.cand.skills}>
                  {d.skills.map((s) => (
                    <span key={s.skill} title={s.evidence ?? undefined} className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-bold">
                      {s.skill} · {Number(s.years).toLocaleString(loc)} {t.search.years}
                    </span>
                  ))}
                </div>
              )}
              {d.candidate.experience.length > 0 && (
                <ol className="mt-5 flex flex-col gap-3.5" aria-label={t.cand.experience}>
                  {d.candidate.experience.map((e, i) => (
                    <li key={i} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 text-sm">
                      <span className="text-[13px] text-muted-foreground">{year(e.start)} – {year(e.end)}</span>
                      <div>
                        <div className="font-bold">{e.title}{e.company_type ? <span className="font-normal text-muted-foreground"> · {e.company_type}</span> : null}</div>
                        {e.summary && <p className="mt-0.5 text-[13px] text-muted-foreground">{e.summary}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {d.candidate.leadership.length > 0 && (
                <div className="mt-5">
                  <h4 className={cn(eyebrow, "mb-2")}>{t.cand.leadership}</h4>
                  <ul className="flex flex-col gap-1.5">
                    {d.candidate.leadership.map((l, i) => (
                      <li key={i}><blockquote className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">“{l.evidence}”</blockquote></li>
                    ))}
                  </ul>
                </div>
              )}
              {(d.candidate.languages.length > 0 || d.candidate.education.length > 0) && (
                <div className="mt-5 flex flex-col gap-1.5 text-sm">
                  {d.candidate.languages.length > 0 && (
                    <p><span className="sr-only">{t.cand.languages}: </span>{d.candidate.languages.map((l) => (l.level ? `${l.name} · ${l.level}` : l.name)).join(" / ")}</p>
                  )}
                  {d.candidate.education.length > 0 && (
                    <p className="text-muted-foreground"><span className="sr-only">{t.cand.education}: </span>{d.candidate.education.map((e) => [e.degree, e.field].filter(Boolean).join(" · ")).join(" / ")}</p>
                  )}
                </div>
              )}
            </section>

            <hr className="my-6" />

            {/* Historial de decisiones (audit_log) */}
            <section>
              <h3 className="mb-3 text-lg font-bold">{t.cand.history}</h3>
              {d.history.length === 0 ? <p className="text-sm text-muted-foreground">{t.cand.noHistory}</p> : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {d.history.map((h, i) => (
                    <li key={i} className={i === 0 ? "text-foreground" : "text-muted-foreground"}>
                      <span className="font-bold">{h.user_name}</span> {t.cand.acts[h.action as keyof typeof t.cand.acts] ?? h.action}
                      {" · "}{new Date(h.created_at).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" })}
                      {h.detail?.reason ? ` · “${h.detail.reason}”` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* El original tiene PII: mismo permiso que el contacto */}
            {!d.contactLocked && d.candidate.document_id && d.candidate.file_name && d.candidate.mime_type && (
              <button
                type="button"
                onClick={() => setPreview({ id: d.candidate.document_id!, file_name: d.candidate.file_name!, mime_type: d.candidate.mime_type! })}
                title={d.candidate.file_name}
                className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-bold text-primary underline-offset-4 hover:underline"
              >
                <BrandIcon name="document" className="size-4" /> {t.cand.original} <span aria-hidden>↗</span>
              </button>
            )}
          </div>
        )}
        {/* Dentro del aside: los clics del modal (portal) burbujean en React y no deben cerrar el panel */}
        <FilePreviewDialog doc={preview} t={t} onClose={() => setPreview(null)} />
      </aside>
    </div>
  );

  // Portal al body: el panel es fixed y no debe quedar atrapado por ancestros animados (translate crea contenedor)
  return typeof document === "undefined" ? node : createPortal(node, document.body);
}
