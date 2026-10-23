"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangSwitch } from "@/components/app/lang-switch";

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
    setBusy(false);
    if (res.ok) router.push("/");
    else setError(t.login.error);
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="font-display text-xl">Motor IA<span className="text-primary">.</span> · {t.login.title}</CardTitle>
        <LangSwitch lang={lang} />
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Label htmlFor="email">{t.login.email}</Label><Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="pw">{t.login.password}</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>{t.login.submit}</Button>
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium">{t.login.demo}</div>
            {["admin@demo.test", "recruiter@demo.test", "viewer@demo.test"].map((m) => (
              <button type="button" key={m} onClick={() => setEmail(m)} className="block hover:text-foreground">{m}</button>
            ))}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
