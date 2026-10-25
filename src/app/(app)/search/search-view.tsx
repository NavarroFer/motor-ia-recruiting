"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, History, SquarePen } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Requirements } from "@/lib/ai/prompts";
import type { RecentSearch, SearchOutput } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequirementsEditor } from "@/components/app/requirements-editor";
import { ResultsBoard } from "@/components/app/results-board";
import { Illo } from "@/components/brand/brand";
import { BrandIcon } from "@/components/brand/icons";
import { cn } from "@/lib/utils";

/** Un turno de la conversación: la consulta del reclutador y la respuesta (requisitos + ranking). */
type Turn = { id: number; query: string; status: "loading" | "done" | "error"; data?: SearchOutput; reqs?: Requirements; dirty?: boolean; rerunning?: boolean };

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
const plural = (o: { one: string; other: string }, n: number) => fill(n === 1 ? o.one : o.other, { n });
// Misma clave con la que el SQL agrupa las búsquedas recientes: lower(btrim(query))
const keyOf = (s: string) => s.trim().toLowerCase();
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

async function fetchSearch(query: string, requirements?: Requirements) {
  const res = await fetch("/api/search", { method: "POST", body: JSON.stringify({ query, requirements }) });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return (await res.json()) as SearchOutput;
}

/**
 * Búsqueda como conversación: cada consulta es un turno (burbuja del reclutador + respuesta con requisitos
 * editables y ranking). Solo el turno abierto monta el tablero; los anteriores quedan resumidos.
 * Cada turno es una búsqueda completa: no hereda los requisitos del anterior.
 */
