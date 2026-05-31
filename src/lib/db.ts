import { neon } from "@neondatabase/serverless";

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return url;
}

export function getSql() {
  return neon(getDatabaseUrl());
}

export function vectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}
