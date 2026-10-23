"use client";
import { useCallback, useEffect, useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Role = "admin" | "recruiter" | "viewer";
interface U { id: string; email: string; name: string; role: Role; status: string; last_login_at: string | null }

export function UsersView({ t, lang, meId }: { t: Dict; lang: Lang; meId: string }) {
  const [users, setUsers] = useState<U[]>([]);
  const [form, setForm] = useState({ name: "", email: "", role: "recruiter" as Role });
  const [temp, setTemp] = useState("");
  const [err, setErr] = useState("");
  const loc = lang === "es" ? "es-AR" : "en-US";

  const load = useCallback(async () => setUsers((await (await fetch("/api/admin/users")).json()).users), []);
  useEffect(() => { load(); }, [load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setTemp("");
    const r = await fetch("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    setTemp(`${form.email} · ${t.users.temp}: ${j.tempPassword}`);
    setForm({ name: "", email: "", role: "recruiter" });
    load();
  };
  const patch = async (id: string, body: Partial<{ role: Role; status: string }>) => {
    await fetch("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id, ...body }) });
    load();
  };

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.nav.users}</h1>
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-foreground text-left text-xs uppercase tracking-wide text-background">
            <tr><th className="px-4 py-2">{t.users.name}</th><th className="px-4 py-2">{t.users.email}</th><th className="px-4 py-2">{t.users.role}</th><th className="px-4 py-2">{t.users.status}</th><th className="px-4 py-2">{t.users.last}</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t even:bg-muted/40">
                <td className="px-4 py-2 font-medium">{u.name}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  <select disabled={u.id === meId} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value as Role })} className="rounded border bg-transparent px-2 py-1" title={t.users.perms[u.role]}>
                    {(["admin", "recruiter", "viewer"] as const).map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <button disabled={u.id === meId} onClick={() => patch(u.id, { status: u.status === "disabled" ? "active" : "disabled" })} className="text-xs underline disabled:no-underline">{u.status}</button>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{u.last_login_at ? new Date(u.last_login_at).toLocaleString(loc) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Card>
        <CardHeader><CardTitle>{t.users.invite}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
            <Input placeholder={t.users.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-48" />
            <Input placeholder={t.users.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-64" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="h-11 rounded-lg border bg-transparent px-2 text-sm">
              {(["admin", "recruiter", "viewer"] as const).map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}
            </select>
            <Button type="submit">{t.users.invite}</Button>
          </form>
          <ul className="mt-4 text-xs text-muted-foreground">{(["admin", "recruiter", "viewer"] as const).map((r) => <li key={r}><b>{t.roles[r]}:</b> {t.users.perms[r]}</li>)}</ul>
          {temp && <p className="mt-3 rounded bg-secondary p-2 text-sm">{temp}</p>}
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
