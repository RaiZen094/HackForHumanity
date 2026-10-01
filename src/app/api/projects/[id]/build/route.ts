import { NextRequest } from "next/server";
import { assertProjectInvariant } from "@/lib/domain/project";
import { buildProject } from "@/lib/demo/engine";
import { pageSpecSchema, type PageSpec } from "@/lib/domain/schemas";
import { mutateProject } from "@/lib/server/api";
import { buildWithOpenAI, openAIConfigured } from "@/lib/server/openai";
import { workerById } from "@/lib/domain/workers";
import { enforceAccessibleTheme } from "@/lib/domain/page-safety";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return mutateProject(request, id, "build", async (project) => {
    const baseline = buildProject(project);
    if (!openAIConfigured() || !project.approvedPlan) return baseline;
    const pageSpec = await buildWithOpenAI(JSON.stringify({ problem: project.approvedPlan.prompt, interpretation: project.approvedPlan.interpretation, approvedWorkers: project.approvedPlan.workers }));
    const allowed = new Set(project.approvedPlan.workers.map((item) => item.workerId));
    const sections = pageSpec.sections.reduce<PageSpec["sections"]>((result, section) => {
      if (section.type === "support-form") {
        if (allowed.has("customer-service-executive")) result.push(section);
        return result;
      }
      if (section.type !== "feature-grid") { result.push(section); return result; }
      const features = section.features.filter((feature) => allowed.has(feature.requiredWorkerId)).map((feature) => ({
        ...feature,
        mode: workerById(feature.requiredWorkerId).mode,
        supportingWorkerIds: feature.supportingWorkerIds.filter((workerId) => allowed.has(workerId)),
      }));
      if (features.length) result.push({ ...section, features });
      return result;
    }, []);
    const normalizedPage = enforceAccessibleTheme(pageSpecSchema.parse({
      ...pageSpec,
      sections: sections.length ? sections : baseline.pageSpec!.sections,
      approvedWorkerIds: project.approvedPlan.workers.map((worker) => worker.workerId),
    }));
    const next = { ...baseline, pageSpec: normalizedPage };
    assertProjectInvariant(next);
    return next;
  }, { persistFailure: true });
}
