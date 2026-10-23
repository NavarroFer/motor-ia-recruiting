import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { one, q } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { body, fail, handle, ok } from "@/lib/http";

export const GET = handle(async () => {
  const user = await apiUser(["admin"]);
  if (!user) return fail(403, "Solo admin");
  return ok({
    users: await q("SELECT id, email, name, role, status, last_login_at, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at", [user.tenantId]),
  });
});

const Invite = z.object({ email: z.string().email(), name: z.string().min(1), role: z.enum(["admin", "recruiter", "viewer"]) });

/** Invitar: crea el usuario con contraseña temporal (en producción, mail con link). */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(["admin"]);
  if (!user) return fail(403, "Solo admin");
  const input = await body(req, Invite);
  if (await one("SELECT 1 FROM users WHERE lower(email) = lower($1)", [input.email])) return fail(409, "Ese email ya existe");
  const temp = randomBytes(6).toString("base64url");
  await q("INSERT INTO users (tenant_id, email, name, role, password_hash, status) VALUES ($1,$2,$3,$4,$5,'invited')", [
    user.tenantId, input.email, input.name, input.role, await bcrypt.hash(temp, 10),
  ]);
  await audit({ tenantId: user.tenantId, userId: user.id, action: "invite_user", detail: { email: input.email, role: input.role } });
  return ok({ ok: true, tempPassword: temp });
});

const Patch = z.object({ id: z.string().uuid(), role: z.enum(["admin", "recruiter", "viewer"]).optional(), status: z.enum(["active", "disabled"]).optional() });

export const PATCH = handle(async (req: Request) => {
  const user = await apiUser(["admin"]);
  if (!user) return fail(403, "Solo admin");
  const input = await body(req, Patch);
  if (input.id === user.id) return fail(400, "No podés cambiar tu propio rol o estado");
  if (input.role) await q("UPDATE users SET role = $3 WHERE id = $1 AND tenant_id = $2", [input.id, user.tenantId, input.role]);
  if (input.status) await q("UPDATE users SET status = $3 WHERE id = $1 AND tenant_id = $2", [input.id, user.tenantId, input.status]);
  await audit({ tenantId: user.tenantId, userId: user.id, action: "update_user", detail: input });
  return ok({ ok: true });
});
