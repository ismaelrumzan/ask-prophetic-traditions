# Ask Prophetic Traditions

Search the six canonical hadith collections (Kutub al-Sittah) with cited, bilingual evidence — **Qwen3 embeddings** for retrieval, **AI Gateway** for answers.

Design decisions are documented in [`docs/DESIGN.md`](docs/DESIGN.md).

## Setup

```bash
cp .env.example .env.local
vercel env pull .env.local   # DATABASE_URL + VERCEL_OIDC_TOKEN

ollama pull qwen3-embedding:0.6b
ollama serve                 # if not already running
```

### 1. Build corpus files

```bash
npm run build:corpus
```

Output: `data/corpus/*.mxjsonl` (six books, one hadith per line).

### 2. Migrate database schema

Fresh project:

```bash
npm run db:migrate
```

**Migrating from bge-m3** (truncates existing vectors — full re-seed required):

```bash
npm run db:migrate:qwen3
```

**Hybrid keyword + vector search** (adds `search_vector` FTS index — no re-embed):

```bash
npm run db:migrate:hybrid
```

### 3. Seed embeddings (Ollama — recommended for bulk ingest)

```bash
npm run seed:corpus
```

Resume-safe after failures; check progress with `npm run seed:status`.

Per-book: `npm run seed:corpus -- --only=bukhari`  
Overwrite one book: `npm run seed:corpus -- --only=bukhari --force`

### 4. Run locally

```bash
npm run dev
```

### Debug retrieval

```bash
npm run eval:retrieval -- --case=neighbours
npm run eval:retrieval -- --case=neighbours --compare
npm run eval:retrieval -- --all
npm run eval:retrieval -- --query="neighbour rights" --gold=muslim:79,abudawud:3518 --top=25
```

## Embedding model (Qwen3-Embedding-0.6B)

| Setting | Value |
|---------|--------|
| Ollama | `qwen3-embedding:0.6b` |
| AI Gateway | `alibaba/qwen3-embedding-0.6b` |
| Dimensions | 1024 (`halfvec` in Neon) |
| Context | 32k tokens (long hadiths rarely need truncation) |

**Instruct-aware:** user queries get a retrieval instruct prefix; corpus documents are embedded as raw text (per [Qwen3 docs](https://github.com/QwenLM/Qwen3-Embedding)).

**Critical:** use the **same provider** for seed and query (`ollama` *or* `gateway`). Ollama GGUF vs Gateway cloud may differ slightly — default path is `ollama` everywhere, or `gateway` everywhere after spot-checking parity.

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres (required) |
| `EMBEDDING_PROVIDER` | `ollama` (default) or `gateway` |
| `OLLAMA_EMBEDDING_MODEL` | Default `qwen3-embedding:0.6b` |
| `GATEWAY_EMBEDDING_MODEL` | Default `alibaba/qwen3-embedding-0.6b` |
| `OLLAMA_BASE_URL` | Ollama API (local or hosted) |
| `VERCEL_OIDC_TOKEN` | AI Gateway for **chat** (and optional rerank) |
| `CHAT_MODEL` | Default `openai/gpt-4o-mini` |
| `HYBRID_SEARCH` | Default `true` — FTS + vector + RRF (needs `db:migrate:hybrid`) |
| `HYBRID_CANDIDATE_LIMIT` | Default `50` candidates per leg before fusion |
| `RETRIEVAL_RERANK` | Default `false` — Gateway rerank after hybrid recall |
| `RERANK_MODEL` | Default `cohere/rerank-v3.5` |

## Deploy (Vercel)

**Option A — hosted Ollama (matches local seed):**

- Set `EMBEDDING_PROVIDER=ollama` and `OLLAMA_BASE_URL` to your Fly/Railway Ollama instance
- Seed from your Mac against Neon (already done)

**Option B — AI Gateway embeddings in prod:**

- Set `EMBEDDING_PROVIDER=gateway` on Vercel
- Re-seed with `EMBEDDING_PROVIDER=gateway npm run seed:corpus` (or verify Ollama/Gateway vector parity first)

Chat always uses AI Gateway (`VERCEL_OIDC_TOKEN`).

## Storage (Neon 512 MB free tier)

If you hit `project size limit (512 MB) has been exceeded`:

```bash
npm run db:migrate:halfvec
npm run seed:corpus
```

## Related

Static learner hub: [`prophetic-hadiths`](../prophetic-hadiths)
