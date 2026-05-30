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

## Mixedbread

| Layer | Choice |
|-------|--------|
| **Store** | `kutub-sittah-v1` (private) |
| **Ingest** | 6 × `.mxjsonl` — one hadith = one pre-chunked line |
| **QA** | Native `question_answering` only (no separate LLM) |
| **Search** | `agentic: true` (toggle via `AGENTIC_SEARCH=false`) |
| **top_k** | 8 |
| **qa_options** | `cite: true`, `multimodal: false` |

## Instructions

- Six Books only; no outside knowledge
- **Strict no fatwā** — refuse legal/ruling questions; redirect to scholar
- Evidence always **Arabic + English**
- No invented historical context
- Weak retrieval → say so; never hallucinate hadiths

## Chat app

| Item | Choice |
|------|----------|
| **Stack** | Next.js App Router on Vercel, `@mixedbread/sdk` |
| **History** | Client `sessionStorage`, last 6 messages |
| **Access** | Public anonymous + Upstash rate limit (optional in dev) |
| **MVP UI** | Chat, evidence cards, example prompts, disclaimer, new conversation |

## Pre-launch

1. `npm run build:corpus` → `data/corpus/*.mxjsonl`
2. `npm run upload:corpus` → Mixedbread store
3. Spot-check ~50 Q&A vs sunnah.com
4. Add hub card on `prophetic-hadiths`

## Env

See `.env.example`.
