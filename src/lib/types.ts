export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  sources?: HadithSource[];
};

export type HadithSource = {
  index: number;
  collection?: string;
  collectionLabel?: string;
  hadithNumber?: number;
  referenceUrl?: string;
  chapterEn?: string;
  chapterAr?: string;
  text?: string;
  score?: number;
};

export type ChatRequestBody = {
  messages: ChatMessage[];
};

export type ChatResponseBody = {
  message: ChatMessage;
};
