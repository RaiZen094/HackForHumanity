import { NextRequest } from "next/server";
import { z } from "zod";
import { detectExplicitExpansion, reviseProject } from "@/lib/demo/engine";
import { pageSpecSchema, type PageSpec } from "@/lib/domain/schemas";
import { mutateProject } from "@/lib/server/api";
import { openAIConfigured, planRevisionWithOpenAI, revisePageWithOpenAI } from "@/lib/server/openai";
import { enforceAccessibleTheme } from "@/lib/domain/page-safety";

const bodySchema = z.object({ request: z.string().trim().min(1).max(4000), confirmed: z.boolean().optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A revision request is required." }, { status: 400 });
  return mutateProject(request, id, "revise", async (project) => {
    if (/^remove\b/i.test(parsed.data.request.trim())) return reviseProject(project, parsed.data.request, { confirmed: parsed.data.confirmed, expansionWorker: null }).project;
    const approved = new Set(project.approvedPlan?.workers.map((worker) => worker.workerId) ?? []);
    const explicitWorker = detectExplicitExpansion(parsed.data.request, project);
    const plan = !explicitWorker && openAIConfigured() ? await planRevisionWithOpenAI(JSON.stringify({ participantRequest: parsed.data.request, currentPage: project.pageSpec, approvedWorkerIds: [...approved], workerRule: "Only require a worker for a genuinely new executable capability, never for copy that merely mentions a capability." })) : null;
    const requiredWorker = explicitWorker ?? (plan?.requiresWorkerId && !approved.has(plan.requiresWorkerId) ? plan.requiresWorkerId : null);
    const outcome = reviseProject(project, parsed.data.request, {
      confirmed: parsed.data.confirmed,
      expansionWorker: plan ? requiredWorker : undefined,
      clarificationQuestion: !explicitWorker && plan?.clarificationRequired ? plan.clarificationQuestion : null,
      destructive: plan?.destructive,
    });
    if (outcome.type !== "applied" || !openAIConfigured() || !project.pageSpec || !project.approvedPlan) return outcome.project;
    const revised = await revisePageWithOpenAI(JSON.stringify({
      participantRequest: parsed.data.request,
      currentPage: project.pageSpec,
      interpretation: project.interpretation,
      approvedWorkerIds: project.approvedPlan.workers.map((worker) => worker.workerId),
    }));
    const allowed = new Set(project.approvedPlan.workers.map((worker) => worker.workerId));
    const sections = revised.sections.reduce<PageSpec["sections"]>((result, section) => {
      if (section.type === "support-form") {
        if (allowed.has(section.requiredWorkerId)) result.push(section);
        return result;
      }
      if (section.type === "feature-grid") {
        const features = section.features.filter((feature) => allowed.has(feature.requiredWorkerId)).map((feature) => ({ ...feature, supportingWorkerIds: feature.supportingWorkerIds.filter((workerId) => allowed.has(workerId)) }));
        if (features.length) result.push({ ...section, features });
        return result;
      }
      result.push(section);
      return result;
    }, []);
    const pageSpec = enforceAccessibleTheme(pageSpecSchema.parse({ ...revised, sections, approvedWorkerIds: [...allowed], media: revised.media.length ? revised.media : project.pageSpec.media }));
    const changes: string[] = [];
    if (project.pageSpec.hero.headline !== pageSpec.hero.headline) changes.push("updated the headline");
    if (project.pageSpec.hero.subheadline !== pageSpec.hero.subheadline) changes.push("updated the supporting message");
    if (JSON.stringify(project.pageSpec.theme) !== JSON.stringify(pageSpec.theme)) changes.push("changed the visual theme");
    if (project.pageSpec.sections.map((item) => item.id).join() !== pageSpec.sections.map((item) => item.id).join()) changes.push("reorganized the page sections");
    if (JSON.stringify(project.pageSpec.sections) !== JSON.stringify(pageSpec.sections) && !changes.includes("reorganized the page sections")) changes.push("updated the solution features and content");
    const summary = changes.length ? `Applied the request: ${changes.join(", ")}.` : "Applied the requested page refinement.";
    const messages = [...outcome.project.messages];
    const lastAssistant = messages.findLastIndex((item) => item.role === "assistant" && item.kind === "revision");
    if (lastAssistant >= 0) messages[lastAssistant] = { ...messages[lastAssistant], content: summary };
    return { ...outcome.project, pageSpec, messages };
  }, { persistFailure: true, failureRequest: parsed.data.request });
}
