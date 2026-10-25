"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DocStatus } from "@/components/app/doc-status";
import { FilePreviewDialog } from "@/components/app/file-preview";
import { PageHeader } from "@/components/app/page-header";
import { Illo } from "@/components/brand/brand";
import { cn } from "@/lib/utils";

interface Doc { id: string; file_name: string; mime_type: string; size_bytes: number; status: string; error: string | null; created_at: string }

const PROCESSING = ["received", "extracting", "structuring"];
const QUEUED = ["queued_budget", "paused"];
const PIPELINE = ["received", "extracting", "structuring", "indexed"] as const;
// Misma grilla para encabezado y filas. En mobile: archivo + estado.
const COLS = "grid grid-cols-[minmax(0,1fr)_minmax(0,10rem)] items-center gap-x-6 md:grid-cols-[minmax(0,1fr)_5.5rem_8.5rem_minmax(0,14rem)]";
// Divisor con sangría (como el mockup) y hover a todo el ancho.
const ROW_LINE = "relative after:absolute after:right-5 after:bottom-0 after:left-5 after:h-px after:bg-border";

export function UploadView({ t, lang }: { t: Dict; lang: Lang }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<Doc | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/documents");
    if (!r.ok) return;
    const j = await r.json();
    setDocs(j.documents);
    setStats(j.stats);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 2000); // estado en vivo del procesamiento
    return () => clearInterval(id);
  }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    try {
      const r = await fetch("/api/documents", { method: "POST", body: form });
      const j = await r.json();
      setMsg(r.ok
        ? { ok: true, text: t.upload.result.replace("{r}", j.received).replace("{d}", j.duplicates).replace("{u}", j.unsupported) }
        : { ok: false, text: j.error ?? t.upload.failed });
    } catch {
      setMsg({ ok: false, text: t.upload.failed });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = ""; // permite volver a elegir el mismo archivo
    }
    load();
  };

  const loc = lang === "es" ? "es-AR" : "en-US";
  const num = (n: number) => n.toLocaleString(loc);
  const sum = (keys: string[]) => keys.reduce((a, k) => a + (stats[k] ?? 0), 0);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const summary = [
    t.upload.sumIndexed.replace("{n}", num(stats.indexed ?? 0)),
    t.upload.sumProcessing.replace("{n}", num(sum(PROCESSING))),
    t.upload.sumQueued.replace("{n}", num(sum(QUEUED))),
    (stats.duplicate ?? 0) > 0 && t.upload.sumDuplicates.replace("{n}", num(stats.duplicate)),
    t.upload.sumErrors.replace("{n}", num(stats.error ?? 0)),
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t.upload.title} sub={t.upload.sub} />

      {/* Zona de carga: arrastrar y soltar o elegir archivos */}
      <div
        aria-busy={busy}
        onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}
        className={cn(
          "group relative grid animate-wt-enter items-center gap-6 overflow-hidden rounded-xl border bg-surface px-8 py-7 text-center [animation-delay:80ms]",
          "transition-[border-color,background-color,box-shadow] duration-300 hover:border-primary/40",
          "md:grid-cols-[9rem_minmax(0,1fr)_auto] md:gap-10 md:text-left",
          over && "border-primary bg-success-bg/60 shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_12%,transparent)] hover:border-primary",
        )}
      >
        <div aria-hidden className={cn("pointer-events-none absolute inset-2 rounded-lg border-2 border-dashed border-primary/45 opacity-0 transition-opacity duration-300", over && "opacity-100")} />
        <Illo
          name="document"
          className={cn(
            "w-28 justify-self-center transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:-translate-y-1 md:justify-self-start",
            over && "-translate-y-2 -rotate-3 scale-105 group-hover:-translate-y-2",
          )}
        />
        <div className="min-w-0">
          <p className="text-xl font-bold text-foreground">{over ? t.upload.dropActive : t.upload.dropTitle}</p>
          <p className="mt-2.5 text-sm text-muted-foreground">{t.upload.dropHint}</p>
        </div>
        <div className="flex justify-center md:justify-end">
          <input ref={input} type="file" multiple hidden accept=".zip,.pdf,.docx,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => upload(e.target.files)} />
          <Button size="lg" className="min-w-44" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <><PixelLoader />{t.upload.uploading}</> : t.upload.browse}
          </Button>
        </div>
      </div>

      {/* Avisos: resultado de la carga y estados de la cola que frenan el procesamiento */}
      {(msg || (stats.queued_budget ?? 0) > 0 || (stats.paused ?? 0) > 0) && (
        <div className="flex max-w-3xl flex-col gap-2">
          {msg && (
            <Banner key={msg.text} tone={msg.ok ? "success" : "danger"} mark={msg.ok ? "✓" : "×"} role={msg.ok ? "status" : "alert"}>{msg.text}</Banner>
          )}
          {(stats.queued_budget ?? 0) > 0 && <Banner tone="warning" mark="!">{t.upload.budgetBanner.replace("{n}", num(stats.queued_budget))}</Banner>}
          {(stats.paused ?? 0) > 0 && <Banner tone="warning" mark="!">{t.upload.pausedBanner.replace("{n}", num(stats.paused))}</Banner>}
        </div>
      )}

      {docs === null ? (
        <TableSkeleton />
      ) : docs.length === 0 ? (
        <div className="flex animate-wt-enter flex-col items-center px-4 py-20 text-center [animation-delay:160ms]">
          <h2 className="text-2xl font-bold text-foreground">{t.upload.emptyTitle}</h2>
          <p className="mt-3 text-[15px] text-muted-foreground">{t.upload.emptySub}</p>
        </div>
      ) : (
        <section className="flex animate-wt-enter flex-col gap-4 [animation-delay:140ms]">
          <div className="flex flex-wrap items-baseline gap-x-12 gap-y-1 px-0.5 pt-2">
            <h2 className="text-xl font-bold text-foreground tabular-nums">{num(total)} {total === 1 ? t.upload.fileOne : t.upload.files}</h2>
            <p className="text-[13px] text-muted-foreground tabular-nums">{summary}</p>
          </div>

          <div role="table" aria-label={t.nav.upload} className="overflow-hidden rounded-xl border bg-card">
            <div role="rowgroup" className="border-b border-primary bg-primary">
              <div role="row" className={cn(COLS, "px-5 py-4 text-[11px] font-bold tracking-wide text-white uppercase")}>
                <span role="columnheader">{t.upload.fileName}</span>
                <span role="columnheader" className="hidden md:block">{t.upload.size}</span>
                <span role="columnheader" className="hidden md:block">{t.upload.date}</span>
                <span role="columnheader">{t.upload.procStatus}</span>
              </div>
            </div>
            <div role="rowgroup" className="pb-4">
              {docs.map((d, i) => {
                const size = `${(d.size_bytes / 1024).toFixed(0)} KB`;
                const when = new Date(d.created_at);
                const date = when.toLocaleDateString(loc, { dateStyle: "medium" });
                return (
                  <div
                    role="row"
                    key={d.id}
                    style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
                    className={cn(COLS, ROW_LINE, "animate-wt-enter px-5 py-4 transition-colors hover:bg-paper")}
                  >
                    <div role="cell" className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setPreview(d)}
                        title={t.upload.preview}
                        className="group/file inline-flex max-w-full items-center gap-2 rounded-sm text-left text-sm font-bold text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="truncate">{d.file_name}</span>
                        <Eye aria-hidden className="size-3.5 shrink-0 text-primary opacity-0 transition-opacity group-hover/file:opacity-100 group-focus-visible/file:opacity-100" />
                      </button>
                      <div className="mt-0.5 text-xs text-muted-foreground md:hidden">{size} · {date}</div>
                    </div>
                    <div role="cell" className="hidden text-[13px] text-muted-foreground tabular-nums md:block">{size}</div>
                    <div role="cell" className="hidden text-[13px] text-muted-foreground md:block" title={when.toLocaleString(loc)}>{date}</div>
                    <div role="cell" className="min-w-0">
                      <DocStatus status={d.status} detail={d.error} t={t} className="w-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="px-0.5 pt-1 text-[13px] text-muted-foreground" aria-label={t.upload.pipeline}>
            {PIPELINE.map((s) => t.docStatus[s]).join(" → ")}
          </p>
        </section>
      )}

      <FilePreviewDialog doc={preview} t={t} onClose={() => setPreview(null)} />
    </div>
  );
}

/** Aviso de una línea (11_Components: "× Upload failed…", "! Budget reached…"). */
function Banner({ tone, mark, role, children }: { tone: "success" | "warning" | "danger"; mark: string; role?: "status" | "alert"; children: React.ReactNode }) {
  const style = { success: "bg-success-bg text-success", warning: "bg-warning-bg text-warning", danger: "bg-destructive-bg text-destructive" }[tone];
  return (
    <p role={role} className={cn("flex animate-wt-fade items-baseline gap-2 rounded-sm px-3 py-2 text-[13px] font-bold", style)}>
      <span aria-hidden>{mark}</span>
      <span>{children}</span>
    </p>
  );
}

/** Tres píxeles que titilan en secuencia: carga en curso, con el lenguaje bitmap de la marca. */
function PixelLoader() {
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-wt-blink bg-current" style={{ animationDelay: `${i * 0.18}s` }} />)}
    </span>
  );
}

function TableSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-xl border bg-card">
      <div className="h-12 border-b border-primary bg-primary" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-6 px-5 py-5">
          <div className="h-3.5 w-56 animate-pulse rounded-sm bg-muted" />
          <div className="ml-auto h-6 w-44 animate-pulse rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  );
}
