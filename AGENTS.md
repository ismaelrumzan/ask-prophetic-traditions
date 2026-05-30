<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Ask Prophetic Traditions

RAG chat over Kutub al-Sittah via Mixedbread native `question_answering` (no separate LLM).

- **Design spec:** `docs/DESIGN.md`
- **Corpus ingest:** `npm run build:corpus` → `npm run upload:corpus`
- **Store:** `kutub-sittah-v1` with six `.mxjsonl` files (one hadith = one chunk)
