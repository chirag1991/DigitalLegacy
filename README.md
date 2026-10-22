# Digital Legacy

Preserve a living person's stories, personality and voice as an AI character their family can talk with.

A person sits down with a warm, adaptive AI interviewer and tells their stories. Digital Legacy turns those answers into first-person memories and a personality profile (how they talk, what they value, how they make decisions), clones their voice with their consent, and lets family members have a conversation with the result.

## How it works

```
 Interview  ──►  Answers  ──►  "Learn from answers"  ──►  Memories + Personality profile
 (Claude asks                   (Claude extracts             │
  adaptive questions)            structured material)        ▼
                                                   Chat: profile + most relevant memories
 Voice recordings ──► ElevenLabs voice clone ──►   ──► Claude replies in their style
                                                   ──► ElevenLabs speaks it in their voice
```

| Step | Page | What happens |
| --- | --- | --- |
| 1 | **Interview** | Eight topics (early life, family, work, values, humor, decisions, favorites, advice). Claude asks one question at a time and follows up on what you say. Type or dictate answers. |
| 2 | **Overview → Learn from new answers** | Claude converts answers into first-person memories and merges them into the personality profile. Memories can be reviewed, searched, added by hand and deleted. |
| 3 | **Voice** | Read short passages aloud (converted to WAV in the browser) or upload audio. After explicit consent, an instant voice clone is created at ElevenLabs. |
| 4 | **Talk** | Family members chat with the legacy. Each reply uses the profile plus the memories most relevant to the conversation, and can be played in the cloned voice. |

### Built-in safeguards

- The persona must not invent names, dates or events; if a memory isn't recorded it says so in character.
- If someone sincerely asks, it says honestly that it is an AI built from the person's memories.
- It encourages a distressed user to reach out to real people or professionals, and avoids authoritative medical, legal or financial advice.
- Voice cloning requires a consent checkbox and typing the person's full name; consent time is stored.
- Deleting a legacy removes its database rows, local recordings and the cloned voice at ElevenLabs.

## Tech stack

- **Next.js 15 (App Router) + TypeScript** for the UI and API routes
- **Claude API** (`@anthropic-ai/sdk`) for interviewing, memory extraction and the persona (streamed, with prompt caching)
- **ElevenLabs** for instant voice cloning and text-to-speech
- **SQLite** (`better-sqlite3`) for storage, in `./data`
- **BM25 keyword retrieval** (`src/lib/retrieval.ts`) to find relevant memories — no vector database needed at this scale

## Getting started

Requirements: Node.js 20.9 or newer, a Claude API key, and (for voice) an ElevenLabs API key.

```bash
git clone https://github.com/chirag1991/DigitalLegacy.git
cd DigitalLegacy
npm install
cp .env.example .env.local      # on Windows: copy .env.example .env.local
```

Edit `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...
```

Then run:

```bash
npm run dev
```

Open http://localhost:3000, create a legacy, and start the interview.

Other scripts:

```bash
npm test            # unit tests for retrieval and prompts (no API keys needed)
npm run typecheck   # TypeScript check
npm run build && npm start   # production build
```

### Notes

- **Voice cloning on ElevenLabs** requires a paid plan that includes Instant Voice Cloning. Text-only mode works without it.
- **Dictation** ("Speak your answer") uses the browser's built-in speech recognition and works in Chrome, Edge and Safari.
- **Microphone access** needs `localhost` or HTTPS.
- If `npm install` fails on `better-sqlite3`, make sure you're on a current Node LTS (20 or 22). It ships prebuilt binaries for Windows, macOS and Linux.

## Project structure

```
src/
  app/
    page.tsx                         Home: create and list legacies
    legacy/[id]/page.tsx             Overview: progress, profile, memories
    legacy/[id]/interview/page.tsx   Guided interview
    legacy/[id]/voice/page.tsx       Voice recording, consent, cloning
    legacy/[id]/chat/page.tsx        Talk with the legacy
    api/legacies/...                 REST + streaming API routes
  components/                        Client UI (interview, voice, chat, memories)
  lib/
    db.ts            SQLite schema and queries
    ai.ts            Claude calls: interviewer, distillation, persona
    prompts.ts       All prompt text (pure, unit-tested)
    retrieval.ts     BM25 memory search (pure, unit-tested)
    elevenlabs.ts    Voice cloning and text-to-speech
    questions.ts     Interview topics and opening questions
  middleware.ts      Optional password protection (APP_PASSWORD)
tests/               node:test unit tests
```

## Before going public

This is an MVP intended to run locally or for a small private pilot. Before opening it to the public:

1. **Accounts and access control.** Replace the optional `APP_PASSWORD` gate with real user accounts, and decide who can view or talk to each legacy (owner, invited family members).
2. **Hosted database and file storage.** Move from SQLite and local files to a managed database (e.g. Postgres) and object storage, encrypted at rest.
3. **Privacy and legal review.** Interviews and voice recordings are highly sensitive personal data. Get a privacy policy and terms reviewed for your markets (in Canada, PIPEDA and Alberta's PIPA), including what happens to a legacy after the person dies and who inherits control.
4. **Voice-consent verification.** Consider stronger checks, such as having the person read a consent statement aloud as one of the samples.
5. **Data export.** Let families download everything (transcripts, memories, recordings) so the legacy outlives any one service.

## Roadmap ideas

- Import material: letters, journals, emails, chat exports, photo captions
- Spoken interviews end-to-end (speech-to-text in, cloned voice out)
- Embedding-based retrieval when a memory bank grows large
- Animated avatar or video
- Native iOS and Android apps sharing the same API
