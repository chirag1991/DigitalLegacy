import { NextResponse } from "next/server";
import { createLegacy, listLegacies } from "@/lib/db";
import { cleanText, handle, HttpError, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => NextResponse.json({ legacies: listLegacies() }));

export const POST = handle(async (req: Request) => {
  const body = await readJson<{ name?: unknown; birthYear?: unknown; intro?: unknown }>(req);
  const name = cleanText(body.name, 120);
  if (!name) throw new HttpError(400, "Please enter a name.");

  const year = Number(body.birthYear);
  const birthYear = Number.isInteger(year) && year > 1890 && year <= new Date().getFullYear() ? year : null;

  const legacy = createLegacy({ name, birthYear, intro: cleanText(body.intro, 2000) });
  return NextResponse.json({ legacy }, { status: 201 });
});
