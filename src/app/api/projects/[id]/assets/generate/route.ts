import { NextRequest } from "next/server";
import { z } from "zod";
import { pageSpecSchema } from "@/lib/domain/schemas";
import { mutateProject } from "@/lib/server/api";
import { generateProjectImage } from "@/lib/server/image-openai";
import { createProjectAsset, createWorkerRun } from "@/lib/server/repository";

const bodySchema = z.object({ prompt: z.string().trim().min(4).max(1500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe the visual you want." }, { status: 400 });
  return mutateProject(request, id, "generate-visual", async (project) => {
    if (!project.pageSpec || !project.approvedPlan) throw new Error("Build the solution before generating a visual.");
    if (!project.approvedPlan.workers.some((worker) => worker.workerId === "content-executive")) throw new Error("Approve Content Executive before generating visuals.");
    const context = `${project.pageSpec.brandName}. ${project.interpretation?.problem ?? project.originalPrompt}. Audience: ${project.interpretation?.audience ?? "the intended community"}.`;
    const image = await generateProjectImage(parsed.data.prompt, context);
    const alt = `Generated visual for ${project.pageSpec.brandName}: ${parsed.data.prompt}`.slice(0, 500);
    const asset = await createProjectAsset(project.id, parsed.data.prompt, alt, image);
    const media = {
      id: asset.id,
      kind: "generated-image" as const,
      url: `/api/projects/${project.id}/assets/${asset.id}`,
      alt,
      prompt: parsed.data.prompt,
      placement: "hero" as const,
      sectionId: null,
      generatedBy: "content-executive" as const,
    };
    await createWorkerRun(project.id, "content-executive", parsed.data.prompt, { assetId: asset.id, url: media.url, alt, type: "generated-image" });
    return { ...project, pageSpec: pageSpecSchema.parse({ ...project.pageSpec, media: [...project.pageSpec.media.filter((item) => item.placement !== "hero"), media] }), updatedAt: new Date().toISOString() };
  });
}
