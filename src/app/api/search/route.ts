import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { body, handle, ok, unauthorized } from "@/lib/http";
import { search } from "@/lib/search";

const Req = z.object({
  type: z.enum(["skill", "total_years", "seniority", "language", "work_mode"]),
  skill: z.string().optional(),
  min_years: z.number().optional(),
  value: z.string().optional(),
  label: z.string(),
});
const Schema = z.object({
  query: z.string().min(2).max(500),
  requirements: z
    .object({
      mandatory: z.array(Req),
      nice_to_have: z.array(z.object({ skill: z.string().optional(), label: z.string() })),
      semantic_query: z.string(),
    })
    .optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  const input = await body(req, Schema);
  return ok(await search({ tenantId: user.tenantId, userId: user.id, query: input.query, requirements: input.requirements }));
});
