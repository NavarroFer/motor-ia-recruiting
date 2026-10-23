"use client";
import { useEffect, useRef, useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Requirements } from "@/lib/ai/prompts";
import type { SearchOutput } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequirementsEditor } from "@/components/app/requirements-editor";
import { ResultsBoard } from "@/components/app/results-board";

const EXAMPLES = [
  "Python developer with 3+ years in cloud projects and leadership",
  "Data engineer with GCP and SQL",
  "Senior React developer, remote",
];

export function SearchView({ t, lang, canDecide, initialQuery }: { t: Dict; lang: Lang; canDecide: boolean; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<SearchOutput | null>(null);
  const [reqs, setReqs] = useState<Requirements | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const ran = useRef(false);

  const run = async (q: string, requirements?: Requirements) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    const res = await fetch("/api/search", { method: "POST", body: JSON.stringify({ query: q, requirements }) });
    const out = (await res.json()) as SearchOutput;
    setLoading(false);
    setData(out);
    setReqs(out.requirements);
    setDirty(false);
  };

  useEffect(() => {
    if (initialQuery && !ran.current) { ran.current = true; run(initialQuery); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.nav.search}</h1>
      <form onSubmit={(e) => { e.preventDefault(); run(query); }} className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search.placeholder} className="h-12 text-base" />
        <Button type="submit" className="h-12 px-6" disabled={loading}>{t.search.run}</Button>
      </form>

      {!data && !loading && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {t.search.examples}
          {EXAMPLES.map((e) => <button key={e} onClick={() => { setQuery(e); run(e); }} className="rounded-full border bg-card px-3 py-1 hover:text-foreground">{e}</button>)}
        </div>
      )}
      {loading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}

      {data && reqs && !loading && (
        <>
          <RequirementsEditor reqs={reqs} t={t} onChange={(r) => { setReqs(r); setDirty(true); }}
            footer={<SearchInfo data={data} t={t} lang={lang} action={dirty ? <Button size="sm" onClick={() => run(query, reqs)}>{t.search.rerun}</Button> : null} />} />
          <ResultsBoard key={data.searchId + data.durationMs} data={data} t={t} lang={lang} canDecide={canDecide} />
        </>
      )}
    </div>
  );
}

export function SearchInfo({ data, t, lang, action }: { data: SearchOutput; t: Dict; lang: Lang; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        {data.results.length} {t.search.found} · {(data.durationMs / 1000).toLocaleString(lang === "es" ? "es-AR" : "en-US", { maximumFractionDigits: 2 })} s
        {data.parsedBy === "rules" && ` · ${t.search.parsedRules}`}
        {!data.semantic && ` · ${t.search.semanticOff}`}
      </span>
      {action}
    </div>
  );
}
