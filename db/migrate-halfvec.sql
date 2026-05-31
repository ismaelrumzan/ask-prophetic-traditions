-- Shrink embedding storage ~50% (vector/float32 → halfvec/float16).
-- Run when nearing Neon free-tier 512 MB limit: npm run db:migrate:halfvec
-- Safe on existing data — does not truncate.

DROP INDEX IF EXISTS hadiths_embedding_idx;

ALTER TABLE hadiths
  ALTER COLUMN embedding TYPE halfvec(1024)
  USING embedding::halfvec(1024);

CREATE INDEX hadiths_embedding_idx
  ON hadiths
  USING hnsw (embedding halfvec_cosine_ops);

VACUUM ANALYZE hadiths;
