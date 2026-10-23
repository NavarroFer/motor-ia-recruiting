import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { budgetStatus } from "@/lib/usage";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default async function Dashboard() {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const [indexed, searches, shortlisted] = await Promise.all([
    one<{ n: string }>("SELECT COUNT(*) AS n FROM candidates WHERE tenant_id = $1", [user.tenantId]),
    one<{ n: string }>("SELECT COUNT(*) AS n FROM searches WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())", [user.tenantId]),
    one<{ n: string }>("SELECT COUNT(*) AS n FROM decisions d JOIN searches s ON s.id = d.search_id WHERE s.tenant_id = $1 AND d.status = 'shortlisted'", [user.tenantId]),
  ]);
  const budget = await budgetStatus(user.tenantId);
  const recent = await q<{ id: string; query: string; result_count: number; created_at: string }>(
    "SELECT id, query, result_count, created_at FROM searches WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 8",
    [user.tenantId],
  );
  const money = (n: number) => n.toLocaleString(lang === "es" ? "es-AR" : "en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const stats = [
    { label: t.dash.indexed, value: indexed?.n ?? "0" },
    { label: t.dash.searches, value: searches?.n ?? "0" },
    { label: t.dash.shortlisted, value: shortlisted?.n ?? "0" },
    { label: t.dash.spend, value: `${money(budget.spentUsd)} / ${money(budget.budgetUsd)}` },
  ];
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t.nav.dashboard}</h1>
        <div className="flex gap-2">
          {user.role !== "viewer" && <Link href="/upload" className={buttonVariants({ variant: "outline" })}>{t.dash.upload}</Link>}
          <Link href="/search" className={buttonVariants()}>{t.dash.newSearch}</Link>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}><CardContent><div className="text-xs text-muted-foreground">{s.label}</div><div className="mt-1 font-display text-2xl font-semibold">{s.value}</div></CardContent></Card>
        ))}
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t.dash.recent}</h2>
        {recent.length === 0 ? <p className="text-sm text-muted-foreground">{t.dash.none}</p> : (
          <div className="divide-y rounded-lg border bg-card">
            {recent.map((s) => (
              <Link key={s.id} href={`/search?q=${encodeURIComponent(s.query)}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted">
                <span>{s.query}</span>
                <span className="text-muted-foreground">{s.result_count} {t.dash.results} · {new Date(s.created_at).toLocaleDateString(lang === "es" ? "es-AR" : "en-US")}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
