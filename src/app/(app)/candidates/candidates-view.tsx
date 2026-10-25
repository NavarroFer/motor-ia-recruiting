"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, EyeOff } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { DocStatus } from "@/components/app/doc-status";
import { Illo } from "@/components/brand/brand";
import { cn } from "@/lib/utils";
import { CandidatePanel } from "../search/candidate-panel";

interface C {
  id: string; name: string | null; headline: string; seniority: string | null; total_years: string; country: string | null; work_mode: string | null;
  created_at: string; has_embedding: boolean; file_name: string | null; doc_status: string | null;
  skills: { skill: string; years: number }[] | null;
}

type IndexFilter = "" | "semantic" | "skills";

const PAGE = 20;
// Misma grilla para encabezado y filas. En mobile: candidato + índice.
const COLS = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_8rem_4.5rem]";
// Divisor con sangría (como el mockup) y hover a todo el ancho.
const ROW_LINE = "relative after:absolute after:right-5 after:bottom-0 after:left-5 after:h-px after:bg-border";

/** Modalidad traducida; "unknown" no se muestra. */
function modeOf(t: Dict, m: string | null): string | null {
  if (!m || m === "unknown") return null;
  return (t.cands.modes as Record<string, string>)[m] ?? m;
}

const cap = (s: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : null);

