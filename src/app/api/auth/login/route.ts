import bcrypt from "bcryptjs";
import { z } from "zod";
import { one, q } from "@/lib/db";
import { createSession, type Role } from "@/lib/auth";
import { body, fail, handle, ok } from "@/lib/http";

const Schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const POST = handle(async (req: Request) => {
  const { email, password } = await body(req, Schema);
  const u = await one<{ id: string; tenant_id: string; email: string; name: string; role: Role; password_hash: string; status: string }>(
    "SELECT id, tenant_id, email, name, role, password_hash, status FROM users WHERE lower(email) = lower($1)",
    [email],
  );
  if (!u || u.status === "disabled" || !(await bcrypt.compare(password, u.password_hash))) return fail(401, "Email o contraseña incorrectos");
  await q("UPDATE users SET last_login_at = now(), status = 'active' WHERE id = $1", [u.id]);
  await createSession({ id: u.id, tenantId: u.tenant_id, email: u.email, name: u.name, role: u.role });
  return ok({ ok: true, role: u.role });
});
