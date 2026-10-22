import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { rankDocuments, type RetrievalDoc } from "./retrieval";
import {
  DISTILL_TOOL_NAME,
  distillSystemPrompt,
  distillTool,
  distillUserMessage,
  interviewerSystemPrompt,
  interviewerUserMessage,
  memoryContextBlock,
  personaSystemPrompt,
  toApiMessages,
} from "./prompts";
import type { InterviewTopic } from "./questions";
import { EMPTY_PROFILE, type ChatMessage, type InterviewTurn, type Legacy, type Memory, type PersonalityProfile } from "./types";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ConfigError("ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the server.");
  }
  client ??= new Anthropic();
  return client;
}

export class ConfigError extends Error {}

/* ---------- interview ---------- */

export async function nextInterviewQuestion(
  legacy: Legacy,
  topic: InterviewTopic,
  allTurns: InterviewTurn[],
): Promise<string> {
  const topicTurns = allTurns.filter((t) => t.topic === topic.id && (t.answer || t.skipped));
  const otherRecent = allTurns
    .filter((t) => t.topic !== topic.id && t.answer)
    .slice(-6);

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: interviewerSystemPrompt(legacy),
    messages: [{ role: "user", content: interviewerUserMessage(topic, topicTurns.slice(-12), otherRecent) }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim()
    .replace(/^["“]|["”]$/g, "");

  // Fall back to a seed question if the model returned nothing usable.
  if (!text) {
    const asked = new Set(topicTurns.map((t) => t.question));
    return topic.seeds.find((s) => !asked.has(s)) ?? `What else would you like your family to know about ${topic.label.toLowerCase()}?`;
  }
  return text;
}

/* ---------- distillation ---------- */

export interface DistillResult {
  memories: { title: string; content: string; era: string; tags: string[]; sourceTurnId: string | null }[];
  profile: PersonalityProfile;
}

export async function distillAnswers(legacy: Legacy, turns: InterviewTurn[]): Promise<DistillResult> {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: distillSystemPrompt(legacy.name),
    tools: [distillTool],
    tool_choice: { type: "tool", name: DISTILL_TOOL_NAME },
    messages: [{ role: "user", content: distillUserMessage(legacy.profile, turns) }],
  });

  const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!call) throw new Error("The model did not return any material to save. Please try again.");

  const input = call.input as {
    memories?: { title?: string; content?: string; era?: string; tags?: string[]; source_turn_id?: string }[];
    profile?: Partial<PersonalityProfile>;
  };
  const validTurnIds = new Set(turns.map((t) => t.id));

  return {
    memories: (input.memories ?? [])
      .filter((m) => m.title && m.content)
      .map((m) => ({
        title: String(m.title).slice(0, 200),
        content: String(m.content),
        era: String(m.era ?? ""),
        tags: Array.isArray(m.tags) ? m.tags.map(String).slice(0, 8) : [],
        sourceTurnId: m.source_turn_id && validTurnIds.has(m.source_turn_id) ? m.source_turn_id : null,
      })),
    profile: sanitizeProfile({ ...legacy.profile, ...(input.profile ?? {}) }),
  };
}

function sanitizeProfile(p: Partial<PersonalityProfile>): PersonalityProfile {
  const out: Record<string, string | string[]> = {};
  for (const key of Object.keys(EMPTY_PROFILE) as (keyof PersonalityProfile)[]) {
    const v: unknown = p[key];
    if (Array.isArray(EMPTY_PROFILE[key])) {
      out[key] = Array.isArray(v) ? v.map(String).filter(Boolean) : [];
    } else {
      out[key] = typeof v === "string" ? v : "";
    }
  }
  return out as unknown as PersonalityProfile;
}

/* ---------- persona chat ---------- */

export function findRelevantMemories(
  query: string,
  memories: Memory[],
  rawTurns: InterviewTurn[],
  limit = 8,
): Pick<Memory, "title" | "content" | "era">[] {
  const docs: (RetrievalDoc & { mem: Pick<Memory, "title" | "content" | "era"> })[] = [
    ...memories.map((m) => ({
      id: m.id,
      text: `${m.title} ${m.content} ${m.tags.join(" ")} ${m.era}`,
      weight: 1.2,
      mem: m,
    })),
    // Answers not distilled yet are still searchable, so new material works right away.
    ...rawTurns
      .filter((t) => t.answer && !t.distilled)
      .map((t) => ({
        id: t.id,
        text: `${t.question} ${t.answer}`,
        weight: 1,
        mem: { title: t.question, content: t.answer ?? "", era: "" },
      })),
  ];
  return rankDocuments(query, docs, limit).map((r) => (r.doc as (typeof docs)[number]).mem);
}

export function streamPersonaReply(args: {
  legacy: Legacy;
  history: ChatMessage[];
  relevant: Pick<Memory, "title" | "content" | "era">[];
  speaker: string | null;
}) {
  return anthropic().messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: [
      { type: "text", text: personaSystemPrompt(args.legacy), cache_control: { type: "ephemeral" } },
      { type: "text", text: memoryContextBlock(args.relevant, args.speaker) },
    ],
    messages: toApiMessages(args.history.slice(-30)),
  });
}
