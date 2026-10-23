"use client";
import { useEffect, useMemo, useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { CandidatePanel } from "../search/candidate-panel";
import { DocStatus } from "@/components/app/doc-status";

interface C {
  id: string; name: string | null; headline: string; seniority: string | null; total_years: string; country: string | null; work_mode: string | null;
  created_at: string; has_embedding: boolean; file_name: string | null; doc_status: string | null;
  skills: { skill: string; years: number }[] | null;
}

export function CandidatesView({ t, lang }: { t: Dict; lang: Lang }) {
  const [list, setList] = useState<C[] | null>(null);
  const [namesVisible, setNamesVisible] = useState(false);
  const [filter, setFilter] = useState("");
  const [panel, setPanel] = useState<string | null>(null);
  const loc = lang === "es" ? "es-AR" : "en-US";

  useEffect(() => {
    const load = () => fetch("/api/candidates").then((r) => r.json()).then((j) => {
        setList(j.candidates);
        setNamesVisible(Boolean(j.namesVisible));
      });
    load();
    const id = setInterval(load, 5000); // aparecen los recién procesados
    return () => clearInterval(id);
  }, []);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!list || !f) return list ?? [];
    return list.filter((c) =>
      [c.name, c.headline, c.seniority, c.country, c.work_mode, ...(c.skills ?? []).map((s) => s.skill)].join(" ").toLowerCase().includes(f),
    );
  }, [list, filter]);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t.nav.candidates}</h1>
          <p className="text-sm text-muted-foreground">{list ? `${shown.length} / ${list.length} ${t.cands.profiles}` : "…"}</p>
        </div>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.cands.filter} className="max-w-xs" />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-foreground text-left text-xs uppercase tracking-wide text-background">
            <tr>
              <th className="px-4 py-2">{t.cands.profile}</th>
              <th className="px-4 py-2">{t.cands.skills}</th>
              <th className="px-4 py-2">{t.cands.location}</th>
              <th className="px-4 py-2">{t.cands.index}</th>
              <th className="px-4 py-2">{t.cands.added}</th>
            </tr>
          </thead>
          <tbody>
            {!list && <tr><td colSpan={5} className="px-4 py-6"><div className="h-6 animate-pulse rounded bg-muted" /></td></tr>}
            {shown.map((c) => (
              <tr key={c.id} onClick={() => setPanel(c.id)} className="cursor-pointer border-t align-top even:bg-muted/40 hover:bg-secondary/60">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {namesVisible
                      ? c.name ?? <span className="italic text-muted-foreground">{t.cands.noName}</span>
                      : `${t.cands.hidden} #${c.id.slice(0, 6)}`}
                  </div>
                  <div className="text-sm">{c.headline}</div>
                  <div className="text-xs text-muted-foreground">{[c.seniority, `${Number(c.total_years).toLocaleString(loc)} ${t.search.years}`].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(c.skills ?? []).map((s) => (
                      <span key={s.skill} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s.skill} <span className="text-muted-foreground">{Number(s.years).toLocaleString(loc)}</span></span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{[c.country, c.work_mode].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    {c.doc_status && <DocStatus status={c.doc_status} t={t} />}
                    <span className="text-xs text-muted-foreground">{c.has_embedding ? t.cands.semantic : t.cands.skillsOnly}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleString(loc, { dateStyle: "short", timeStyle: "short" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {panel && <CandidatePanel id={panel} t={t} lang={lang} onClose={() => setPanel(null)} />}
    </div>
  );
}
