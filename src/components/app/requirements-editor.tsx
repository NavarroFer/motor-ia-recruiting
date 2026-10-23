"use client";
import { useState } from "react";
import { X } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import type { Requirements } from "@/lib/ai/prompts";
import { cn } from "@/lib/utils";

/** Chips de requisitos: clic en el texto lo mueve entre Obligatorio/Deseable, × lo quita, campo para agregar ("aws 3"). */
export function RequirementsEditor({ reqs, onChange, t, readOnly, footer }: {
  reqs: Requirements; onChange: (r: Requirements) => void; t: Dict; readOnly?: boolean; footer?: React.ReactNode;
}) {
  const [newReq, setNewReq] = useState("");
  const remove = (g: "mandatory" | "nice_to_have", i: number) => onChange({ ...reqs, [g]: reqs[g].filter((_, j) => j !== i) } as Requirements);
  const move = (g: "mandatory" | "nice_to_have", i: number) => {
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
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      {(["mandatory", "nice_to_have"] as const).map((g) => (
        <div key={g} className="flex flex-wrap items-center gap-2">
          <span className="w-28 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g === "mandatory" ? t.search.mandatory : t.search.nice}</span>
          {reqs[g].map((r, i) => (
            <span key={i} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm", g === "mandatory" ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground")}>
              {readOnly ? r.label : <button onClick={() => move(g, i)} title="↕">{r.label}</button>}
              {!readOnly && <button onClick={() => remove(g, i)}><X className="size-3" /></button>}
            </span>
          ))}
          {g === "mandatory" && !readOnly && (
            <form onSubmit={(e) => { e.preventDefault(); add(); }}>
              <input value={newReq} onChange={(e) => setNewReq(e.target.value)} placeholder={t.search.addReq} className="w-36 rounded-full border bg-transparent px-3 py-1 text-sm outline-none" />
            </form>
          )}
        </div>
      ))}
      {footer}
    </div>
  );
}
