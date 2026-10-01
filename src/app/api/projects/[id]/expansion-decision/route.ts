import { NextRequest } from "next/server";
import { z } from "zod";
import { decideExpansion } from "@/lib/demo/engine";
import { mutateProject } from "@/lib/server/api";

const bodySchema = z.object({ approved: z.boolean() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "An approval decision is required." }, { status: 400 });
  return mutateProject(request, id, "expansion_decision", (project) => decideExpansion(project, parsed.data.approved));
}
