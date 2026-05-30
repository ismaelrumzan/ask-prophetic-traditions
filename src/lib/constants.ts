export const STORE_ID = process.env.MXBAI_STORE_ID ?? "kutub-sittah-v1";

export const CORPUS_VERSION = "hadith-json-v1.2.0";

export const EXAMPLE_PROMPTS = [
  "What do the collections say about sincerity in deeds?",
  "Hadiths on mercy and gentleness",
  "What did the Prophet teach about neighbours?",
  "Intentions and the reward of actions",
] as const;

export const COLLECTION_LABELS: Record<string, string> = {
  bukhari: "Sahih al-Bukhari",
  muslim: "Sahih Muslim",
  abudawud: "Sunan Abi Dawud",
  tirmidhi: "Jami' at-Tirmidhi",
  nasai: "Sunan an-Nasa'i",
  ibnmajah: "Sunan Ibn Majah",
};

export const MAX_HISTORY_MESSAGES = 6;

export const RATE_LIMIT = {
  requests: 20,
  window: "1 h",
} as const;
