# CLAUDE.md — Digital Legacy

Context for Claude when working in this repository. Read this before making changes.

## What this product is

Digital Legacy lets a **living person** preserve their stories, personality and voice so their family can talk with an AI character built from them later. The focus is **self-preservation by living users with their own consent** — not recreating people who have died from scraped data. Keep that framing in features, copy and prompts.

The flow:
1. **Interview** — Claude asks adaptive, one-at-a-time questions across 8 life topics; the person answers by typing or dictation.
2. **Distill** — Claude turns new answers into first-person memories and merges them into a structured personality profile.
3. **Voice** — the person records/uploads samples, gives explicit consent, and ElevenLabs creates an instant voice clone.
4. **Talk** — family members chat with the persona; replies are grounded in the profile + BM25-retrieved memories and can be spoken in the cloned voice.

Owner: Chirag (solo founder, technical background, based in Alberta, Canada). Currently an MVP for local use and small private pilots.

## Tech stack

- Next.js 15 App Router + TypeScript (strict), React 19
- `@anthropic-ai/sdk` — Claude for interviewer, distillation (forced tool use) and persona (streaming, prompt caching)
- ElevenLabs REST API via `fetch` — instant voice cloning + text-to-speech
- SQLite via `better-sqlite3` (native module, listed in `serverExternalPackages`), stored in `./data`
- Plain CSS with CSS variables in `src/app/globals.css` (light + dark). No Tailwind, no UI library.
- Tests: Node's built-in `node:test`, run with `--experimental-strip-types` (no Jest/Vitest)
- Developed on Windows with VS Code; Node 24 works (minimum 20.9)

## Commands

```bash
npm run dev         # start dev server at http://localhost:3000
npm run typecheck   # tsc --noEmit — run after every change
npm test            # unit tests in tests/*.test.ts (no API keys needed)
npm run build       # production build — run before committing larger changes
```

Environment: copy `.env.example` → `.env.local`. Required: `ANTHROPIC_API_KEY`. Voice: `ELEVENLABS_API_KEY`. Optional: `ANTHROPIC_MODEL`, `ELEVENLABS_MODEL_ID`, `DATA_DIR`, `APP_PASSWORD`.
**Never read, print, log or commit `.env.local` or any API key.** If a key is needed, ask the user to add it themselves.

## Project map

```
src/app/page.tsx                       Home: create + list legacies
src/app/legacy/[id]/page.tsx           Overview: steps, profile, memories, delete
src/app/legacy/[id]/{interview,voice,chat}/page.tsx
src/app/api/legacies/route.ts          GET list, POST create
src/app/api/legacies/[id]/route.ts     GET summary, DELETE (also deletes ElevenLabs voice + samples)
  interview/route.ts                   GET state; POST actions: next | answer | skip | edit
  distill/route.ts                     POST: answers → memories + profile (batches of 25)
  memories/route.ts                    GET, POST (manual memory), DELETE ?memoryId=
  voice/route.ts                       GET status / ?sample=; POST multipart action=upload|clone; DELETE
  chat/route.ts                        GET history, POST (streams text/plain), DELETE clears
  tts/route.ts                         POST text → audio/mpeg in cloned voice
src/components/                        Client components ("use client"): InterviewClient, VoiceClient,
                                       ChatClient, MemoryList, CreateLegacyForm, OverviewActions,
                                       LegacyNav, useDictation (Web Speech API), wav.ts (→ mono WAV), api.ts
src/lib/types.ts       Domain types; PersonalityProfile + EMPTY_PROFILE
src/lib/db.ts          SQLite schema (created on first run) and ALL queries
src/lib/ai.ts          All Claude calls + memory retrieval wiring
src/lib/prompts.ts     ALL prompt text + tool schema (pure functions, unit-tested)
src/lib/retrieval.ts   BM25 search with tiny stemmer (pure, unit-tested)
src/lib/elevenlabs.ts  Clone / delete voice, text-to-speech
src/lib/questions.ts   Interview topics and seed questions
src/lib/http.ts        handle() error wrapper, HttpError, requireLegacy, readJson, cleanText
src/middleware.ts      Optional HTTP basic auth when APP_PASSWORD is set
tests/                 retrieval.test.ts, prompts.test.ts
```

