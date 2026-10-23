import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { secret } from "@/lib/crypto";

export type Role = "admin" | "recruiter" | "viewer";
export interface SessionUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
}

const COOKIE = "motor_session";
const key = () => new TextEncoder().encode(secret());

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let claims: SessionUser;
  try {
    claims = (await jwtVerify(token, key())).payload as unknown as SessionUser;
  } catch {
    return null;
  }
  // Se valida contra la base en cada request: si el usuario fue desactivado, cambió de rol
  // o la base se reseteó, la sesión vieja deja de valer al instante.
  const { one } = await import("@/lib/db");
  const u = await one<{ id: string; tenant_id: string; email: string; name: string; role: Role; status: string }>(
    "SELECT id, tenant_id, email, name, role, status FROM users WHERE id = $1",
    [claims.id],
  );
  if (!u || u.status === "disabled") return null;
  return { id: u.id, tenantId: u.tenant_id, email: u.email, name: u.name, role: u.role };
}

/** Para páginas: redirige al login si no hay sesión o el rol no alcanza. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}

/** Para APIs: devuelve el usuario o null (la ruta responde 401/403). */
export async function apiUser(roles?: Role[]): Promise<SessionUser | null> {
  const user = await getSession();
  if (!user) return null;
  if (roles && !roles.includes(user.role)) return null;
  return user;
}

export const can = {
  decide: (r: Role) => r === "admin" || r === "recruiter",
  upload: (r: Role) => r === "admin" || r === "recruiter",
  seeContact: (r: Role) => r === "admin" || r === "recruiter",
  admin: (r: Role) => r === "admin",
};
