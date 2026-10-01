import "server-only";

import { NextRequest, NextResponse } from "next/server";
import type { StudioProject } from "@/lib/domain/schemas";
import { markProjectFailed } from "@/lib/domain/project";
import { attachGuestCookie, guestSession } from "@/lib/server/session";
import { getOwnedProject, idempotentResponse, saveOwnedProject, storeIdempotentResponse } from "@/lib/server/repository";

export function jsonFor(request: NextRequest, body: unknown, init?: ResponseInit) {
  return attachGuestCookie(NextResponse.json(body, init), guestSession(request));
}

export async function ownedProject(request: NextRequest, id: string) {
  const session = guestSession(request);
  const project = await getOwnedProject(session.tokenHash, id);
  return { session, project };
}

export async function mutateProject(
  request: NextRequest,
  id: string,
  operation: string,
  action: (project: StudioProject) => StudioProject | Promise<StudioProject>,
  options: { persistFailure?: boolean; failureRequest?: string } = {},
) {
  const session = guestSession(request);
  const key = request.headers.get("idempotency-key");
  if (!key || key.length > 128) return attachGuestCookie(NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 }), session);
  const project = await getOwnedProject(session.tokenHash, id);
  if (!project) return attachGuestCookie(NextResponse.json({ error: "Project not found." }, { status: 404 }), session);
  const replay = await idempotentResponse(id, key);
  if (replay) return attachGuestCookie(NextResponse.json(replay, { headers: { "Idempotency-Replayed": "true" } }), session);
  try {
    const next = await action(project);
    const saved = await saveOwnedProject(session.tokenHash, next);
    const response = { project: saved };
    await storeIdempotentResponse(id, key, operation, response);
    return attachGuestCookie(NextResponse.json(response), session);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Operation failed.";
    let failed: StudioProject | null = null;
    if (options.persistFailure) {
      const failedProject = markProjectFailed(project, operation as "analyze" | "build" | "revise", errorMessage, options.failureRequest ?? null);
      failed = await saveOwnedProject(session.tokenHash, failedProject);
    }
    return attachGuestCookie(NextResponse.json({ error: errorMessage, project: failed }, { status: 422 }), session);
  }
}