export function CandidatesView({ t, lang, canUpload = false, anonymized = false, initialPanel = null }: { t: Dict; lang: Lang; canUpload?: boolean; anonymized?: boolean; initialPanel?: string | null }) {
  const [list, setList] = useState<C[] | null>(null);
  const [namesVisible, setNamesVisible] = useState(!anonymized);
  const [filter, setFilter] = useState("");
  const [indexType, setIndexType] = useState<IndexFilter>("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<string | null>(initialPanel);
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

  const countries = useMemo(
    () => Array.from(new Set((list ?? []).map((c) => c.country).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b)),
    [list],
  );

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (list ?? []).filter((c) =>
      (!indexType || (indexType === "semantic") === c.has_embedding) &&
      (!country || c.country === country) &&
      (!f || [c.name, c.headline, c.seniority, c.country, c.work_mode, modeOf(t, c.work_mode), ...(c.skills ?? []).map((s) => s.skill)].join(" ").toLowerCase().includes(f)),
    );
  }, [list, filter, indexType, country, t]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = shown.slice(cur * PAGE, (cur + 1) * PAGE);
  const num = (n: number) => n.toLocaleString(loc);
  const yrs = (n: number | string) => `${Number(n).toLocaleString(loc, { maximumFractionDigits: 1 })}${t.search.years}`;
  const clear = () => { setFilter(""); setIndexType(""); setCountry(""); setPage(0); };

  return (
    <div className="flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title={t.cands.title}
        sub={(namesVisible ? t.cands.sub : t.cands.subAnon).replace("{n}", list ? num(list.length) : "…")}
        actions={!namesVisible && (
          <Badge variant="muted" title={t.cands.anonHint} className="h-8 animate-wt-fade px-3">
            <EyeOff aria-hidden />{t.cands.anonView}<span className="sr-only">. {t.cands.anonHint}</span>
          </Badge>
        )}
      />

      <div className="flex animate-wt-enter flex-col gap-3 [animation-delay:60ms] md:flex-row md:items-center">
        <Input
          type="search"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(0); }}
          placeholder={t.cands.searchPh}
          aria-label={t.cands.searchPh}
          className="h-12 md:flex-1"
        />
        <NativeSelect
          aria-label={t.cands.indexType}
          value={indexType}
          onChange={(e) => { setIndexType(e.target.value as IndexFilter); setPage(0); }}
          className="h-12 bg-card pl-4 font-bold text-primary md:w-44"
        >
          <option value="">{t.cands.indexType}</option>
          <option value="semantic">{t.cands.semanticShort}</option>
          <option value="skills">{t.cands.skillsShort}</option>
        </NativeSelect>
        <NativeSelect
          aria-label={t.cands.country}
          value={country}
          onChange={(e) => { setCountry(e.target.value); setPage(0); }}
          className="h-12 bg-card pl-4 font-bold text-primary md:w-48"
        >
          <option value="">{t.cands.country}</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </NativeSelect>
      </div>

      {list && list.length === 0 ? (
        <div className="flex animate-wt-enter flex-col items-center rounded-xl border bg-card px-6 py-16 text-center [animation-delay:120ms]">
          <Illo name="windows" className="w-36 animate-wt-globe [animation-delay:200ms]" />
          <h2 className="mt-7 text-2xl font-bold text-foreground">{t.cands.emptyTitle}</h2>
          <p className="mt-2.5 text-[15px] text-muted-foreground">{t.cands.emptySub}</p>
          {canUpload && <Link href="/upload" className={cn(buttonVariants({ size: "lg" }), "mt-7")}>{t.nav.upload}</Link>}
        </div>
      ) : (
        <div className="animate-wt-enter [animation-delay:120ms]">
          <div role="table" aria-label={t.nav.candidates} className="overflow-hidden rounded-xl border bg-card">
            <div role="rowgroup" className="border-b border-primary bg-primary">
              <div role="row" className={cn(COLS, "px-5 py-4 text-[11px] font-bold tracking-wide text-white uppercase")}>
                <span role="columnheader">{t.cands.roleCol}</span>
                <span role="columnheader" className="hidden md:block">{t.cands.skills}</span>
                <span role="columnheader" className="hidden md:block">{t.cands.locationCol}</span>
                <span role="columnheader">{t.cands.index}</span>
                <span role="columnheader" className="hidden md:block">{t.cands.added}</span>
              </div>
            </div>

            <div role="rowgroup" className="pb-4">
              {!list && <RowsSkeleton />}

              {list && shown.length === 0 && (
                <div role="row" className="px-5 py-14">
                  <div role="cell" className="flex animate-wt-fade flex-col items-center gap-4 text-center">
                    <p className="text-[15px] font-bold text-foreground">{t.cands.noMatch}</p>
                    <Button variant="outline" onClick={clear}>{t.cands.clear}</Button>
                  </div>
                </div>
              )}

              {rows.map((c, i) => {
                const skills = c.skills ?? [];
                const top = skills.slice(0, 2).map((s) => `${s.skill} ${yrs(s.years)}`).join(" · ");
                const more = skills.length - 2;
                const place = [c.country, modeOf(t, c.work_mode)].filter(Boolean).join(" · ");
                const added = new Date(c.created_at);
                const indexLabel = c.has_embedding ? t.cands.semanticShort : t.cands.skillsShort;
                return (
                  <div
                    role="row"
                    key={c.id}
                    onClick={() => setPanel(c.id)}
                    style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                    className={cn(COLS, ROW_LINE, "animate-wt-enter cursor-pointer px-5 py-4 transition-colors hover:bg-paper")}
                  >
                    <div role="cell" className="min-w-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPanel(c.id); }}
                        className="max-w-full truncate rounded-sm text-left text-[15px] font-bold text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {namesVisible
                          ? c.name ?? <span className="font-semibold text-muted-foreground italic">{t.cands.noName}</span>
                          : `${t.cands.hidden} #${c.id.slice(0, 6)}`}
                      </button>
                      <p className="mt-1 truncate text-[13px] text-muted-foreground">
                        {[c.headline, cap(c.seniority), yrs(c.total_years)].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground md:hidden">{[top, place].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div role="cell" className="hidden min-w-0 text-[13px] text-foreground md:block" title={skills.map((s) => `${s.skill} ${yrs(s.years)}`).join(" · ")}>
                      <p className="truncate">
                        {top || "—"}
                        {more > 0 && <span className="text-muted-foreground"> · +{more}</span>}
                      </p>
                    </div>
                    <div role="cell" className="hidden truncate text-[13px] text-muted-foreground md:block">{place || "—"}</div>
                    <div role="cell" className="flex min-w-0 flex-col items-start gap-1.5">
                      <Badge variant="muted" title={c.has_embedding ? t.cands.semantic : t.cands.skillsOnly} className="px-2.5 py-1 md:w-full">
                        {indexLabel}
                      </Badge>
                      {c.doc_status && c.doc_status !== "indexed" && <DocStatus status={c.doc_status} t={t} className="md:w-full" />}
                    </div>
                    <div role="cell" className="hidden text-[13px] text-muted-foreground tabular-nums md:block" title={added.toLocaleString(loc)}>
                      {added.toLocaleDateString(loc, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {shown.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-5 pl-5">
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {t.cands.showing.replace("{a}", num(cur * PAGE + 1)).replace("{b}", num(cur * PAGE + rows.length)).replace("{n}", num(shown.length))}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="lg" className="min-w-28" disabled={cur === 0} onClick={() => setPage(cur - 1)}>{t.cands.prev}</Button>
                <Button variant="outline" size="lg" className="min-w-28" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
                  {t.cands.next}<ArrowRight aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {panel && <CandidatePanel id={panel} t={t} lang={lang} onClose={() => setPanel(null)} />}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div role="row" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-6 px-5 py-5">
          <div className="flex w-64 flex-col gap-2">
            <div className="h-3.5 w-40 animate-pulse rounded-sm bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded-sm bg-muted" />
          </div>
          <div className="hidden h-3 w-40 animate-pulse rounded-sm bg-muted md:block" />
          <div className="ml-auto h-6 w-28 animate-pulse rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  );
}
