# Ask Prophetic Traditions

Search the six canonical hadith collections (Kutub al-Sittah) with cited, bilingual evidence — powered by [Mixedbread](https://www.mixedbread.com) native question answering.

Design decisions are documented in [`docs/DESIGN.md`](docs/DESIGN.md).

## Setup

```bash
cp .env.example .env.local
# Add MXBAI_API_KEY from https://www.mixedbread.com
```

### 1. Build corpus files

Downloads [hadith-json v1.2.0](https://github.com/AhmedBaset/hadith-json) and writes pre-chunked `.mxjsonl` files:

```bash
npm run build:corpus
```

Output: `data/corpus/*.mxjsonl` (six books, one hadith per line).

### 2. Upload to Mixedbread

Creates store `kutub-sittah-v1` (if missing) and uploads all six files:

```bash
npm run upload:corpus
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Purpose |
|----------|---------|
| `MXBAI_API_KEY` | Mixedbread API key (required) |
| `MXBAI_STORE_ID` | Store name (default: `kutub-sittah-v1`) |
| `AGENTIC_SEARCH` | Set `false` to reduce cost/latency |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (recommended in production) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |

## Deploy (Vercel)

1. Push repo and import on Vercel
2. Add env vars from `.env.example`
3. Run corpus upload once from your machine (or CI) before go-live
4. Spot-check answers against [sunnah.com](https://sunnah.com)

## Related

Static learner hub: [`prophetic-hadiths`](../prophetic-hadiths) — link this app when ready.
