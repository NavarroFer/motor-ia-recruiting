import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { body, handle, ok, unauthorized } from "@/lib/http";
import { explain } from "@/lib/search";

const Schema = z.object({ searchId: z.string().uuid(), candidateId: z.string().uuid(), lang: z.enum(["en", "es"]).default("en"), ai: z.boolean().default(false) });

export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  const input = await body(req, Schema);
  return ok(await explain({ tenantId: user.tenantId, ...input }));
});
