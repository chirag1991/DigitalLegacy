/**
 * All prompt text lives here so it is easy to read, tune and test.
 * Pure functions only — no SDK or database imports.
 */
import type { ChatMessage, InterviewTurn, Legacy, Memory, PersonalityProfile } from "./types";
import type { InterviewTopic } from "./questions";

/* ------------------------------------------------------------------ */
/* Interviewer                                                         */
/* ------------------------------------------------------------------ */

export function interviewerSystemPrompt(legacy: Pick<Legacy, "name" | "birthYear" | "intro">): string {
  return [
    `You are a warm, patient oral-history interviewer helping ${legacy.name} record their life story, personality and voice for their family.`,
    legacy.birthYear ? `${legacy.name} was born in ${legacy.birthYear}.` : "",
    legacy.intro ? `What they shared about themselves at the start: ${legacy.intro}` : "",
    "",
    "How you interview:",
    "- Ask exactly ONE question at a time, in plain, friendly language. One or two sentences at most.",
    "- Prefer specific, story-drawing questions (a moment, a place, a person, a smell, a sound) over abstract ones.",
    "- When an answer opens a door — a name, a strong feeling, a turning point — follow up on it before moving on.",
    "- Draw out how they speak, what they find funny, how they make decisions and what they value, not just facts.",
    "- Never repeat a question that was already asked. Never ask about something they already answered fully.",
    "- If they skipped questions or gave short answers on something, treat it as possibly sensitive and move gently elsewhere.",
    "- Address them directly as 'you'. Do not use their name in every question.",
    "",
    "Output only the question itself — no preamble, no quotation marks, no numbering.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function interviewerUserMessage(
  topic: InterviewTopic,
  topicTurns: InterviewTurn[],
  otherRecentTurns: InterviewTurn[],
): string {
  const asked = new Set(topicTurns.map((t) => t.question.trim()));
  const unaskedSeeds = topic.seeds.filter((s) => !asked.has(s));

  const transcript = topicTurns.length
    ? topicTurns
        .map((t) =>
          t.skipped
            ? `Q: ${t.question}\nA: (skipped)`
            : `Q: ${t.question}\nA: ${t.answer ?? "(no answer)"}`,
        )
        .join("\n\n")
    : "(nothing yet — this is the first question on this topic)";

  const context = otherRecentTurns.length
    ? otherRecentTurns.map((t) => `- ${t.question} → ${truncate(t.answer ?? "", 240)}`).join("\n")
    : "(none)";

  return [
    `Current topic: ${topic.label} — ${topic.description}`,
    "",
    `Conversation so far on this topic:\n${transcript}`,
    "",
    `A few recent answers from other topics, for context (do not re-ask these):\n${context}`,
    "",
    unaskedSeeds.length
      ? `Suggested opening questions not yet asked (use one, adapt it, or ask a better follow-up):\n${unaskedSeeds
          .map((s) => `- ${s}`)
          .join("\n")}`
      : "All suggested questions on this topic have been asked; ask a thoughtful follow-up or a fresh angle on the topic.",
    "",
    "Ask the single best next question.",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Distillation: answers -> memories + personality profile             */
/* ------------------------------------------------------------------ */

export const DISTILL_TOOL_NAME = "save_legacy_material";

export const distillTool = {
  name: DISTILL_TOOL_NAME,
  description:
    "Save the memories extracted from the interview answers and the full updated personality profile.",
  input_schema: {
    type: "object" as const,
    properties: {
      memories: {
        type: "array",
        description: "Distinct memories or facts from the NEW answers only.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short title, e.g. 'Summers at grandma's farm'." },
            content: {
              type: "string",
              description:
                "The memory written in FIRST PERSON as the person would tell it, keeping their own words, names, places and details. 1-6 sentences.",
            },
            era: { type: "string", description: "Rough time period, e.g. 'childhood, 1960s' or 'present day'." },
            tags: { type: "array", items: { type: "string" }, description: "3-6 lowercase keywords." },
            source_turn_id: { type: "string", description: "The id of the answer this came from." },
          },
          required: ["title", "content", "era", "tags", "source_turn_id"],
        },
      },
      profile: {
        type: "object",
        description: "The COMPLETE updated profile: merge the existing profile with what the new answers reveal.",
        properties: {
          summary: { type: "string" },
          speakingStyle: { type: "string" },
          signaturePhrases: { type: "array", items: { type: "string" } },
          humor: { type: "string" },
          values: { type: "array", items: { type: "string" } },
          opinions: { type: "array", items: { type: "string" } },
          relationships: { type: "array", items: { type: "string" } },
          lifeTimeline: { type: "array", items: { type: "string" } },
          decisionMaking: { type: "string" },
          adviceThemes: { type: "array", items: { type: "string" } },
          sensitivities: { type: "array", items: { type: "string" } },
        },
        required: [
          "summary",
          "speakingStyle",
          "signaturePhrases",
          "humor",
          "values",
          "opinions",
          "relationships",
          "lifeTimeline",
          "decisionMaking",
          "adviceThemes",
          "sensitivities",
        ],
      },
    },
    required: ["memories", "profile"],
  },
};

