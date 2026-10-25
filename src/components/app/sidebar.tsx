"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import type { SessionUser } from "@/lib/auth";
import { Wordmark } from "@/components/brand/brand";
import { BrandIcon, type BrandIconName } from "@/components/brand/icons";
import { cn } from "@/lib/utils";

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function Sidebar({ user, tenant, t, lang }: { user: SessionUser; tenant: string; t: Dict; lang: Lang }) {
  const path = usePathname();
  const router = useRouter();
  const main = [
    { href: "/", label: t.nav.dashboard, icon: "computer" as BrandIconName, show: true },
    { href: "/openings", label: t.nav.openings, icon: "windows" as BrandIconName, show: true },
    { href: "/search", label: t.nav.search, icon: "cursor" as BrandIconName, show: true },
    { href: "/candidates", label: t.nav.candidates, icon: "document" as BrandIconName, show: true },
    { href: "/upload", label: t.nav.upload, icon: "disk" as BrandIconName, show: user.role !== "viewer" },
  ];
  const admin = [
    { href: "/admin/users", label: t.nav.users, icon: "keys" as BrandIconName },
    { href: "/admin/usage", label: t.nav.usage, icon: "hourglass" as BrandIconName },
  ];
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };
  const setLang = async (l: Lang) => {
    await fetch("/api/lang", { method: "POST", body: JSON.stringify({ lang: l }) });
    router.refresh();
  };
  const item = (i: { href: string; label: string; icon: BrandIconName }) => {
    const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
    return (
      <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
        className={cn("group flex h-11 items-center gap-3 rounded-md px-3 text-[15px] transition-colors",
          active ? "bg-cream font-bold text-forest" : "text-cream/90 hover:bg-white/8 hover:text-cream")}>
        <BrandIcon name={i.icon} className={cn("size-5 transition-transform group-hover:-translate-y-px", !active && "opacity-85")} /> {i.label}
      </Link>
    );
  };
  return (
    <aside className="sticky top-0 flex h-screen w-58 shrink-0 flex-col bg-forest px-3.5 pt-7 pb-5 text-cream">
      <Link href="/" className="px-2.5"><Wordmark tone="cream" className="w-[182px]" /></Link>
      <div className="mt-5 px-2.5 text-[10px] font-bold tracking-wider uppercase">{t.nav.workspace}</div>
      <div className="mx-2.5 mt-5 border-t border-cream/25" />
      <div className="mt-5 px-2.5">
        <div className="text-[15px] font-bold">{tenant}</div>
      </div>
      <nav className="mt-7 flex flex-col gap-1.5">
        {main.filter((i) => i.show).map(item)}
        {user.role === "admin" && (
          <>
            <div className="mt-4 mb-1 px-2.5 text-[10px] font-bold tracking-wider uppercase">{t.nav.admin}</div>
            {admin.map(item)}
          </>
        )}
      </nav>
      <div className="mt-auto flex flex-col gap-4 px-2.5">
        <div className="border-t border-cream/25" />
        <div className="flex items-center gap-2 text-xs text-cream/80">
          {t.nav.language}
          <span className="flex items-center gap-1">
            {(["en", "es"] as const).map((l, i) => (
              <span key={l} className="flex items-center gap-1">
                {i > 0 && "/"}
                <button onClick={() => setLang(l)} aria-pressed={lang === l} className={cn("uppercase hover:text-cream", lang === l && "font-bold text-cream underline underline-offset-2")}>{l}</button>
              </span>
            ))}
          </span>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <div className="grid size-9 shrink-0 place-items-center rounded-sm bg-cream text-xs font-bold text-forest">{initials(user.name)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{user.name}</div>
            <div className="text-xs text-cream/75">{t.roles[user.role]}</div>
          </div>
          <button onClick={logout} title={t.nav.logout} aria-label={t.nav.logout} className="rounded-sm p-1.5 text-cream/75 hover:bg-white/10 hover:text-cream"><LogOut className="size-4" /></button>
        </div>
      </div>
    </aside>
  );
}
