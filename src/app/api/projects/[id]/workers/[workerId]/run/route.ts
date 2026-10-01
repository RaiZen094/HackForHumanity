import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { workerIdSchema } from "@/lib/domain/schemas";
import { attachGuestCookie, guestSession } from "@/lib/server/session";
import { createWorkerRun, getOwnedProject, idempotentResponse, storeIdempotentResponse } from "@/lib/server/repository";
import { runWorkerWithOpenAI } from "@/lib/server/worker-openai";

const bodySchema = z.object({ input: z.string().trim().min(2).max(6000) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; workerId: string }> }) {
  const { id, workerId: rawWorkerId } = await params;
  const session = guestSession(request);
  const workerId = workerIdSchema.safeParse(rawWorkerId);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  const key = request.headers.get("idempotency-key");
  if (!key || key.length > 128) return attachGuestCookie(NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 }), session);
  if (!workerId.success || !body.success) return attachGuestCookie(NextResponse.json({ error: "A valid worker and input are required." }, { status: 400 }), session);
  const project = await getOwnedProject(session.tokenHash, id);
  if (!project) return attachGuestCookie(NextResponse.json({ error: "Project not found." }, { status: 404 }), session);
  if (!project.approvedPlan?.workers.some((worker) => worker.workerId === workerId.data)) return attachGuestCookie(NextResponse.json({ error: "This worker is not approved for the project." }, { status: 403 }), session);
  const replay = await idempotentResponse(id, key);
  if (replay) return attachGuestCookie(NextResponse.json(replay, { headers: { "Idempotency-Replayed": "true" } }), session);
  try {
    const result = await runWorkerWithOpenAI(workerId.data, body.data.input, project);
    const artifact = await createWorkerRun(id, workerId.data, body.data.input, result);
    const response = { artifact };
    await storeIdempotentResponse(id, key, `run_${workerId.data}`, response);
    return attachGuestCookie(NextResponse.json(response), session);
  } catch (error) {
    return attachGuestCookie(NextResponse.json({ error: error instanceof Error ? error.message : "Worker run failed." }, { status: 422 }), session);
  }
}
