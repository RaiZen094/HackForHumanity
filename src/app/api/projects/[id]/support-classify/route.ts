import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { attachGuestCookie, guestSession } from "@/lib/server/session";
import { createWorkerRun, getOwnedProject, idempotentResponse, storeIdempotentResponse } from "@/lib/server/repository";
import { runWorkerWithOpenAI } from "@/lib/server/worker-openai";

const bodySchema = z.object({ question: z.string().trim().min(1).max(2000) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = guestSession(request);
  const key = request.headers.get("idempotency-key");
  if (!key || key.length > 128) return attachGuestCookie(NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 }), session);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return attachGuestCookie(NextResponse.json({ error: "A support question is required." }, { status: 400 }), session);
  const project = await getOwnedProject(session.tokenHash, id);
  if (!project?.approvedPlan?.workers.some((item) => item.workerId === "customer-service-executive")) return attachGuestCookie(NextResponse.json({ error: "Customer Service Executive is not approved for this project." }, { status: 403 }), session);
  const replay = await idempotentResponse(id, key);
  if (replay) return attachGuestCookie(NextResponse.json(replay, { headers: { "Idempotency-Replayed": "true" } }), session);
  try {
    const result = await runWorkerWithOpenAI("customer-service-executive", parsed.data.question, project);
    await createWorkerRun(id, "customer-service-executive", parsed.data.question, result);
    const response = { classification: { category: result.category, priority: result.priority, route: result.route, draftedAnswer: result.draftedAnswer, externalTicketCreated: false } };
    await storeIdempotentResponse(id, key, "support_classify", response);
    return attachGuestCookie(NextResponse.json(response), session);
  } catch (error) {
    return attachGuestCookie(NextResponse.json({ error: error instanceof Error ? error.message : "Support classification failed." }, { status: 422 }), session);
  }
}