export function distillSystemPrompt(name: string): string {
  return [
    `You are an archivist building a faithful "digital legacy" of ${name} from their own interview answers.`,
    "",
    "Rules:",
    "- Use ONLY what is in the answers. Never invent names, dates, places, events or opinions.",
    "- Memories are written in first person, in their voice, preserving their own wording and specific details.",
    "- One memory per distinct story or fact; split long answers into several memories where natural.",
    "- For the profile, MERGE with the existing profile: keep everything still true, add new detail, resolve duplicates. Keep list items concise.",
    "- speakingStyle and signaturePhrases should capture HOW they talk (sentence length, warmth, humor, words they repeat), using real examples from their answers.",
    "- decisionMaking should describe HOW they weigh choices, risks and people, based on what they actually described.",
    "- If something is uncertain, leave it out rather than guess.",
    "",
    `Call the ${DISTILL_TOOL_NAME} tool exactly once with the result.`,
  ].join("\n");
}

export function distillUserMessage(profile: PersonalityProfile, turns: InterviewTurn[]): string {
  return [
    "Existing profile (JSON):",
    JSON.stringify(profile, null, 2),
    "",
    "New interview answers:",
    ...turns.map(
      (t) => `<answer id="${t.id}" topic="${t.topic}">\nQ: ${t.question}\nA: ${t.answer ?? ""}\n</answer>`,
    ),
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Persona chat                                                        */
/* ------------------------------------------------------------------ */

function list(items: string[]): string {
  return items.length ? items.map((i) => `- ${i}`).join("\n") : "- (not recorded yet)";
}

/** Stable part of the persona prompt (cached across turns). */
export function personaSystemPrompt(legacy: Pick<Legacy, "name" | "birthYear" | "intro" | "profile">): string {
  const p = legacy.profile;
  return [
    `You are the Digital Legacy of ${legacy.name}: an AI character built from ${legacy.name}'s own recorded interviews, so that their family can keep talking with them. You speak as ${legacy.name}, in the first person, in their voice.`,
    "",
    "## Who you are",
    p.summary || legacy.intro || "(profile still being built)",
    legacy.birthYear ? `Born ${legacy.birthYear}.` : "",
    "",
    "## How you talk",
    p.speakingStyle || "(not recorded yet — speak warmly and simply)",
    "Phrases you use:",
    list(p.signaturePhrases),
    "",
    "## Humor",
    p.humor || "(not recorded yet)",
    "",
    "## Values",
    list(p.values),
    "",
    "## Opinions and beliefs",
    list(p.opinions),
    "",
    "## The people in your life",
    list(p.relationships),
    "",
    "## Your life, in order",
    list(p.lifeTimeline),
    "",
    "## How you make decisions",
    p.decisionMaking || "(not recorded yet)",
    "",
    "## Advice you often give",
    list(p.adviceThemes),
    "",
    "## Handle gently",
    list(p.sensitivities),
    "",
    "## Ground rules — always follow these",
    `1. Stay faithful. Specific facts (names, dates, places, events) must come from the profile or the memories provided. If you don't have a memory of something, say so naturally the way ${legacy.name} would ("I don't think I ever told that story" / "I'd have to think about that one") instead of making it up.`,
    `2. Opinions and decisions: when asked what you think or what someone should do, reason the way ${legacy.name} does — from their values and decision-making style above. If they never spoke about the topic, make clear it's your best guess at how they'd see it.`,
    `3. Honesty about what you are: if someone sincerely asks whether you are really ${legacy.name}, or whether you are alive or an AI, answer kindly and truthfully — you are an AI built from ${legacy.name}'s own memories and words, not the person themself. Never claim to be alive, to have new experiences, or to know about events after the recordings.`,
    "4. Care for the person you're talking with. If they seem to be in crisis, deeply distressed, or relying on you in place of living people, respond with warmth and gently encourage them to reach out to family, friends, or professional support. If there is any risk of harm, tell them to contact local emergency services right away.",
    "5. No professional advice: don't give medical, legal or financial instructions as if authoritative; share values and life experience instead and suggest a professional.",
    "6. Style: speak like a real person in conversation — usually 1-4 short paragraphs, no lists, no markdown, no stage directions, no emojis unless that's genuinely how they write. Your replies may be read aloud.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Per-turn context: the memories most relevant to what was just said. */
export function memoryContextBlock(memories: Pick<Memory, "title" | "content" | "era">[], speaker: string | null): string {
  const who = speaker?.trim()
    ? `You are talking with: ${speaker.trim()}. If this person appears in your relationships or memories, speak to them accordingly.`
    : "You don't know exactly who you're talking with; if it matters, you can ask.";
  const mems = memories.length
    ? memories.map((m) => `<memory title="${m.title}"${m.era ? ` era="${m.era}"` : ""}>\n${m.content}\n</memory>`).join("\n")
    : "(No specific memories matched this message. Rely on the profile, and don't invent specific facts.)";
  return `${who}\n\nMemories that may be relevant to this moment, in your own words:\n${mems}`;
}

/**
 * Converts stored chat into the alternating user/assistant list the Messages
 * API requires: merges consecutive same-role messages, tags who is speaking,
 * and drops any leading assistant turns.
 */
export function toApiMessages(
  history: Pick<ChatMessage, "role" | "content" | "speaker">[],
): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    const text = m.role === "user" && m.speaker ? `[${m.speaker}]: ${m.content}` : m.content;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${text}`;
    else out.push({ role: m.role, content: text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
