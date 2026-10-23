"use client";
import { Download, ExternalLink } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface PreviewDoc { id: string; file_name: string; mime_type: string }

/** Modal con el archivo original (PDF, imagen o texto). DOCX no se renderiza en el navegador: solo descarga. */
export function FilePreviewDialog({ doc, t, onClose }: { doc: PreviewDoc | null; t: Dict; onClose: () => void }) {
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[85dvh] max-w-5xl flex-col p-4 sm:overflow-hidden">
        {doc && <FilePreview doc={doc} t={t} />}
      </DialogContent>
    </Dialog>
  );
}

function FilePreview({ doc, t }: { doc: PreviewDoc; t: Dict }) {
  const src = `/api/documents/${doc.id}/file`;
  const link = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <>
      <DialogHeader className="flex-row items-center gap-2 pr-8">
        <DialogTitle className="mr-auto truncate">{doc.file_name}</DialogTitle>
        <a href={src} target="_blank" rel="noopener" className={link}><ExternalLink />{t.upload.openTab}</a>
        <a href={src} download={doc.file_name} className={link}><Download />{t.upload.download}</a>
      </DialogHeader>
      {doc.mime_type.startsWith("image/") ? (
        <img src={src} alt={doc.file_name} className="min-h-0 flex-1 rounded-md border object-contain" />
      ) : doc.mime_type === "application/pdf" || doc.mime_type === "text/plain" ? (
        <iframe src={src} title={doc.file_name} className="min-h-0 w-full flex-1 rounded-md border bg-white" />
      ) : (
        <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">{t.upload.noPreview}</p>
      )}
    </>
  );
}
