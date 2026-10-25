"use client";
import { Download, ExternalLink, FileText } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Illo } from "@/components/brand/brand";

export interface PreviewDoc { id: string; file_name: string; mime_type: string }

/** Modal con el archivo original (PDF, imagen o texto). DOCX no se renderiza en el navegador: solo descarga. */
export function FilePreviewDialog({ doc, t, onClose }: { doc: PreviewDoc | null; t: Dict; onClose: () => void }) {
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[85dvh] max-w-5xl flex-col gap-4 p-5 sm:overflow-hidden">
        {doc && <FilePreview doc={doc} t={t} />}
      </DialogContent>
    </Dialog>
  );
}

function FilePreview({ doc, t }: { doc: PreviewDoc; t: Dict }) {
  const src = `/api/documents/${doc.id}/file`;
  const link = buttonVariants({ variant: "outline", size: "sm" });
  const frame = "min-h-0 w-full flex-1 rounded-lg border animate-wt-fade";
  return (
    <>
      <DialogHeader className="flex-row flex-wrap items-center gap-2 border-b pr-8 pb-4">
        <FileText aria-hidden className="size-4 shrink-0 text-primary" />
        <DialogTitle className="mr-auto min-w-0 truncate text-base font-bold tracking-normal normal-case">{doc.file_name}</DialogTitle>
        <a href={src} target="_blank" rel="noopener" className={link}><ExternalLink />{t.upload.openTab}</a>
        <a href={src} download={doc.file_name} className={link}><Download />{t.upload.download}</a>
      </DialogHeader>
      {doc.mime_type.startsWith("image/") ? (
        <img src={src} alt={doc.file_name} className={`${frame} bg-card object-contain`} />
      ) : doc.mime_type === "application/pdf" || doc.mime_type === "text/plain" ? (
        <iframe src={src} title={doc.file_name} className={`${frame} bg-white`} />
      ) : (
        <div className="m-auto flex max-w-sm animate-wt-enter flex-col items-center gap-5 text-center">
          <Illo name="document" className="w-24" />
          <p className="text-sm text-muted-foreground">{t.upload.noPreview}</p>
          <a href={src} download={doc.file_name} className={buttonVariants()}><Download />{t.upload.download}</a>
        </div>
      )}
    </>
  );
}
