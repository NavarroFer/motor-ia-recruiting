"use client";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LangSwitch({ lang }: { lang: Lang }) {
  const router = useRouter();
  const set = async (l: Lang) => {
    await fetch("/api/lang", { method: "POST", body: JSON.stringify({ lang: l }) });
    router.refresh();
  };
  return (
    <div className="inline-flex rounded-md border text-xs">
      {(["en", "es"] as const).map((l) => (
        <button key={l} onClick={() => set(l)} className={cn("px-2 py-1 uppercase", lang === l ? "bg-foreground text-background" : "text-muted-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}
