# Ask Prophetic Traditions — Design spec

Locked decisions from product/design review (May 2026).

## Product

| Item | Decision |
|------|----------|
| **Name** | Ask Prophetic Traditions |
| **Tagline** | Search the six canonical hadith collections — cited, bilingual, not fatwā |
| **Audience** | General learners + teachers |
| **Hub** | Linked from `prophetic-hadiths` when ready (Resource 3) |

## Corpus (v1)

- **Source:** [hadith-json v1.2.0](https://github.com/AhmedBaset/hadith-json/tree/v1.2.0) — six Kutub al-Sittah only
- **Citations:** `https://sunnah.com/{collection}:{number}`
- **Context:** Strict Six Books only; corpus C (sīrah/commentary) deferred

## Retrieval + generation

| Layer | Choice |
|-------|--------|
| **Database** | Neon Postgres + pgvector (`halfvec(1024)`) |
| **Embeddings** | Qwen3-Embedding-0.6B — Ollama (`qwen3-embedding:0.6b`) or Gateway (`alibaba/qwen3-embedding-0.6b`) |
| **Ingest** | 6 × `.mxjsonl` → Qwen3 embed (documents raw, queries instruct-prefixed) → `hadiths` |
| **Search** | Cosine similarity, `top_k: 8`, optional collection filter (v1.1) |
| **Answer** | AI Gateway (`VERCEL_OIDC_TOKEN`) + `gpt-4o-mini` + strict QA instructions |
| **Index** | HNSW on `embedding` |

## Instructions

- Six Books only; no outside knowledge
- **Strict no fatwā** — refuse legal/ruling questions; redirect to scholar
- Evidence always **Arabic + English**
- No invented historical context
- Weak retrieval → say so; never hallucinate hadiths

## Chat app

| Item | Choice |
|------|----------|
| **Stack** | Next.js App Router on Vercel, Neon, AI SDK |
| **History** | Client `sessionStorage`, last 6 messages |
| **Access** | Public anonymous + Upstash rate limit (optional in dev) |
| **MVP UI** | Chat, evidence cards, example prompts, disclaimer, new conversation |

## Pre-launch

1. `npm run build:corpus` → `data/corpus/*.mxjsonl`
2. `npm run db:migrate` → pgvector schema on Neon
3. `npm run seed:corpus` → embed + upsert ~34k hadiths
4. Spot-check ~50 Q&A vs sunnah.com
5. Add hub card on `prophetic-hadiths`

## Env

See `.env.example`.
