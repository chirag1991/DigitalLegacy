import { NextResponse } from "next/server";
import { nextInterviewQuestion } from "@/lib/ai";
import { answerTurn, clearPendingTurns, createTurn, getTurn, listTurns, skipTurn, touchLegacy } from "@/lib/db";
import { cleanText, handle, HttpError, readJson, requireLegacy, type RouteCtx } from "@/lib/http";
import { getTopic, TOPICS } from "@/lib/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Interview state: topics with progress, the full transcript, and any question waiting for an answer. */
export const GET = handle(async (_req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  const turns = listTurns(legacy.id);
  const topics = TOPICS.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    answered: turns.filter((x) => x.topic === t.id && x.answer).length,
  }));
  const pending = turns.find((t) => !t.answer && !t.skipped) ?? null;
  return NextResponse.json({ topics, turns: turns.filter((t) => t.answer), pending });
});

/**
 * Actions:
 *  - { action: "next", topic }                        → ask a new question on a topic
 *  - { action: "answer", turnId, answer, topic? }     → save the answer, then ask the next question
 *  - { action: "skip", turnId, topic? }               → skip, then ask the next question
 *  - { action: "edit", turnId, answer }               → change a previous answer (no new question)
 */
export const POST = handle(async (req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  const body = await readJson<{ action?: string; topic?: string; turnId?: string; answer?: unknown }>(req);

  const ownTurn = (id?: string) => {
    const turn = id ? getTurn(id) : null;
    if (!turn || turn.legacyId !== legacy.id) throw new HttpError(404, "Question not found.");
    return turn;
  };

  let topicId = body.topic;

  switch (body.action) {
    case "answer": {
      const turn = ownTurn(body.turnId);
      const answer = cleanText(body.answer, 20000);
      if (!answer) throw new HttpError(400, "The answer is empty.");
      answerTurn(turn.id, answer);
      topicId ??= turn.topic;
      break;
    }
    case "skip": {
      const turn = ownTurn(body.turnId);
      skipTurn(turn.id);
      topicId ??= turn.topic;
      break;
    }
    case "edit": {
      const turn = ownTurn(body.turnId);
      const answer = cleanText(body.answer, 20000);
      if (!answer) throw new HttpError(400, "The answer is empty.");
      answerTurn(turn.id, answer);
      touchLegacy(legacy.id);
      return NextResponse.json({ ok: true });
    }
    case "next":
      break;
    default:
      throw new HttpError(400, "Unknown action.");
  }

  const topic = getTopic(topicId ?? "");
  if (!topic) throw new HttpError(400, "Unknown topic.");

  clearPendingTurns(legacy.id);
  const question = await nextInterviewQuestion(legacy, topic, listTurns(legacy.id));
  const pending = createTurn(legacy.id, topic.id, question);
  touchLegacy(legacy.id);
  return NextResponse.json({ pending });
});
