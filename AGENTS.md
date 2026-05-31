<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Ask Prophetic Traditions

RAG chat over Kutub al-Sittah: Ollama embeddings (search) + AI Gateway LLM (answers).

- **Design spec:** `docs/DESIGN.md`
- **Corpus ingest:** `npm run build:corpus` → `npm run db:migrate` → `npm run db:migrate:qwen3` (from bge-m3) → `npm run seed:corpus`
- **Embeddings:** Qwen3 0.6B via Ollama or `alibaba/qwen3-embedding-0.6b` on Gateway — same provider for seed + query
- **Schema:** `db/schema.sql` — `hadiths.embedding halfvec(1024)`
