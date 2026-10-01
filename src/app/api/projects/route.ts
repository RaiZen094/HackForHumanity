import { NextRequest, NextResponse } from "next/server";
import { attachGuestCookie, guestSession } from "@/lib/server/session";
import { createOwnedProject, listOwnedProjects, storeIdempotentResponse } from "@/lib/server/repository";

export async function GET(request: NextRequest) {
  const session = guestSession(request);
  try { return attachGuestCookie(NextResponse.json({ projects: await listOwnedProjects(session.tokenHash) }), session); }
  catch (error) {
    console.error("Worker Studio project list failed:", error instanceof Error ? error.message : "Unknown database error");
    return attachGuestCookie(NextResponse.json({ error: "Database connection is unavailable." }, { status: 503 }), session);
  }
}

export async function POST(request: NextRequest) {
  const session = guestSession(request);
  const key = request.headers.get("idempotency-key");
  if (!key || key.length > 128) return attachGuestCookie(NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 }), session);
  try {
    const project = await createOwnedProject(session.tokenHash);
    const response = { project };
    await storeIdempotentResponse(project.id, key, "create_project", response);
    return attachGuestCookie(NextResponse.json(response, { status: 201 }), session);
  } catch (error) {
    console.error("Worker Studio project creation failed:", error instanceof Error ? error.message : "Unknown database error");
    return attachGuestCookie(NextResponse.json({ error: "Database connection is unavailable." }, { status: 503 }), session);
  }
}
