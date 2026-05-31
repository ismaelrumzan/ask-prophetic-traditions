-- Kutub al-Sittah vector corpus (Neon + pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS hadiths (
  id BIGSERIAL PRIMARY KEY,
  collection TEXT NOT NULL,
  hadith_number INTEGER NOT NULL,
  search_text TEXT NOT NULL,
  chapter_en TEXT NOT NULL DEFAULT '',
  chapter_ar TEXT NOT NULL DEFAULT '',
  reference_url TEXT NOT NULL,
  corpus_version TEXT NOT NULL,
  embedding halfvec(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection, hadith_number)
);

CREATE INDEX IF NOT EXISTS hadiths_collection_idx ON hadiths (collection);

CREATE INDEX IF NOT EXISTS hadiths_embedding_idx
  ON hadiths
  USING hnsw (embedding halfvec_cosine_ops);