export function SearchView({ t, lang, canDecide, initialQuery, recent: initialRecent }: {
  t: Dict; lang: Lang; canDecide: boolean; initialQuery: string; recent: RecentSearch[];
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [recent, setRecent] = useState(initialRecent);
  const nextId = useRef(0);
  const ran = useRef<string | null>(null);
  const busy = turns.some((x) => x.status === "loading");
  const current = turns.find((x) => x.id === open);

  const patch = (id: number, p: Partial<Turn>) => setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, ...p } : x)));
  // La consulta queda en la URL: recargar o compartir el link repite la búsqueda (cacheada)
  const syncUrl = (q: string | null) => window.history.replaceState(null, "", q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  // La búsqueda recién corrida sube al tope del historial y reemplaza la fila de la misma consulta
  const remember = (out: SearchOutput) => setRecent((rs) => {
    const prev = rs.find((r) => !r.openingId && keyOf(r.query) === keyOf(out.query));
    const row = { id: out.searchId, query: out.query, resultCount: out.results.length, createdAt: new Date().toISOString(), openingId: null, shortlisted: prev?.shortlisted ?? 0 };
    return [row, ...rs.filter((r) => r !== prev)];
  });

  const run = async (id: number, query: string) => {
    try {
      const out = await fetchSearch(query);
      patch(id, { status: "done", data: out, reqs: out.requirements, dirty: false });
      remember(out);
    } catch {
      patch(id, { status: "error" });
    }
  };
  const ask = (raw: string, opts?: { fresh?: boolean }) => {
    const query = raw.trim();
    if (query.length < 2 || busy) return;
    const id = ++nextId.current;
    setTurns((ts) => [...(opts?.fresh ? [] : ts), { id, query, status: "loading" }]);
    setOpen(id);
    setDraft("");
    syncUrl(query);
    run(id, query);
  };
  const retry = (turn: Turn) => {
    patch(turn.id, { status: "loading" });
    setOpen(turn.id);
    run(turn.id, turn.query);
  };
  const rerun = async (turn: Turn) => {
    patch(turn.id, { rerunning: true });
    try {
      const out = await fetchSearch(turn.query, turn.reqs);
      patch(turn.id, { data: out, reqs: out.requirements, dirty: false, rerunning: false });
      remember(out);
    } catch {
      patch(turn.id, { rerunning: false });
    }
  };
  const reset = () => {
    setTurns([]);
    setOpen(null);
    setDraft("");
    syncUrl(null);
  };

  useEffect(() => {
    if (initialQuery && ran.current !== initialQuery) { ran.current = initialQuery; ask(initialQuery, { fresh: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // El turno que se abre (nuevo o desde "Ver resultados") sube al tope, como en un chat
  useEffect(() => {
    if (open !== null) document.getElementById(`turn-${open}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  const composer = (placeholder: string) => (
    <Composer value={draft} onChange={setDraft} onSubmit={() => ask(draft)} disabled={busy} placeholder={placeholder} t={t} />
  );

  return (
    <div className="-mb-16 flex gap-8">
      <RecentPanel recent={recent} t={t} activeKey={current ? keyOf(current.query) : null} disabled={busy}
        onPick={(q) => ask(q, { fresh: true })} onNew={reset} />

      <div className="flex min-h-[calc(100dvh-6.25rem)] min-w-0 flex-1 flex-col">
        {turns.length === 0 ? (
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 pt-6 pb-20">
            <div className="flex animate-wt-enter flex-col items-center gap-3 text-center">
              <Illo name="cursor" className="w-16" />
              <h1 className="text-[31px] leading-tight font-bold">{t.search.emptyTitle}</h1>
              <p className="text-sm text-muted-foreground">{t.search.sub}</p>
            </div>
            <div className="animate-wt-enter [animation-delay:80ms]">{composer(t.search.placeholder)}</div>
            <div className="flex animate-wt-enter flex-col gap-3 [animation-delay:160ms]">
              <p className="text-[13px] text-muted-foreground">{t.search.emptySub}</p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {t.search.exampleQueries.map((e) => (
                  <button key={e} type="button" onClick={() => ask(e)}
                    className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3.5 text-left text-sm leading-snug transition-colors outline-none hover:border-primary/50 hover:bg-paper focus-visible:ring-2 focus-visible:ring-ring/50">
                    <span aria-hidden className="text-primary">✦</span>{e}
                  </button>
                ))}
              </div>
            </div>
            {/* Sin panel lateral (pantallas chicas), las recientes van acá */}
            {recent.length > 0 && (
              <div className="flex animate-wt-enter flex-col gap-3 [animation-delay:240ms] lg:hidden">
                <h2 className="flex items-center gap-2 text-[15px] font-bold"><History aria-hidden className="size-4 text-primary" /> {t.search.history}</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {recent.slice(0, 4).map((r) => (
                    <li key={r.id}><RecentItem r={r} t={t} active={false} disabled={busy} onPick={(q) => ask(q, { fresh: true })} className="border bg-card px-3.5 py-3" /></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <h1 className="sr-only">{t.nav.search}</h1>
            <div className="mx-auto mb-6 flex w-full max-w-5xl justify-end lg:hidden">
              <Button variant="outline" onClick={reset}><SquarePen /> {t.dash.newSearch}</Button>
            </div>
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 pb-6">
              {turns.map((turn, i) => (
                <TurnView key={turn.id} turn={turn} isOpen={turn.id === open} isLast={i === turns.length - 1} t={t} lang={lang} canDecide={canDecide}
                  onReqs={(r) => patch(turn.id, { reqs: r, dirty: true })} onRerun={() => rerun(turn)}
                  onRetry={() => retry(turn)} onExpand={() => setOpen(turn.id)} />
              ))}
            </div>
            <div className="sticky bottom-0 z-10 mx-auto w-full max-w-5xl bg-linear-to-t from-background from-70% to-transparent pt-10 pb-5">
              {composer(t.search.followUp)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TurnView({ turn, isOpen, isLast, t, lang, canDecide, onReqs, onRerun, onRetry, onExpand }: {
  turn: Turn; isOpen: boolean; isLast: boolean; t: Dict; lang: Lang; canDecide: boolean;
  onReqs: (r: Requirements) => void; onRerun: () => void; onRetry: () => void; onExpand: () => void;
}) {
  const d = turn.data;
  return (
    // El último turno ocupa casi una pantalla: así puede subir al tope mientras carga, como en un chat
    <section id={`turn-${turn.id}`} aria-label={turn.query} className={cn("flex scroll-mt-6 flex-col gap-5", isLast && "min-h-[calc(100dvh-13rem)]")}>
      <div className="flex justify-end">
        <p className="max-w-[85%] animate-wt-enter rounded-xl rounded-br-sm bg-forest px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-cream">{turn.query}</p>
      </div>

      <div className="flex min-w-0 animate-wt-fade flex-col gap-4">
        <div className="flex items-center gap-2 text-[13px] font-bold text-primary">
          <span aria-hidden className="grid size-7 place-items-center rounded-md bg-primary text-cream"><BrandIcon name="cursor" className="size-4" /></span>
          {t.search.assistant}
        </div>

        {turn.status === "loading" && (
          <div role="status" className="flex items-center gap-3 text-[15px] text-muted-foreground">
            <span aria-hidden className="flex gap-1">
              {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-wt-dot rounded-full bg-primary" style={{ animationDelay: `${i * 160}ms` }} />)}
            </span>
            {t.search.searching}
          </div>
        )}

        {turn.status === "error" && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-[15px]">
            <span className="text-destructive">{t.search.error}</span>
            <Button size="sm" variant="outline" onClick={onRetry}>{t.search.retry}</Button>
          </div>
        )}

        {turn.status === "done" && d && turn.reqs && (
          <>
            <p className="text-[15px] leading-relaxed">{t.search.understood}</p>
            <RequirementsEditor reqs={turn.reqs} t={t} readOnly={!isOpen} onChange={onReqs}
              footer={<SearchInfo data={d} t={t} lang={lang}
                action={isOpen && turn.dirty ? <Button size="sm" disabled={turn.rerunning} onClick={onRerun}>{t.search.rerun}</Button> : null} />} />
            <p className="text-[15px] leading-relaxed">
              {d.results.length > 0 ? <span className="font-bold">{plural(t.search.foundLine, d.results.length)}</span> : t.search.noneSub}
              {d.results.length > 0 && d.notMeeting.length > 0 && <span className="text-muted-foreground"> {plural(t.search.notMeetingLine, d.notMeeting.length)}</span>}
            </p>
            {isOpen ? (
              <div className={cn("flex flex-col gap-6 transition-opacity", turn.rerunning && "pointer-events-none opacity-50")}>
                <ResultsBoard key={d.searchId + d.durationMs} data={d} t={t} lang={lang} canDecide={canDecide} />
              </div>
            ) : (
              <Button variant="outline" className="self-start" onClick={onExpand}>{t.search.showResults}</Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** Caja de texto estilo chat: crece con el contenido, Enter envía y Shift + Enter agrega una línea. */
function Composer({ value, onChange, onSubmit, disabled, placeholder, t }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; disabled: boolean; placeholder: string; t: Dict;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && value.trim().length >= 2;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={(e) => { e.preventDefault(); if (canSend) onSubmit(); }}
        className="flex items-end gap-2 rounded-xl border bg-card p-2 pl-4 shadow-[0_8px_28px_-14px_rgb(4_61_50/0.35)] transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
        <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) onSubmit(); }
          }}
          placeholder={placeholder} aria-label={t.nav.search}
          className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent py-2 text-base leading-6 outline-none placeholder:text-muted-foreground" />
        <button type="submit" disabled={!canSend} aria-label={t.search.run} title={t.search.run}
          className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-colors outline-none hover:bg-forest focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted disabled:text-muted-foreground">
          <ArrowUp aria-hidden className="size-5" strokeWidth={2.5} />
        </button>
      </form>
      <div className="flex justify-between gap-4 px-1 text-xs text-muted-foreground">
        <span>{t.shell.footer}</span>
        <span className="hidden sm:inline">{t.search.hint}</span>
      </div>
    </div>
  );
}

/** Historial agrupado por fecha (hoy, ayer, últimos 7 días, anteriores); las filas ya vienen de la más nueva a la más vieja. */
function groupRecent(rows: RecentSearch[], t: Dict) {
  const today = dayStart(new Date());
  const groups: { label: string; rows: RecentSearch[] }[] = [];
  for (const r of rows) {
    const diff = Math.round((today - dayStart(new Date(r.createdAt))) / 86_400_000);
    const label = diff <= 0 ? t.dash.today : diff === 1 ? t.dash.yesterday : diff < 7 ? t.search.earlier : t.search.older;
    const last = groups.at(-1);
    if (last?.label === label) last.rows.push(r);
    else groups.push({ label, rows: [r] });
  }
  return groups;
}

function RecentPanel({ recent, t, activeKey, disabled, onPick, onNew }: {
  recent: RecentSearch[]; t: Dict; activeKey: string | null; disabled: boolean; onPick: (q: string) => void; onNew: () => void;
}) {
  return (
    <aside aria-label={t.search.history}
      className="sticky top-6 hidden max-h-[calc(100dvh-8rem)] w-64 shrink-0 animate-wt-enter flex-col self-start overflow-hidden rounded-xl border bg-card lg:flex">
      <h2 className="flex items-center gap-2 px-4 pt-4 pb-3 text-[15px] font-bold"><History aria-hidden className="size-4 text-primary" /> {t.search.history}</h2>
      <div className="px-3 pb-3">
        <Button variant="outline" className="w-full justify-start" onClick={onNew}><SquarePen /> {t.dash.newSearch}</Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto border-t px-2 pb-3">
        {recent.length === 0 ? (
          <p className="px-2.5 py-6 text-[13px] text-muted-foreground">{t.search.historyEmpty}</p>
        ) : groupRecent(recent, t).map((g) => (
          <div key={g.label}>
            <div className="px-2.5 pt-4 pb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{g.label}</div>
            <ul className="flex flex-col gap-0.5">
              {g.rows.map((r) => (
                <li key={r.id}>
                  <RecentItem r={r} t={t} active={!r.openingId && keyOf(r.query) === activeKey} disabled={disabled} onPick={onPick} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** Búsqueda libre: la repite en un hilo nuevo. Vacante: abre su detalle. */
function RecentItem({ r, t, active, disabled, onPick, className }: {
  r: RecentSearch; t: Dict; active: boolean; disabled: boolean; onPick: (q: string) => void; className?: string;
}) {
  const cls = cn(
    "group flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60",
    active && "bg-secondary hover:bg-secondary",
    className,
  );
  const body = (
    <>
      <span className={cn("line-clamp-2 text-[13px] leading-snug font-bold group-hover:text-primary", active && "text-primary")}>{r.query}</span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        {r.openingId && <Badge variant="muted" className="px-1.5 py-0 text-[10px]">{t.dash.vacancyTag}</Badge>}
        <span className="tabular-nums">{plural(t.search.resultsCount, r.resultCount)}</span>
        {r.shortlisted > 0 && <><span aria-hidden>·</span><span className="tabular-nums">{plural(t.search.shortlistedCount, r.shortlisted)}</span></>}
      </span>
    </>
  );
  return r.openingId
    ? <Link href={`/openings/${r.openingId}`} className={cls}>{body}</Link>
    : <button type="button" onClick={() => onPick(r.query)} disabled={disabled} aria-current={active ? "true" : undefined} className={cls}>{body}</button>;
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
