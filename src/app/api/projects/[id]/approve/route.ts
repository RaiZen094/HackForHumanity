import { NextRequest } from "next/server";
import { z } from "zod";
import { approveTeam, toggleWorker } from "@/lib/demo/engine";
import { workerIdSchema } from "@/lib/domain/schemas";
import { mutateProject } from "@/lib/server/api";

const bodySchema = z.object({ workerIds: z.array(workerIdSchema).min(1) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Select at least one valid worker." }, { status: 400 });
  return mutateProject(request, id, "approve", (project) => {
    let configured = project;
    for (const worker of configured.recommendations) {
      if (worker.selected !== parsed.data.workerIds.includes(worker.workerId)) configured = toggleWorker(configured, worker.workerId);
    }
    return approveTeam(configured);
  });
}
