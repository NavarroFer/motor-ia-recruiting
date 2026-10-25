"use client";
import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { Requirements } from "@/lib/ai/prompts";
import { cn } from "@/lib/utils";

type Group = "mandatory" | "nice_to_have";

/**
 * Chips de requisitos: clic en el texto lo mueve entre Obligatorio/Deseable, × lo quita,
 * "+ Agregar requisito" abre un campo ("aws 3" = aws con 3+ años, entra como obligatorio).
 * `bare` lo embebe sin tarjeta (panel de búsqueda); `addSignal` abre el campo desde afuera.
 */
export function RequirementsEditor({ reqs, onChange, t, readOnly, footer, bare, addSignal }: {
  reqs: Requirements; onChange: (r: Requirements) => void; t: Dict; readOnly?: boolean; footer?: React.ReactNode;
  bare?: boolean; addSignal?: number;
}) {
  const [newReq, setNewReq] = useState("");
  const [adding, setAdding] = useState(false);
  const [seenSignal, setSeenSignal] = useState(addSignal);
  const inputRef = useRef<HTMLInputElement>(null);

  // "Editar requisitos" desde el estado sin resultados: abre el campo (ajuste de estado durante el render)
  if (addSignal !== seenSignal) {
    setSeenSignal(addSignal);
    if (addSignal && !readOnly) setAdding(true);
  }
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding, addSignal]);

  const remove = (g: Group, i: number) => onChange({ ...reqs, [g]: reqs[g].filter((_, j) => j !== i) } as Requirements);
  const move = (g: Group, i: number) => {
    const item = reqs[g][i];
    if (g === "mandatory") onChange({ ...reqs, mandatory: reqs.mandatory.filter((_, j) => j !== i), nice_to_have: [...reqs.nice_to_have, { skill: item.skill, label: item.label }] });
    else onChange({ ...reqs, nice_to_have: reqs.nice_to_have.filter((_, j) => j !== i), mandatory: [...reqs.mandatory, { type: "skill", skill: item.skill ?? item.label.toLowerCase(), label: item.label }] });
  };
  const add = () => {
    const m = newReq.trim().toLowerCase().match(/^(.+?)\s*(\d+)?$/);
    if (!m) return;
    const skill = m[1], years = m[2] ? Number(m[2]) : undefined;
    onChange({ ...reqs, mandatory: [...reqs.mandatory, { type: "skill", skill, min_years: years, label: years ? `${skill} ≥ ${years}` : skill }] });
    setNewReq("");
  };

  return (
    <div className={cn("flex flex-col gap-4", !bare && "rounded-lg border bg-card p-5")}>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        {(["mandatory", "nice_to_have"] as const).map((g) => (
          <div key={g} className="flex min-w-0 flex-col gap-2">
            <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{g === "mandatory" ? t.search.mandatory : t.search.nice}</span>
            <div className="flex flex-wrap gap-2">
              {reqs[g].length === 0 && <span className="py-1.5 text-xs text-muted-foreground">{t.search.noReqs}</span>}
              {reqs[g].map((r, i) => (
                <span
                  key={`${r.label}-${i}`}
                  className={cn(
                    "inline-flex animate-wt-fade items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs font-bold text-foreground",
                    g === "mandatory" && "ring-1 ring-primary/15 ring-inset",
                  )}
                >
                  {readOnly ? r.label : (
                    <button type="button" onClick={() => move(g, i)} title={t.search.moveHint} className="rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50">
                      {r.label}
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => remove(g, i)}
                      aria-label={`${t.search.remove} ${r.label}`}
                      className="-mr-0.5 rounded-sm text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span aria-hidden className="text-sm leading-none">×</span>
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}

        {!readOnly && (
          adding ? (
            <form
              onSubmit={(e) => { e.preventDefault(); add(); }}
              className="flex animate-wt-fade items-center gap-1.5"
            >
              <input
                ref={inputRef}
                value={newReq}
                onChange={(e) => setNewReq(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setAdding(false); setNewReq(""); } }}
                onBlur={() => { if (!newReq.trim()) setAdding(false); }}
                placeholder={t.search.addPh}
                aria-label={t.search.addReq}
                className="h-8 w-40 rounded-md border border-input bg-background px-2.5 text-xs font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <button type="submit" aria-label={t.search.addReq} className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-forest">
                <span aria-hidden className="text-base leading-none font-bold">+</span>
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-8 items-center gap-1 rounded-md px-1 text-[13px] font-bold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span aria-hidden>+</span> {t.search.addReq}
            </button>
          )
        )}
      </div>
      {footer}
    </div>
  );
}
