"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Plus, X } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/page-header";

type Role = "admin" | "recruiter" | "viewer";
interface U { id: string; email: string; name: string; role: Role; status: string; last_login_at: string | null }
const ROLES = ["admin", "recruiter", "viewer"] as const;
const COLS = "grid grid-cols-[minmax(0,1.9fr)_minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4";

export function UsersView({ t, lang, meId }: { t: Dict; lang: Lang; meId: string }) {
  const [users, setUsers] = useState<U[] | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "recruiter" as Role });
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [perms, setPerms] = useState<Role | null>(null);
  const loc = lang === "es" ? "es-AR" : "en-US";

  const load = useCallback(async () => setUsers((await (await fetch("/api/admin/users")).json()).users), []);
  useEffect(() => { load(); }, [load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setTemp(null); setSending(true);
    const r = await fetch("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
    const j = await r.json();
    setSending(false);
    if (!r.ok) return setErr(j.error);
    setTemp({ email: form.email, password: j.tempPassword });
    setForm({ name: "", email: "", role: "recruiter" });
    load();
  };
  const patch = async (id: string, body: Partial<{ role: Role; status: string }>) => {
    await fetch("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id, ...body }) });
    load();
  };
  const openInvite = () => { setErr(""); setTemp(null); setCopied(false); setOpen(true); };
  const copy = async () => {
    if (!temp) return;
    try { await navigator.clipboard.writeText(temp.password); setCopied(true); } catch { /* sin permiso de portapapeles: queda visible para copiar a mano */ }
  };

  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const when = (v: string | null) => {
    if (!v) return "—";
    const d = new Date(v);
    const diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86_400_000);
    if (diff === 0) return `${t.dash.today}, ${d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" })}`;
    if (diff === 1) return t.dash.yesterday;
    return d.toLocaleDateString(loc, { month: "short", day: "numeric", year: "numeric" });
  };
  const statusLabel = (s: string) => t.users.statusLabel[s as keyof Dict["users"]["statusLabel"]] ?? s;

  return (
    <div className="flex max-w-[1240px] flex-col gap-8">
      <PageHeader
        title={t.users.title}
        sub={t.users.sub}
        actions={<Button onClick={openInvite} className="min-w-46 justify-start px-4"><Plus strokeWidth={2.5} /> {t.users.invite}</Button>}
      />

      {/* Roles */}
      <Card className="animate-wt-enter gap-0 p-0 [animation-delay:80ms]">
        <div className="grid divide-y md:grid-cols-3 md:divide-y-0">
          {ROLES.map((r) => (
            <div key={r} className="px-[22px] pt-6 pb-6">
              <h2 className="text-lg font-bold">{t.roles[r]}</h2>
              <p className="mt-3 text-[13px] text-muted-foreground">{t.users.roleDesc[r]}</p>
              <button
                type="button"
                onClick={() => setPerms(perms === r ? null : r)}
                aria-expanded={perms === r}
                className="mt-5 inline-flex items-center gap-1 rounded-sm text-[13px] font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {t.users.permsLink}
                <ChevronDown className={cn("size-3.5 transition-transform", perms === r && "rotate-180")} />
              </button>
              {perms === r && (
                <ul className="mt-3 flex animate-wt-fade flex-col gap-1.5 text-[13px]">
                  {t.users.permList[r].map((p) => (
                    <li key={p} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2.5} />{p}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Equipo */}
      <Card className="animate-wt-enter gap-0 p-0 [animation-delay:160ms]">
        <div className={cn(COLS, "h-11 bg-surface px-[22px] text-[11px] font-bold tracking-wide text-foreground/80 uppercase")}>
          <span>{t.users.member}</span><span>{t.users.role}</span><span>{t.users.lastActive}</span><span>{t.users.status}</span>
        </div>
        <div className="px-[22px] pb-6">
          {users === null && [0, 1, 2].map((i) => (
            <div key={i} className={cn(COLS, "border-b py-5")}>
              <div className="flex flex-col gap-2"><div className="h-4 w-36 animate-pulse rounded-sm bg-muted" /><div className="h-3 w-52 animate-pulse rounded-sm bg-muted" /></div>
              <div className="h-7 w-36 animate-pulse rounded-sm bg-muted" /><div className="h-4 w-28 animate-pulse rounded-sm bg-muted" /><div className="h-7 w-36 animate-pulse rounded-sm bg-muted" />
            </div>
          ))}
          {users?.map((u, i) => {
            const me = u.id === meId;
            return (
              <div key={u.id} className={cn(COLS, "animate-wt-enter border-b py-[18px]")} style={{ animationDelay: `${200 + i * 55}ms` }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-bold">{u.name}</span>
                    {me && <Badge variant="accent">{t.users.you}</Badge>}
                  </div>
                  <div className="mt-1 truncate text-[13px] text-muted-foreground">{u.email}</div>
                </div>
                <div className="relative w-full max-w-37">
                  <select
                    disabled={me}
                    value={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value as Role })}
                    title={t.users.perms[u.role]}
                    aria-label={`${t.users.role} · ${u.name}`}
                    className="h-7 w-full appearance-none rounded-sm bg-muted py-0 pr-7 pl-2.5 text-xs font-bold text-foreground outline-none hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:hover:bg-muted"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}
                  </select>
                  {!me && <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />}
                </div>
                <div className="text-[13px] text-muted-foreground">{when(u.last_login_at)}</div>
                <div className="flex items-center gap-3">
                  <Badge variant={u.status === "active" ? "default" : "muted"} className="h-7 w-full max-w-37 px-2.5">{statusLabel(u.status)}</Badge>
                  {!me && (
                    <button
                      type="button"
                      onClick={() => patch(u.id, { status: u.status === "disabled" ? "active" : "disabled" })}
                      className="shrink-0 rounded-sm text-xs font-bold text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {u.status === "disabled" ? t.users.reactivate : t.users.deactivate}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Invitar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[580px] gap-0 p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-normal normal-case">{t.users.inviteTitle}</DialogTitle>
            <DialogDescription className="mt-2">{t.users.inviteSub}</DialogDescription>
          </DialogHeader>

          {temp ? (
            <div className="mt-6 flex animate-wt-enter flex-col gap-4">
              <div className="flex items-center gap-2 rounded-sm bg-success-bg px-3 py-2.5 text-[13px] font-bold text-success">
                <Check className="size-4" strokeWidth={2.5} /> {t.users.created.replace("{email}", temp.email)}
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">{t.users.share}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex h-11 flex-1 items-center rounded-md border bg-paper px-3.5 font-mono text-[15px] font-bold tracking-wide select-all">{temp.password}</code>
                  <Button type="button" variant="outline" onClick={copy} className="min-w-28">
                    {copied ? <Check strokeWidth={2.5} /> : <Copy />} {copied ? t.users.copied : t.users.copy}
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button type="button" onClick={() => setOpen(false)} className="min-w-46 justify-start px-4">{t.users.done}</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={invite} className="mt-6 flex flex-col gap-5">
              <label className="flex flex-col gap-2">
                <span className="text-[13px] font-bold">{t.users.name}</span>
                <Input required autoFocus placeholder={t.users.namePh} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-paper" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[13px] font-bold">{t.users.emailLabel}</span>
                <Input required type="email" placeholder="name@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-paper" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[13px] font-bold">{t.users.role}</span>
                <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="rounded-md bg-paper pl-3.5">
                  {ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}
                </NativeSelect>
                <span className="text-xs text-muted-foreground">{t.users.roleDesc[form.role]}</span>
              </label>
              {err && (
                <div role="alert" className="flex animate-wt-fade items-center gap-2 rounded-sm bg-destructive-bg px-3 py-2.5 text-[13px] font-bold text-destructive">
                  <X className="size-4" strokeWidth={2.5} /> {err}
                </div>
              )}
              <div className="mt-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="min-w-28 justify-start px-4">{t.users.cancel}</Button>
                <Button type="submit" disabled={sending} className="min-w-46 justify-start px-4">{t.users.create}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
