import "server-only";
import { NextResponse } from "next/server";
import { ConfigError } from "./ai";
import { getLegacy } from "./db";
import type { Legacy } from "./types";

export type RouteCtx = { params: Promise<{ id: string }> };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireLegacy(ctx: RouteCtx): Promise<Legacy> {
  const { id } = await ctx.params;
  const legacy = getLegacy(id);
  if (!legacy) throw new HttpError(404, "Legacy not found.");
  return legacy;
}

/** Wraps a route handler so thrown errors become clean JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ConfigError) return NextResponse.json({ error: err.message }, { status: 503 });
      console.error(err);
      const message = err instanceof Error ? err.message : "Something went wrong.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}

export function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
