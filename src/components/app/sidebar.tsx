"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, Contact, Gauge, LayoutDashboard, LogOut, Search, Upload, Users } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import type { SessionUser } from "@/lib/auth";
import { LangSwitch } from "@/components/app/lang-switch";
import { cn } from "@/lib/utils";

export function Sidebar({ user, t, lang }: { user: SessionUser; t: Dict; lang: Lang }) {
  const path = usePathname();
  const router = useRouter();
  const items = [
    { href: "/", label: t.nav.dashboard, icon: LayoutDashboard, show: true },
    { href: "/openings", label: t.nav.openings, icon: Briefcase, show: true },
    { href: "/search", label: t.nav.search, icon: Search, show: true },
    { href: "/candidates", label: t.nav.candidates, icon: Contact, show: true },
    { href: "/upload", label: t.nav.upload, icon: Upload, show: user.role !== "viewer" },
    { href: "/admin/users", label: t.nav.users, icon: Users, show: user.role === "admin" },
    { href: "/admin/usage", label: t.nav.usage, icon: Gauge, show: user.role === "admin" },
  ];
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card px-3 py-5">
      <div className="px-2 pb-6 font-display text-lg font-semibold">Motor IA<span className="text-primary">.</span></div>
      <nav className="flex flex-col gap-1">
        {items.filter((i) => i.show).map((i) => (
          <Link key={i.href} href={i.href}
            className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-sm", (i.href === "/" ? path === "/" : path.startsWith(i.href)) ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <i.icon className="size-4" /> {i.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3 border-t px-2 pt-4 text-sm">
        <div>
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">{t.roles[user.role]}</div>
        </div>
        <div className="flex items-center justify-between">
          <LangSwitch lang={lang} />
          <button onClick={logout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><LogOut className="size-3.5" />{t.nav.logout}</button>
        </div>
      </div>
    </aside>
  );
}
