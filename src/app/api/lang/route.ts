import { cookies } from "next/headers";
import { ok } from "@/lib/http";

export async function POST(req: Request) {
  const { lang } = (await req.json()) as { lang?: string };
  (await cookies()).set("lang", lang === "es" ? "es" : "en", { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return ok({ ok: true });
}
