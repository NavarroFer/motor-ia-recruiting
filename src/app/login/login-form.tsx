"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Lang } from "@/lib/i18n";
import { Wordmark } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function LoginForm({ t, lang }: { t: Dict; lang: Lang }) {
  const router = useRouter();
  const [email, setEmail] = useState("recruiter@demo.test");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (res.ok) return router.push("/");
    setBusy(false);
    setError(t.login.error);
  };
  const setLang = async (l: Lang) => {
    await fetch("/api/lang", { method: "POST", body: JSON.stringify({ lang: l }) });
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between pt-12 md:justify-end">
        <Wordmark tone="green" className="w-40 md:hidden" />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {(["en", "es"] as const).map((l, i) => (
            <span key={l} className="flex items-center gap-1">
              {i > 0 && "/"}
              <button onClick={() => setLang(l)} aria-pressed={lang === l} className={cn("uppercase hover:text-foreground", lang === l && "font-bold text-foreground")}>{l}</button>
            </span>
          ))}
        </div>
      </div>
      <div className="my-auto w-full max-w-[492px] animate-wt-enter py-12">
        <h1 className="text-[36px] leading-tight font-bold">{t.login.welcome}</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">{t.login.sub}</p>
        <form onSubmit={submit} className="mt-14 flex flex-col">
          <Label htmlFor="email" className="mb-2 text-[13px] font-bold text-muted-foreground">{t.login.email}</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error || undefined} />
          <Label htmlFor="pw" className="mt-8 mb-2 text-[13px] font-bold text-muted-foreground">{t.login.password}</Label>
          <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error || undefined} />
          {error && <p role="alert" className="mt-7 animate-wt-fade rounded-md bg-destructive-bg px-4 py-4 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-8 h-10 justify-start px-4">{busy ? t.login.signingIn : t.login.submit}</Button>
        </form>
        <p className="mt-12 text-[13px] text-muted-foreground">{t.login.noAccount}</p>
        <div className="mt-8 rounded-md border border-dashed bg-card/60 px-4 py-3 text-xs text-muted-foreground">
          <div className="mb-1.5 font-bold">{t.login.demo}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {["admin@demo.test", "recruiter@demo.test", "viewer@demo.test"].map((m) => (
              <button type="button" key={m} onClick={() => { setEmail(m); setPassword("demo1234"); }}
                className={cn("hover:text-foreground hover:underline", email === m && "font-bold text-primary")}>{m}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
