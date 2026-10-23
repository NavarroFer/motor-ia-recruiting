"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DocStatus } from "@/components/app/doc-status";
import { FilePreviewDialog } from "@/components/app/file-preview";
import { cn } from "@/lib/utils";

interface Doc { id: string; file_name: string; mime_type: string; size_bytes: number; status: string; error: string | null; created_at: string }

export function UploadView({ t, lang }: { t: Dict; lang: Lang }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
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
    const r = await fetch("/api/documents", { method: "POST", body: form });
    const j = await r.json();
    setBusy(false);
    setMsg(r.ok ? t.upload.result.replace("{r}", j.received).replace("{d}", j.duplicates).replace("{u}", j.unsupported) : j.error);
    load();
  };

  const loc = lang === "es" ? "es-AR" : "en-US";
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.nav.upload}</h1>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}
        className={cn("flex flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-card p-10 text-center", over && "border-primary bg-secondary")}
      >
        <UploadCloud className="size-8 text-muted-foreground" />
        <p>{t.upload.drop}</p>
        <input ref={input} type="file" multiple hidden accept=".zip,.pdf,.docx,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => upload(e.target.files)} />
        <Button onClick={() => input.current?.click()} disabled={busy}>{busy ? t.upload.uploading : t.upload.choose}</Button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(stats).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1"><DocStatus status={k} t={t} /> {v}</span>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-foreground text-left text-xs uppercase tracking-wide text-background">
            <tr><th className="px-4 py-2">{t.upload.file}</th><th className="px-4 py-2">{t.upload.size}</th><th className="px-4 py-2">{t.upload.status}</th><th className="px-4 py-2">{t.upload.date}</th></tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-t even:bg-muted/40">
                <td className="px-4 py-2">
                  <button type="button" onClick={() => setPreview(d)} title={t.upload.preview} className="flex items-center gap-2 text-left hover:text-primary hover:underline underline-offset-4">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />{d.file_name}
                  </button>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{(d.size_bytes / 1024).toFixed(0)} KB</td>
                <td className="px-4 py-2"><DocStatus status={d.status} t={t} />{d.error && <div className="mt-1 text-xs text-destructive">{d.error}</div>}</td>
                <td className="px-4 py-2 text-muted-foreground">{new Date(d.created_at).toLocaleString(loc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FilePreviewDialog doc={preview} t={t} onClose={() => setPreview(null)} />
    </div>
  );
}
