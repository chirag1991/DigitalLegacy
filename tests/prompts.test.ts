import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interviewerUserMessage,
  memoryContextBlock,
  personaSystemPrompt,
  toApiMessages,
} from "../src/lib/prompts.ts";

const profile = {
  summary: "A retired teacher who loves gardening.",
  speakingStyle: "Warm, short sentences, gentle teasing.",
  signaturePhrases: ["Well, isn't that something"],
  humor: "Dry",
  values: ["Honesty"],
  opinions: [],
  relationships: ["Maya — granddaughter"],
  lifeTimeline: [],
  decisionMaking: "Sleeps on big decisions.",
  adviceThemes: [],
  sensitivities: [],
};

test("persona prompt includes identity, profile and honesty rule", () => {
  const p = personaSystemPrompt({ name: "Rosa", birthYear: 1948, intro: "", profile });
  assert.match(p, /Digital Legacy of Rosa/);
  assert.match(p, /Well, isn't that something/);
  assert.match(p, /Sleeps on big decisions/);
  assert.match(p, /you are an AI built from Rosa's own memories/);
  assert.match(p, /\(not recorded yet\)/); // empty sections are labelled, not invented
});

test("memory block names the speaker and lists memories", () => {
  const b = memoryContextBlock([{ title: "The garden", content: "I grew tomatoes.", era: "1990s" }], "Maya");
  assert.match(b, /talking with: Maya/);
  assert.match(b, /<memory title="The garden" era="1990s">/);
  assert.match(memoryContextBlock([], null), /No specific memories matched/);
});

test("interviewer message skips seeds already asked", () => {
  const topic = { id: "t", label: "Topic", description: "d", seeds: ["Seed one?", "Seed two?"] };
  const turn = {
    id: "1", legacyId: "l", topic: "t", question: "Seed one?", answer: "Yes",
    skipped: false, distilled: false, createdAt: "",
  };
  const msg = interviewerUserMessage(topic, [turn], []);
  assert.match(msg, /- Seed two\?/);
  assert.doesNotMatch(msg, /- Seed one\?/);
});

test("toApiMessages merges roles, tags speakers and starts with user", () => {
  const out = toApiMessages([
    { role: "assistant", content: "orphan", speaker: null },
    { role: "user", content: "Hi", speaker: "Maya" },
    { role: "user", content: "Are you there?", speaker: "Maya" },
    { role: "assistant", content: "Hello, love.", speaker: null },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].role, "user");
  assert.equal(out[0].content, "[Maya]: Hi\n\n[Maya]: Are you there?");
  assert.equal(out[1].role, "assistant");
});
