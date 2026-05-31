import { gateway } from "ai";

function gatewayModelId(model: string) {
  return model.includes("/") ? model : `openai/${model}`;
}

/** Chat generation only — uses Vercel AI Gateway (VERCEL_OIDC_TOKEN). */
export function getChatModel() {
  const model = process.env.CHAT_MODEL ?? "gpt-4o-mini";
  return gateway(gatewayModelId(model));
}