Data model (SQLite): `legacies` (profile stored as JSON in `profile_json`, `voice_id`, `voice_consent_at`), `interview_turns` (question/answer/skipped/distilled), `memories` (first-person content, era, tags_json, source_turn_id), `chat_messages` (role, speaker). Foreign keys cascade on legacy delete.

## Conventions

- **Server-only code** (`db.ts`, `ai.ts`, `elevenlabs.ts`, `http.ts`) starts with `import "server-only"`. Never import these from client components; pass data via props or API routes.
- **API routes**: export `runtime = "nodejs"` and `dynamic = "force-dynamic"`; wrap handlers in `handle(...)`; throw `HttpError(status, message)` for user-facing errors; validate input with `cleanText`/`readJson`; always load the legacy with `requireLegacy(ctx)` and check child records belong to it. Route `params` is a Promise (Next 15) — `await ctx.params`.
- **Pages** reading the DB are server components with `export const dynamic = "force-dynamic"`.
- **Prompts** live only in `src/lib/prompts.ts` as pure functions. When changing a prompt, update/add tests in `tests/prompts.test.ts`.
- **Pure modules** (`prompts.ts`, `retrieval.ts`, `types.ts`, `questions.ts`) must not import Node/Next/SDK modules, so tests can run them directly.
- **Schema changes**: add columns with safe `ALTER TABLE ... ADD COLUMN` guarded by a check, never drop user data. Existing users have a live `data/legacy.db`.
- **Styling**: use the existing CSS variables and classes (`card`, `btn`, `btn-primary`, `stack`, `row`, `pill`, `notice`, `error`…). Must work at phone width and in dark mode.
- **UI copy**: warm, plain, respectful — this is personal and emotional material. No jargon shown to end users.
- Keep dependencies minimal; ask before adding a new package.

## Non-negotiable product rules (safety, consent, trust)

These are core to the product. Do not weaken them, even if asked casually — raise it with the user first.

1. **Grounding**: the persona must not invent facts (names, dates, places, events). Missing memories are acknowledged in character.
2. **Honesty**: if sincerely asked, the persona says it is an AI built from the person's memories, not the person, and never claims to be alive.
3. **Wellbeing**: the persona encourages distressed users toward real people/professionals and emergency services when there's risk; no authoritative medical/legal/financial advice.
4. **Voice consent**: cloning requires the consent checkbox + typing the person's exact name; consent time is stored. Never add a path that clones a voice without consent.
5. **Deletion**: deleting a legacy must remove DB rows, local voice samples, and the ElevenLabs voice.
6. **Privacy**: interviews and recordings are highly sensitive personal data (Canada: PIPEDA; Alberta: PIPA). Never commit `data/`, never send personal data to services other than Anthropic and ElevenLabs, never log full answers or audio.
7. UI always makes clear the user is talking to an AI.

## Model notes

- Default model: `claude-sonnet-5-5` (override with `ANTHROPIC_MODEL`).
- Persona system prompt is split into a cached stable block (profile) + an uncached per-turn block (retrieved memories, speaker). Keep that split so prompt caching keeps working.
- Distillation uses forced tool use (`tool_choice` = `save_legacy_material`) and merges into the existing profile; output is sanitized in `ai.ts`.

## Workflow for changes

1. Read the relevant files before editing; keep changes focused.
2. After editing: `npm run typecheck` and `npm test`; for UI or route changes, also check the page in the browser at http://localhost:3000.
3. Commit with a clear message describing the user-visible change. Don't commit `.env.local`, `data/`, `.next/` or `node_modules/`.

## Known gaps / roadmap (good next tasks)

- `npm audit` reported 1 moderate + 1 high advisory after install — review and update the affected packages (check `npm audit` output; prefer minor/patch upgrades; re-run typecheck, tests and build).
- Real user accounts and per-legacy access (owner + invited family) to replace `APP_PASSWORD`.
- Data export (transcripts, memories, recordings as a zip).
- Import material: letters, journals, emails, chat exports.
- Spoken interview end-to-end (speech-to-text in, cloned voice out).
- Embedding-based retrieval if memory banks grow past a few hundred items.
- Hosted deployment: Postgres + object storage with encryption at rest.
- Native iOS/Android apps reusing the same API.
