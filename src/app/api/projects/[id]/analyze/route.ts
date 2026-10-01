import { NextRequest } from "next/server";
import { z } from "zod";
import { analyzeProject, answerClarification } from "@/lib/demo/engine";
import { mutateProject } from "@/lib/server/api";
import { analyzeWithOpenAI, openAIConfigured } from "@/lib/server/openai";
import { WORKERS } from "@/lib/domain/workers";

const bodySchema = z.object({ prompt: z.string().trim().min(1).max(6000), correcting: z.boolean().optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A prompt is required." }, { status: 400 });
  return mutateProject(request, id, "analyze", async (project) => {
    if (parsed.data.correcting && project.approvedPlan) throw new Error("An approved project must be revised rather than reinterpreted.");
    const baseline = project.stage === "CLARIFYING" ? answerClarification(project, parsed.data.prompt) : analyzeProject(project, parsed.data.prompt);
    if (!openAIConfigured() || baseline.stage === "CLARIFYING") return baseline;
    const generated = await analyzeWithOpenAI(baseline.currentPrompt ?? parsed.data.prompt);
    const generatedById = new Map(generated.recommendations.map((item) => [item.workerId, item]));
    const recommendations = WORKERS.map((worker) => {
      const recommendation = generatedById.get(worker.id);
      return recommendation ? { ...recommendation, contribution: worker.contribution, mode: worker.mode } : {
        workerId: worker.id, contribution: worker.contribution,
        reason: `${worker.name} is available if this project needs ${worker.contribution.toLowerCase()}`,
        selected: false, mode: worker.mode,
      };
    });
    const events = [...baseline.events];
    const recommendationEvent = events.findLastIndex((event) => event.name === "worker_recommendation_shown");
    if (recommendationEvent >= 0) events[recommendationEvent] = {
      ...events[recommendationEvent],
      properties: {
        projectId: project.id,
        workerIds: recommendations.filter((item) => item.selected).map((item) => item.workerId),
        reasons: recommendations.filter((item) => item.selected).map((item) => item.reason),
      },
    };
    return { ...baseline, interpretation: generated.interpretation, recommendations, events };
  }, { persistFailure: true, failureRequest: parsed.data.prompt });
}
