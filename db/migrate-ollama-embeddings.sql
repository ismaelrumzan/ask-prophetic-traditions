-- Switch from OpenAI 1536-dim embeddings to Ollama bge-m3 halfvec (1024-dim).
-- Run once if you already applied the old schema: npm run db:migrate:ollama
-- Then re-seed: npm run seed:corpus -- --force

DROP INDEX IF EXISTS hadiths_embedding_idx;
TRUNCATE hadiths;
ALTER TABLE hadiths ALTER COLUMN embedding TYPE halfvec(1024);
CREATE INDEX hadiths_embedding_idx
  ON hadiths
  USING hnsw (embedding halfvec_cosine_ops);
