"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, FileText, Lock, Sparkles, X } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { FilePreviewDialog, type PreviewDoc } from "@/components/app/file-preview";

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

export function CandidatePanel({ id, t, lang, onClose, explanation }: {
  id: string; t: Dict; lang: Lang; onClose: () => void;
  explanation?: { match: string[]; gaps: string[]; summary: string; by: string } | "loading";
}) {
  const [d, setD] = useState<Data | null>(null);
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  useEffect(() => {
    setD(null);
    fetch(`/api/candidates/${id}`).then((r) => r.json()).then(setD);
  }, [id]);
  const maxYears = d ? Math.max(1, ...d.skills.map((s) => Number(s.years))) : 1;
  const loc = lang === "es" ? "es-AR" : "en-US";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-foreground/20" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-right rounded p-1 hover:bg-muted" aria-label={t.cand.close}><X className="size-4" /></button>
        {!d ? <div className="h-40 animate-pulse rounded bg-muted" /> : (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-semibold">{d.contact?.name ?? d.candidate.headline}</h2>
              <p className="text-muted-foreground">{d.candidate.headline} · {d.candidate.seniority} · {Number(d.candidate.total_years).toLocaleString(loc)} {t.search.years}{d.candidate.country ? ` · ${d.candidate.country}` : ""}</p>
              {/* El original tiene PII: mismo permiso que el contacto */}
              {!d.contactLocked && d.candidate.document_id && d.candidate.file_name && d.candidate.mime_type && (
                <button
                  type="button"
                  onClick={() => setPreview({ id: d.candidate.document_id!, file_name: d.candidate.file_name!, mime_type: d.candidate.mime_type! })}
                  className="mt-2 flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                >
                  <FileText className="size-4" />{t.cand.original} · {d.candidate.file_name}
                </button>
              )}
            </div>

            <section className="rounded-lg border bg-card p-4 text-sm">
              <h3 className="mb-2 font-medium">{t.cand.contact}</h3>
              {d.contactLocked ? (
                <p className="flex items-center gap-2 text-muted-foreground"><Lock className="size-4" /> {t.cand.locked}</p>
              ) : d.contact ? (
                <div className="flex flex-col gap-1">
                  {d.contact.emails.map((e) => <span key={e}>{e}</span>)}
                  {d.contact.phones.map((p) => <span key={p}>{p}</span>)}
                  {d.contact.links.map((l) => <span key={l} className="text-primary">{l}</span>)}
                </div>
              ) : null}
            </section>

            {explanation && explanation !== "loading" && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 font-medium">{t.cand.why} <Badge variant="muted"><Sparkles /> {t.search.aiTag}</Badge></h3>
                <ul className="list-disc pl-5 text-sm">{explanation.match.map((m, i) => <li key={i}>{m}</li>)}</ul>
                {explanation.gaps.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{explanation.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>}
              </section>
            )}

            <section>
              <h3 className="mb-2 font-medium">{t.open.fitsIn}</h3>
              {d.openings.length === 0 ? <p className="text-sm text-muted-foreground">{t.open.noFit}</p> : (
                <div className="flex flex-col gap-1.5">
                  {d.openings.map((o) => (
                    <Link key={o.openingId} href={`/openings/${o.openingId}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted">
                      <span className="flex items-center gap-2">
                        {o.meetsMandatory ? <Check className="size-4 text-success" /> : <X className="size-4 text-destructive" />}
                        {o.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {o.meetsMandatory ? `${o.niceMet} ${t.open.nice}` : `${t.open.missing}: ${o.missing.join(", ")}`}
                        {o.decision ? ` · ${t.search.tabs[o.decision as "selected"]}` : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <p className="text-sm">{d.candidate.summary}</p>

            <section>
              <h3 className="mb-2 font-medium">{t.cand.skills}</h3>
              <div className="flex flex-col gap-1.5">
                {d.skills.map((s) => (
                  <div key={s.skill} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm" title={s.evidence ?? ""}>
                    <span>{s.skill}</span>
                    <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(Number(s.years) / maxYears) * 100}%` }} /></div>
                    <span className="text-right text-muted-foreground">{Number(s.years).toLocaleString(loc)} {t.search.years}</span>
                  </div>
                ))}
              </div>
            </section>

            {d.candidate.leadership.length > 0 && (
              <section>
                <h3 className="mb-2 font-medium">{t.cand.leadership}</h3>
                <ul className="list-disc pl-5 text-sm">{d.candidate.leadership.map((l, i) => <li key={i}>{l.evidence}</li>)}</ul>
              </section>
            )}

            <section>
              <h3 className="mb-2 font-medium">{t.cand.experience}</h3>
              <ol className="flex flex-col gap-3 border-l pl-4">
                {d.candidate.experience.map((e, i) => (
                  <li key={i} className="text-sm">
                    <div className="font-medium">{e.title}{e.company_type ? <span className="font-normal text-muted-foreground"> · {e.company_type}</span> : null}</div>
                    <div className="text-xs text-muted-foreground">{e.start} – {e.end}</div>
                    {e.summary && <div>{e.summary}</div>}
                  </li>
                ))}
              </ol>
            </section>

            <section className="grid grid-cols-2 gap-4 text-sm">
              <div><h3 className="mb-1 font-medium">{t.cand.languages}</h3>{d.candidate.languages.map((l) => <div key={l.name}>{l.name}{l.level ? ` (${l.level})` : ""}</div>)}</div>
              <div><h3 className="mb-1 font-medium">{t.cand.education}</h3>{d.candidate.education.map((e, i) => <div key={i}>{e.degree}{e.field ? `, ${e.field}` : ""}</div>)}</div>
            </section>

            <section>
              <h3 className="mb-2 font-medium">{t.cand.history}</h3>
              {d.history.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
                <ul className="flex flex-col gap-1 text-sm">
                  {d.history.map((h, i) => (
                    <li key={i}><span className="font-medium">{h.user_name}</span> · {h.action}{h.detail?.reason ? ` · “${h.detail.reason}”` : ""} · <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString(loc)}</span></li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
        {/* Dentro del aside: los clics del modal (portal) burbujean en React y no deben cerrar el panel */}
        <FilePreviewDialog doc={preview} t={t} onClose={() => setPreview(null)} />
      </aside>
    </div>
  );
}
