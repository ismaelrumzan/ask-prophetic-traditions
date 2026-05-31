export function buildQueryFromHistory(
  messages: { role: string; content: string }[],
): string {
  const recent = messages.slice(-6);
  if (recent.length <= 1) {
    return recent.at(-1)?.content ?? "";
  }

  const transcript = recent
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const latest = recent.at(-1)?.content ?? "";
  return `Conversation so far:\n${transcript}\n\nLatest user question:\n${latest}`;
}
