"use client";

import { MAX_HISTORY_MESSAGES } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";

const STORAGE_KEY = "apt-chat-history";
const DISCLAIMER_KEY = "apt-disclaimer-accepted";

export function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveMessages(messages: ChatMessage[]) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(messages.slice(-MAX_HISTORY_MESSAGES)),
  );
}

export function clearMessages() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasAcceptedDisclaimer() {
  return sessionStorage.getItem(DISCLAIMER_KEY) === "1";
}

export function acceptDisclaimer() {
  sessionStorage.setItem(DISCLAIMER_KEY, "1");
}
