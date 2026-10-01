import { NextRequest, NextResponse } from "next/server";
import { attachGuestCookie, guestSession } from "@/lib/server/session";
import { listWorkerRuns } from "@/lib/server/repository";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = guestSession(request);
  const artifacts = await listWorkerRuns(session.tokenHash, id);
  return attachGuestCookie(NextResponse.json(artifacts ? { artifacts } : { error: "Project not found." }, { status: artifacts ? 200 : 404 }), session);
}
