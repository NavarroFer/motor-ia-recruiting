import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (status: number, error: string, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status });
export const unauthorized = () => fail(401, "No autorizado");

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  return schema.parse(await req.json());
}

/** Envuelve un handler: errores de validación → 400, el resto → 500 con log. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ZodError) return fail(400, "Datos inválidos", { issues: e.issues });
      console.error(e);
      return fail(500, e instanceof Error ? e.message : "Error inesperado");
    }
  };
}
