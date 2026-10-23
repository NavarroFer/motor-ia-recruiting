// Cliente Claude por fetch (patrón de studio/src/lib/anthropic.ts), con registro de tokens y costo.
import { MODELS, costUsd } from "@/lib/pricing";
import { recordUsage, type UsageKind } from "@/lib/usage";

export class AnthropicError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AnthropicError";
  }
}

type Content = { type: string; text?: string; input?: unknown };
type Response = { content: Content[]; stop_reason?: string; usage?: { input_tokens: number; output_tokens: number } };

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Llamada con tool use forzado: devuelve el input del tool (JSON estructurado).
 * Haiku 5.5: thinking apagado + effort bajo = más barato y determinista para extracción.
 * Sin temperature/top_p/top_k (no se usan en esta generación de modelos).
 */
export async function callTool<T>(opts: {
  tenantId: string;
  kind: UsageKind;
  system: string;
  content: unknown[];
  tool: ToolDef;
  maxTokens?: number;
  documentId?: string | null;
  searchId?: string | null;
}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicError(503, "ANTHROPIC_API_KEY no configurada");

  const body = {
    model: MODELS.extraction,
    max_tokens: opts.maxTokens ?? 1000,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    tools: [opts.tool],
    tool_choice: { type: "tool", name: opts.tool.name },
    messages: [{ role: "user", content: opts.content }],
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new AnthropicError(res.status, await res.text());
    const json = (await res.json()) as Response;

    const inTok = json.usage?.input_tokens ?? 0;
    const outTok = json.usage?.output_tokens ?? 0;
    await recordUsage({
      tenantId: opts.tenantId,
      kind: opts.kind,
      model: MODELS.extraction,
      inputTokens: inTok,
      outputTokens: outTok,
      costUsd: costUsd(MODELS.extraction, inTok, outTok),
      documentId: opts.documentId,
      searchId: opts.searchId,
    });

    // Si se cortó por max_tokens el JSON viene incompleto: se reintenta con el doble de margen.
    if (json.stop_reason === "max_tokens") {
      body.max_tokens = body.max_tokens * 2;
      continue;
    }
    const tool = json.content.find((c) => c.type === "tool_use") as { input?: T } | undefined;
    if (tool?.input) return tool.input;
  }
  throw new AnthropicError(502, "El modelo no devolvió el JSON esperado");
}
