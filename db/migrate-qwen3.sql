-- Re-embed corpus with Qwen3-Embedding-0.6B (1024-dim halfvec unchanged).
-- Run: npm run db:migrate:qwen3
-- Then: ollama pull qwen3-embedding:0.6b && npm run seed:corpus

TRUNCATE hadiths;
