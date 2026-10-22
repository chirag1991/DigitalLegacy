import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  EMPTY_PROFILE,
  type ChatMessage,
  type InterviewTurn,
  type Legacy,
  type LegacySummary,
  type Memory,
  type PersonalityProfile,
} from "./types";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

const globalForDb = globalThis as unknown as { __legacyDb?: Database.Database };

function openDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "legacy.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS legacies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      birth_year INTEGER,
      intro TEXT NOT NULL DEFAULT '',
      profile_json TEXT NOT NULL DEFAULT '{}',
      voice_id TEXT,
      voice_consent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS interview_turns (
      id TEXT PRIMARY KEY,
      legacy_id TEXT NOT NULL REFERENCES legacies(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      skipped INTEGER NOT NULL DEFAULT 0,
      distilled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_turns_legacy ON interview_turns(legacy_id, created_at);
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      legacy_id TEXT NOT NULL REFERENCES legacies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      era TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      source_turn_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memories_legacy ON memories(legacy_id);
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      legacy_id TEXT NOT NULL REFERENCES legacies(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      speaker TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_legacy ON chat_messages(legacy_id, created_at);
  `);
  return db;
}

export function db(): Database.Database {
  if (!globalForDb.__legacyDb) globalForDb.__legacyDb = openDb();
  return globalForDb.__legacyDb;
}

const now = () => new Date().toISOString();

/* ---------- row mappers ---------- */

type Row = Record<string, unknown>;

function parseJson<T>(raw: unknown, fallback: T): T {
  try {
    return typeof raw === "string" ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function toLegacy(r: Row): Legacy {
  return {
    id: r.id as string,
    name: r.name as string,
    birthYear: (r.birth_year as number | null) ?? null,
    intro: (r.intro as string) ?? "",
    profile: { ...EMPTY_PROFILE, ...parseJson<Partial<PersonalityProfile>>(r.profile_json, {}) },
    voiceId: (r.voice_id as string | null) ?? null,
    voiceConsentAt: (r.voice_consent_at as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function toTurn(r: Row): InterviewTurn {
  return {
    id: r.id as string,
    legacyId: r.legacy_id as string,
    topic: r.topic as string,
    question: r.question as string,
    answer: (r.answer as string | null) ?? null,
    skipped: !!r.skipped,
    distilled: !!r.distilled,
    createdAt: r.created_at as string,
  };
}

function toMemory(r: Row): Memory {
  return {
    id: r.id as string,
    legacyId: r.legacy_id as string,
    title: r.title as string,
    content: r.content as string,
    era: (r.era as string) ?? "",
    tags: parseJson<string[]>(r.tags_json, []),
    sourceTurnId: (r.source_turn_id as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

function toChat(r: Row): ChatMessage {
  return {
    id: r.id as string,
    legacyId: r.legacy_id as string,
    role: r.role as "user" | "assistant",
    speaker: (r.speaker as string | null) ?? null,
    content: r.content as string,
    createdAt: r.created_at as string,
  };
}

/* ---------- legacies ---------- */

export function listLegacies(): LegacySummary[] {
  const rows = db()
    .prepare(
      `SELECT l.*,
        (SELECT COUNT(*) FROM interview_turns t WHERE t.legacy_id = l.id AND t.answer IS NOT NULL) AS answered,
        (SELECT COUNT(*) FROM interview_turns t WHERE t.legacy_id = l.id AND t.answer IS NOT NULL AND t.distilled = 0) AS pending,
        (SELECT COUNT(*) FROM memories m WHERE m.legacy_id = l.id) AS mems
       FROM legacies l ORDER BY l.updated_at DESC`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    ...toLegacy(r),
    answeredCount: r.answered as number,
    pendingDistillCount: r.pending as number,
    memoryCount: r.mems as number,
  }));
}

export function getLegacy(id: string): Legacy | null {
  const r = db().prepare(`SELECT * FROM legacies WHERE id = ?`).get(id) as Row | undefined;
  return r ? toLegacy(r) : null;
}

export function getLegacySummary(id: string): LegacySummary | null {
  return listLegacies().find((l) => l.id === id) ?? null;
}

export function createLegacy(input: { name: string; birthYear: number | null; intro: string }): Legacy {
  const id = randomUUID();
  const t = now();
  db()
    .prepare(
      `INSERT INTO legacies (id, name, birth_year, intro, profile_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.name, input.birthYear, input.intro, JSON.stringify(EMPTY_PROFILE), t, t);
  return getLegacy(id)!;
}

export function deleteLegacy(id: string): void {
  db().prepare(`DELETE FROM legacies WHERE id = ?`).run(id);
}

export function touchLegacy(id: string): void {
  db().prepare(`UPDATE legacies SET updated_at = ? WHERE id = ?`).run(now(), id);
}

export function saveProfile(id: string, profile: PersonalityProfile): void {
  db()
    .prepare(`UPDATE legacies SET profile_json = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(profile), now(), id);
}

export function setVoice(id: string, voiceId: string | null, consentAt: string | null): void {
  db()
    .prepare(`UPDATE legacies SET voice_id = ?, voice_consent_at = ?, updated_at = ? WHERE id = ?`)
    .run(voiceId, consentAt, now(), id);
}

/* ---------- interview ---------- */

export function listTurns(legacyId: string): InterviewTurn[] {
  return (
    db()
      .prepare(`SELECT * FROM interview_turns WHERE legacy_id = ? ORDER BY created_at ASC`)
      .all(legacyId) as Row[]
  ).map(toTurn);
}

export function getTurn(id: string): InterviewTurn | null {
  const r = db().prepare(`SELECT * FROM interview_turns WHERE id = ?`).get(id) as Row | undefined;
  return r ? toTurn(r) : null;
}

export function createTurn(legacyId: string, topic: string, question: string): InterviewTurn {
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO interview_turns (id, legacy_id, topic, question, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, legacyId, topic, question, now());
  return getTurn(id)!;
}

export function answerTurn(id: string, answer: string): void {
  db().prepare(`UPDATE interview_turns SET answer = ?, skipped = 0, distilled = 0 WHERE id = ?`).run(answer, id);
}

export function skipTurn(id: string): void {
  db().prepare(`UPDATE interview_turns SET skipped = 1 WHERE id = ?`).run(id);
}

/** Removes unanswered, unskipped turns so a fresh question can be asked. */
export function clearPendingTurns(legacyId: string): void {
  db()
    .prepare(`DELETE FROM interview_turns WHERE legacy_id = ? AND answer IS NULL AND skipped = 0`)
    .run(legacyId);
}

export function markTurnsDistilled(ids: string[]): void {
  const stmt = db().prepare(`UPDATE interview_turns SET distilled = 1 WHERE id = ?`);
  db().transaction((list: string[]) => list.forEach((i) => stmt.run(i)))(ids);
}

/* ---------- memories ---------- */

export function listMemories(legacyId: string): Memory[] {
  return (
    db()
      .prepare(`SELECT * FROM memories WHERE legacy_id = ? ORDER BY created_at ASC`)
      .all(legacyId) as Row[]
  ).map(toMemory);
}

export function addMemories(
  legacyId: string,
  items: { title: string; content: string; era?: string; tags?: string[]; sourceTurnId?: string | null }[],
): void {
  const stmt = db().prepare(
    `INSERT INTO memories (id, legacy_id, title, content, era, tags_json, source_turn_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  db().transaction(() => {
    for (const m of items) {
      stmt.run(
        randomUUID(),
        legacyId,
        m.title,
        m.content,
        m.era ?? "",
        JSON.stringify(m.tags ?? []),
        m.sourceTurnId ?? null,
        now(),
      );
    }
  })();
}

export function deleteMemory(legacyId: string, memoryId: string): void {
  db().prepare(`DELETE FROM memories WHERE id = ? AND legacy_id = ?`).run(memoryId, legacyId);
}

/* ---------- chat ---------- */

export function listChat(legacyId: string, limit = 200): ChatMessage[] {
  return (
    db()
      .prepare(
        `SELECT * FROM (SELECT * FROM chat_messages WHERE legacy_id = ? ORDER BY created_at DESC LIMIT ?)
         ORDER BY created_at ASC`,
      )
      .all(legacyId, limit) as Row[]
  ).map(toChat);
}

export function addChat(
  legacyId: string,
  role: "user" | "assistant",
  content: string,
  speaker: string | null,
): ChatMessage {
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO chat_messages (id, legacy_id, role, speaker, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, legacyId, role, speaker, content, now());
  return toChat(db().prepare(`SELECT * FROM chat_messages WHERE id = ?`).get(id) as Row);
}

export function clearChat(legacyId: string): void {
  db().prepare(`DELETE FROM chat_messages WHERE legacy_id = ?`).run(legacyId);
}
