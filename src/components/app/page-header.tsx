"use client";
import { usePathname } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Barra superior: miga de pan + estado del sistema (API activa o en pausa). */
export function TopBar({ t, apiOn }: { t: Dict; apiOn: boolean }) {
  const path = usePathname();
  const crumbs: [string, string][] = [
    ["/admin/users", t.nav.users], ["/admin/usage", t.nav.usage], ["/openings", t.nav.openings],
    ["/search", t.nav.search], ["/candidates", t.nav.candidates], ["/upload", t.nav.upload],
  ];
  const here = crumbs.find(([p]) => path.startsWith(p))?.[1] ?? t.nav.dashboard;
  return (
    <header className="flex h-16 items-center justify-between border-b px-10">
      <div className="text-[13px] text-muted-foreground">{t.shell.root} / {here}</div>
      <div className={cn("flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-bold", apiOn ? "bg-success-bg text-primary" : "bg-warning-bg text-warning")}>
        <span className={cn("size-2 rounded-full", apiOn ? "bg-primary" : "bg-warning")} />
        {apiOn ? t.shell.online : t.shell.paused}
      </div>
    </header>
  );
}

/** Encabezado de pantalla: título grande, bajada y acciones a la derecha. */
export function PageHeader({ title, sub, actions, className }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-6", className)}>
      <div className="min-w-0 animate-wt-enter">
        <h1 className="text-[31px] leading-tight font-bold text-foreground">{title}</h1>
        {sub && <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
