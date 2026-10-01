import { NextRequest, NextResponse } from "next/server";
import { attachGuestCookie, guestSession } from "@/lib/server/session";
import { getOwnedProject } from "@/lib/server/repository";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = guestSession(request);
  try {
    const project = await getOwnedProject(session.tokenHash, id);
    return attachGuestCookie(NextResponse.json(project ? { project } : { error: "Project not found." }, { status: project ? 200 : 404 }), session);
  } catch { return attachGuestCookie(NextResponse.json({ error: "Database connection is unavailable." }, { status: 503 }), session); }
}
