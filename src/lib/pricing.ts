// Precios USD por millón de tokens (octubre 2026). Mismos supuestos que docs/costos.py.
export const MODELS = {
  extraction: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
  embedding: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
};

const PER_M: Record<string, { in: number; out: number }> = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "text-embedding-3-small": { in: 0.02, out: 0 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number, opts?: { batch?: boolean }) {
  const p = PER_M[model] ?? PER_M["claude-haiku-5-5"];
  const factor = opts?.batch ? 0.5 : 1;
  return ((inputTokens * p.in + outputTokens * p.out) / 1_000_000) * factor;
}
