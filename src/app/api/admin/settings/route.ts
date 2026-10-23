import { z } from "zod";
import { q } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { body, fail, handle, ok } from "@/lib/http";
import { getSetting, setSetting } from "@/lib/settings";

const Schema = z.object({
  apiEnabled: z.boolean().optional(),
  autoProcess: z.boolean().optional(),
  monthlyBudgetUsd: z.number().min(0).max(100000).optional(),
});

async function current(tenantId: string) {
  const [t] = await q<{ monthly_budget_usd: string }>("SELECT monthly_budget_usd FROM tenants WHERE id = $1", [tenantId]);
  return {
    apiEnabled: await getSetting("api_enabled", false),
    autoProcess: await getSetting("auto_process", false),
    monthlyBudgetUsd: Number(t?.monthly_budget_usd ?? 0),
    keys: { anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY },
  };
}

export const GET = handle(async () => {
  const user = await apiUser(["admin"]);
  if (!user) return fail(403, "Solo admin");
  return ok(await current(user.tenantId));
});

export const POST = handle(async (req: Request) => {
  const user = await apiUser(["admin"]);
  if (!user) return fail(403, "Solo admin");
  const input = await body(req, Schema);
  if (input.apiEnabled !== undefined) await setSetting("api_enabled", input.apiEnabled);
  if (input.autoProcess !== undefined) await setSetting("auto_process", input.autoProcess);
  if (input.monthlyBudgetUsd !== undefined) {
    await q("UPDATE tenants SET monthly_budget_usd = $2 WHERE id = $1", [user.tenantId, input.monthlyBudgetUsd]);
    // Si había CVs esperando por presupuesto, vuelven a la cola
    await q("UPDATE jobs SET status = 'pending', run_after = now() WHERE status = 'waiting_budget'");
  }
  if (input.apiEnabled) await q("UPDATE jobs SET status = 'pending', run_after = now() WHERE status = 'waiting_budget'");
  await audit({ tenantId: user.tenantId, userId: user.id, action: "settings_change", detail: input });
  return ok(await current(user.tenantId));
});
