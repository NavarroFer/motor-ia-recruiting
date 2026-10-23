"use client";
import { useCallback, useEffect, useState } from "react";
import { Play, Power } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DocStatus } from "@/components/app/doc-status";
import { cn } from "@/lib/utils";

interface Settings { apiEnabled: boolean; autoProcess: boolean; monthlyBudgetUsd: number; keys: { anthropic: boolean; openai: boolean } }
interface Usage {
  budget: { budgetUsd: number; spentUsd: number; pct: number; level: string };
  byKind: { kind: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }[];
  documents: Record<string, number>;
}
interface Doc { id: string; file_name: string; status: string }

export function UsageView({ t, lang }: { t: Dict; lang: Lang }) {
  const [s, setS] = useState<Settings | null>(null);
  const [u, setU] = useState<Usage | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [budget, setBudget] = useState("");
  const [pick, setPick] = useState("");
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState("");
  const loc = lang === "es" ? "es-AR" : "en-US";
  const money = (n: number) => n.toLocaleString(loc, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6 });

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([fetch("/api/admin/settings"), fetch("/api/admin/usage"), fetch("/api/documents")]);
    const sj = (await a.json()) as Settings;
    setS(sj);
    setBudget((b0) => b0 || String(sj.monthlyBudgetUsd));
    setU(await b.json());
    setDocs((await c.json()).documents);
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  const save = async (patch: Partial<{ apiEnabled: boolean; autoProcess: boolean; monthlyBudgetUsd: number }>) => {
    const r = await fetch("/api/admin/settings", { method: "POST", body: JSON.stringify(patch) });
    setS(await r.json());
    load();
  };

  const processOne = async () => {
    setRunning(true);
    setLast("");
    const r = await fetch("/api/admin/process-one", { method: "POST", body: JSON.stringify(pick ? { documentId: pick } : {}) });
    const j = await r.json();
    setRunning(false);
    if (!r.ok) setLast(j.error);
    else if (j.status === "empty") setLast("—");
    else if (j.result?.ok) setLast(`${t.usage.done} · ${(j.durationMs / 1000).toFixed(1)} s`);
    else setLast(j.result?.error ?? j.result?.waiting ?? "error");
    load();
  };

  if (!s || !u) return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  const pending = docs.filter((d) => ["received", "paused", "queued_budget", "error"].includes(d.status));
  const pct = Math.min(1, u.budget.pct);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.nav.usage}</h1>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t.usage.api}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <button onClick={() => save({ apiEnabled: !s.apiEnabled })}
              className={cn("flex items-center gap-3 rounded-lg border p-4 text-left", s.apiEnabled ? "border-success bg-success/10" : "bg-muted")}>
              <Power className={cn("size-6", s.apiEnabled ? "text-success" : "text-muted-foreground")} />
              <div><div className="font-medium">{s.apiEnabled ? t.usage.apiOn : "OFF"}</div>{!s.apiEnabled && <div className="text-xs text-muted-foreground">{t.usage.apiOff}</div>}</div>
            </button>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={s.autoProcess} onChange={(e) => save({ autoProcess: e.target.checked })} className="mt-1" />
              <span><span className="font-medium">{t.usage.auto}</span><br /><span className="text-xs text-muted-foreground">{t.usage.autoHelp}</span></span>
            </label>
            <div className="text-xs text-muted-foreground">
              {t.usage.keys}: Anthropic {s.keys.anthropic ? "✓" : `✗ ${t.usage.missing}`} · OpenAI {s.keys.openai ? "✓" : `✗ ${t.usage.missing}`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.usage.budget}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input type="number" min={0} step="1" value={budget} onChange={(e) => setBudget(e.target.value)} />
              <Button onClick={() => save({ monthlyBudgetUsd: Number(budget) })}>{t.usage.save}</Button>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm"><span>{t.usage.spent}: {money(u.budget.spentUsd)}</span><span className="text-muted-foreground">{t.usage.of} {money(u.budget.budgetUsd)}</span></div>
              <div className="relative h-3 rounded-full bg-muted">
                <div className={cn("h-3 rounded-full", pct >= 1 ? "bg-destructive" : pct >= 0.8 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.max(1, pct * 100)}%` }} />
                <div className="absolute top-0 left-1/2 h-3 w-px bg-foreground/30" title="50%" />
                <div className="absolute top-0 left-[80%] h-3 w-px bg-foreground/30" title="80%" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t.usage.queue}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3 text-sm">{Object.entries(u.documents).map(([k, v]) => <span key={k} className="flex items-center gap-1"><DocStatus status={k} t={t} /> {v}</span>)}</div>
          <div className="flex items-center gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 flex-1 rounded-lg border bg-transparent px-2 text-sm">
              <option value="">{t.usage.pick}</option>
              {pending.map((d) => <option key={d.id} value={d.id}>{d.file_name} — {t.docStatus[d.status as keyof Dict["docStatus"]]}</option>)}
            </select>
            <Button onClick={processOne} disabled={running || !s.apiEnabled} title={!s.apiEnabled ? t.usage.enableFirst : ""}>
              <Play /> {running ? t.usage.processing : t.usage.processOne}
            </Button>
          </div>
          {!s.apiEnabled && <p className="text-xs text-muted-foreground">{t.usage.enableFirst}</p>}
          {last && <p className="text-sm">{last}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t.usage.breakdown}</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1">{t.usage.kind}</th><th>{t.usage.calls}</th><th>{t.usage.tokens}</th><th className="text-right">{t.usage.cost}</th></tr></thead>
            <tbody>
              {u.byKind.map((k) => (
                <tr key={k.kind} className="border-t"><td className="py-2">{k.kind}</td><td>{k.calls}</td><td>{k.inputTokens.toLocaleString(loc)} / {k.outputTokens.toLocaleString(loc)}</td><td className="text-right tabular-nums">{money(k.costUsd)}</td></tr>
              ))}
              {u.byKind.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">—</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
