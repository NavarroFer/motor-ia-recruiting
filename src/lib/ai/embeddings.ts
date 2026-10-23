import { MODELS, costUsd } from "@/lib/pricing";
import { recordUsage } from "@/lib/usage";

export const EMBEDDING_DIMS = 1536;

export async function embed(text: string, ctx: { tenantId: string; documentId?: string; searchId?: string }): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODELS.embedding, input: text.slice(0, 24000) }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[]; usage?: { prompt_tokens: number } };
  const tokens = json.usage?.prompt_tokens ?? 0;
  await recordUsage({
    tenantId: ctx.tenantId,
    kind: "embedding",
    model: MODELS.embedding,
    inputTokens: tokens,
    outputTokens: 0,
    costUsd: costUsd(MODELS.embedding, tokens, 0),
    documentId: ctx.documentId,
    searchId: ctx.searchId,
  });
  return json.data[0].embedding;
}
