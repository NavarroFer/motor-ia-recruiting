// Verifica las API keys y el formato de las llamadas con UNA llamada mínima a cada API.
// Costo total: menos de USD 0,001. No toca la base ni el presupuesto de la app.
import "./env";
import { MODELS } from "@/lib/pricing";

async function claude() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "✗ falta ANTHROPIC_API_KEY en .env.local";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELS.extraction,
      max_tokens: 100,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      tools: [{ name: "ping", description: "Reply", input_schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] } }],
      tool_choice: { type: "tool", name: "ping" },
      messages: [{ role: "user", content: "Call the tool with ok=true." }],
    }),
  });
  const text = await res.text();
  if (!res.ok) return `✗ Anthropic ${res.status}: ${text.slice(0, 300)}`;
  const j = JSON.parse(text);
  const tool = j.content?.find((c: { type: string }) => c.type === "tool_use");
  return tool ? `✓ Claude (${MODELS.extraction}) OK · tool use OK · ${j.usage?.input_tokens}+${j.usage?.output_tokens} tokens` : `✗ Respondió sin tool_use: ${text.slice(0, 200)}`;
}

async function openai() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return "✗ falta OPENAI_API_KEY en .env.local";
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODELS.embedding, input: "ping" }),
  });
  if (!res.ok) return `✗ OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`;
  const j = await res.json();
  return `✓ OpenAI embeddings (${MODELS.embedding}) OK · ${j.data[0].embedding.length} dimensiones`;
}

console.log(await claude());
console.log(await openai());
