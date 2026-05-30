import { NextResponse } from "next/server";

import { askHadithQuestion, buildQueryFromHistory } from "@/lib/mixedbread";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { ChatRequestBody, ChatResponseBody } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function getClientId(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "anonymous";
  return request.headers.get("x-real-ip") ?? "anonymous";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const messages = body.messages ?? [];

    if (!messages.length) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const last = messages.at(-1);
    if (!last || last.role !== "user" || !last.content.trim()) {
      return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
    }

    const rate = await enforceRateLimit(getClientId(request));
    if (!rate.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }

    const query = buildQueryFromHistory(messages);
    const { answer, sources } = await askHadithQuestion(query);

    const response: ChatResponseBody = {
      message: {
        role: "assistant",
        content: answer,
        sources,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[chat]", error);
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
