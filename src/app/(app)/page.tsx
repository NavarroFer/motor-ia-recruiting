import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { budgetStatus } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Illo } from "@/components/brand/brand";

interface RecentRow { id: string; query: string; result_count: number; created_at: string | Date; opening_id: string | null; shortlisted: string | number }

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
// Conserva la precisión de los gastos menores a un centavo.
const compactMoney = (n: number) => `$${n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

export default async function Dashboard() {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const tid = user.tenantId;
  const loc = lang === "es" ? "es-AR" : "en-US";

  const [tenant, indexed, indexedWeek, searches, openings, decided, budget, recent] = await Promise.all([
    one<{ name: string }>("SELECT name FROM tenants WHERE id = $1", [tid]),
    one<{ n: string }>("SELECT COUNT(*) AS n FROM candidates WHERE tenant_id = $1", [tid]),
    one<{ n: string }>("SELECT COUNT(*) AS n FROM candidates WHERE tenant_id = $1 AND created_at >= now() - interval '7 days'", [tid]),
    one<{ n: string }>("SELECT COUNT(*) AS n FROM searches WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())", [tid]),
    one<{ open: string; closed: string }>(
      "SELECT COUNT(*) FILTER (WHERE status = 'open') AS open, COUNT(*) FILTER (WHERE status = 'closed') AS closed FROM openings WHERE tenant_id = $1",
      [tid],
    ),
    one<{ shortlisted: string; selected: string }>(
      `SELECT COUNT(*) FILTER (WHERE d.status = 'shortlisted') AS shortlisted, COUNT(*) FILTER (WHERE d.status = 'selected') AS selected
         FROM decisions d JOIN searches s ON s.id = d.search_id WHERE s.tenant_id = $1`,
      [tid],
    ),
    budgetStatus(tid),
    // Una fila por búsqueda (misma consulta o misma vacante = la misma búsqueda), con la última corrida
    // y los preseleccionados acumulados entre todas sus corridas.
    q<RecentRow>(
      `WITH s AS (
         SELECT id, query, result_count, created_at, opening_id, COALESCE(opening_id::text, lower(btrim(query))) AS k
           FROM searches WHERE tenant_id = $1
       ), latest AS (
         SELECT DISTINCT ON (k) * FROM s ORDER BY k, created_at DESC
       )
       SELECT l.id, l.query, l.result_count, l.created_at, l.opening_id,
              (SELECT COUNT(DISTINCT d.candidate_id) FROM decisions d JOIN s s2 ON s2.id = d.search_id
                WHERE s2.k = l.k AND d.status = 'shortlisted') AS shortlisted
         FROM latest l ORDER BY l.created_at DESC LIMIT 5`,
      [tid],
    ),
  ]);

  const num = (v: unknown) => Number(v ?? 0);
  const money = (n: number) => n.toLocaleString(loc, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date();
  const rawDate = today.toLocaleDateString(loc, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const dateLine = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const when = (v: string | Date) => {
    const d = new Date(v);
    const diff = Math.round((dayStart(today) - dayStart(d)) / 86_400_000);
    if (diff === 0) return `${t.dash.today}, ${d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" })}`;
    if (diff === 1) return t.dash.yesterday;
    return d.toLocaleDateString(loc, { month: "short", day: "numeric", year: "numeric" });
  };

  const stats = [
    { href: "/candidates", label: t.dash.indexed, value: String(num(indexed?.n)), sub: fill(t.dash.indexedWeek, { n: num(indexedWeek?.n) }) },
    { href: "/openings", label: t.dash.vacancies, value: String(num(openings?.open)), sub: fill(t.dash.vacanciesSub, { n: num(openings?.closed) }) },
    { href: "/openings", label: t.dash.shortlisted, value: String(num(decided?.shortlisted)), sub: fill(t.dash.selectedSub, { n: num(decided?.selected) }) },
    { href: user.role === "admin" ? "/admin/usage" : undefined, label: t.dash.spend, value: compactMoney(budget.spentUsd), aria: money(budget.spentUsd), sub: fill(t.dash.spendSub, { v: money(budget.budgetUsd) }) },
  ];

  const pct = Math.min(1, Math.max(0, budget.pct));
  const out = budget.level === "exhausted";
  const low = budget.level === "warn80";
  const canDecide = can.decide(user.role);
  const cardLinkCls = "after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary focus-visible:after:ring-inset";
  const linkCls = "inline-flex items-center gap-1 text-[13px] font-bold text-primary underline-offset-4 hover:underline";

  return (
    <div className="flex max-w-[1240px] flex-col gap-9">
      <PageHeader
        title={t.dash.title}
        sub={`${dateLine}${tenant?.name ? ` · ${tenant.name}` : ""}`}
        actions={
          <>
            {user.role !== "viewer" && <Link href="/upload" className={cn(buttonVariants({ variant: "outline" }), "min-w-36 justify-start px-4")}>{t.dash.upload}</Link>}
            <Link href="/search" className={cn(buttonVariants(), "min-w-44 justify-start px-4")}><Plus strokeWidth={2.5} /> {t.dash.newSearch}</Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="-mt-1 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Card key={s.label} className={cn("relative animate-wt-enter gap-0 px-[18px] pt-6 pb-5", s.href && "transition-colors hover:border-primary/50 hover:bg-paper")} style={{ animationDelay: `${80 + i * 70}ms` }}>
            <div className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-wide text-foreground/80 uppercase">
              {s.href ? <Link href={s.href} className={cardLinkCls}>{s.label}</Link> : s.label}
              {s.href && <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-primary" />}
            </div>
            <div className="mt-6 flex min-h-[55px] items-end text-forest">
              <span className="font-sans text-[54.4px] leading-none font-semibold tracking-tight tabular-nums" aria-label={s.aria}>{s.value}</span>
            </div>
            <div className="mt-4 text-[13px] text-muted-foreground">{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Búsquedas recientes */}
      <Card className="animate-wt-enter gap-0 px-[22px] pt-6 pb-4 [animation-delay:380ms]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold"><Link href="/search" className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{t.dash.pickUp}</Link></h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.dash.searches}: {num(searches?.n)}</p>
          </div>
          <Link href="/search" className={cn(linkCls, "mt-1 mr-2")}>{t.dash.openSearch} <ArrowUpRight className="size-3.5" /></Link>
        </div>

        {recent.length === 0 ? (
          <div className="flex min-h-[290px] items-center justify-between gap-8 px-[8%] py-10">
            <div className="max-w-md animate-wt-enter [animation-delay:480ms]">
              <h3 className="text-[26px] leading-tight font-bold">{t.dash.emptyTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.dash.emptySub}</p>
              <Link href="/search" className={cn(buttonVariants(), "mt-6 min-w-44 justify-start px-4")}><Plus strokeWidth={2.5} /> {t.dash.newSearch}</Link>
            </div>
            <Illo name="cursor" className="hidden w-24 animate-wt-globe [animation-delay:560ms] md:block" />
          </div>
        ) : (
          <div className="mt-6 text-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_170px_120px_110px] gap-4 border-b pb-3 text-[11px] font-bold tracking-wide text-foreground/80 uppercase">
              <span>{t.dash.colSearch}</span><span>{t.dash.colLastRun}</span><span>{t.dash.colResults}</span><span>{t.dash.shortlisted}</span>
            </div>
            {recent.map((s, i) => (
              <Link
                key={s.id}
                href={s.opening_id ? `/openings/${s.opening_id}` : `/search?q=${encodeURIComponent(s.query)}`}
                className="group grid animate-wt-enter grid-cols-[minmax(0,1fr)_170px_120px_110px] items-start gap-4 border-b py-5 transition-colors last:border-b-0 hover:bg-paper focus-visible:outline-2 focus-visible:outline-primary"
                style={{ animationDelay: `${460 + i * 60}ms` }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[15px] font-bold group-hover:text-primary">{s.query}</span>
                  {s.opening_id && <Badge variant="muted" className="shrink-0">{t.dash.vacancyTag}</Badge>}
                </span>
                <span className="text-[13px] text-muted-foreground">{when(s.created_at)}</span>
                <span className="font-bold tabular-nums">{num(s.result_count)}</span>
                <span className="font-bold tabular-nums">{num(s.shortlisted)}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Marca + presupuesto */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)]">
        <div className="relative flex min-h-[200px] animate-wt-enter items-center justify-between gap-6 overflow-hidden rounded-xl bg-primary px-[26px] py-7 text-cream transition-colors hover:bg-forest [animation-delay:520ms]">
          <div className="min-w-0">
            <h2 className="text-[26px] leading-tight font-bold text-cream">{t.dash.heroTitle}</h2>
            <p className="mt-2 text-sm text-cream/90">{t.dash.heroSub}</p>
            <Link href="/openings" className={cn(buttonVariants({ variant: "outline" }), cardLinkCls, "focus-visible:after:ring-cream", "mt-7 min-w-48 justify-start border-cream bg-cream px-4 text-primary hover:bg-white hover:text-forest")}>
              {canDecide ? t.dash.heroCta : t.dash.heroCtaViewer}
            </Link>
          </div>
          <Illo name="globe" tone="cream" className="mr-6 hidden w-36 shrink-0 animate-wt-globe [animation-delay:700ms] sm:block" />
        </div>

        <Card className={cn("relative animate-wt-enter gap-0 px-[22px] pt-6 pb-6 [animation-delay:600ms]", user.role === "admin" && "transition-colors hover:border-primary/50 hover:bg-paper")}>
          <h2 className="text-[17px] font-bold">{out ? t.dash.budgetOut : low ? t.dash.budgetLow : t.dash.budgetOk}</h2>
          <p className="mt-3 text-[13px] text-muted-foreground">
            {out ? t.dash.budgetOutSub : fill(t.dash.available, { v: money(budget.remainingUsd) })}
          </p>
          <div
            className="mt-6 h-2.5 overflow-hidden rounded-sm bg-muted"
            role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label={t.dash.spend}
          >
            <div
              className={cn("h-full animate-in rounded-sm duration-1000 ease-out fill-mode-both slide-in-from-left [animation-delay:750ms]", out ? "bg-destructive" : low ? "bg-warning" : "bg-primary")}
              style={{ width: `${Math.max(1, pct * 100)}%` }}
            />
          </div>
          {user.role === "admin" && (
            <Link href="/admin/usage" className={cn(linkCls, cardLinkCls, "mt-auto self-start pt-6")}>{t.dash.manageUsage} <ArrowUpRight className="size-3.5" /></Link>
          )}
        </Card>
      </div>
    </div>
  );
}
