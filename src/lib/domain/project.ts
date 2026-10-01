import type { ProductEventName, StudioProject } from "./schemas";

export function createProject(name = "Untitled project"): StudioProject {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    stage: "DESCRIBE",
    originalPrompt: null,
    currentPrompt: null,
    interpretation: null,
    recommendations: [],
    approvedPlan: null,
    pendingExpansion: null,
    pageSpec: null,
    messages: [],
    events: [],
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function recordEvent(
  project: StudioProject,
  name: ProductEventName,
  properties: Record<string, unknown>,
): StudioProject {
  const now = new Date().toISOString();
  return {
    ...project,
    events: [
      ...project.events,
      { id: crypto.randomUUID(), name, properties, createdAt: now },
    ],
    updatedAt: now,
  };
}

export function markProjectFailed(
  project: StudioProject,
  operation: "analyze" | "build" | "revise",
  errorMessage: string,
  request: string | null = null,
) {
  const now = new Date().toISOString();
  let failed: StudioProject = {
    ...project,
    stage: "FAILED",
    lastError: JSON.stringify({ operation, message: errorMessage.slice(0, 420), request: request?.slice(0, 420) ?? null }),
    messages: [...project.messages, { id: crypto.randomUUID(), role: "assistant", kind: "status", content: `${operation} failed. Your accepted work is preserved and can be retried.`, createdAt: now }],
    updatedAt: now,
  };
  if (operation === "build") {
    failed = recordEvent(failed, "landing_page_build_started", { projectId: project.id, approvedWorkerIds: project.approvedPlan?.workers.map((worker) => worker.workerId) ?? [] });
    failed = recordEvent(failed, "landing_page_build_completed", { projectId: project.id, durationMs: 0, result: "failure" });
  } else if (operation === "revise") {
    failed = recordEvent(failed, "revision_requested", { projectId: project.id, category: "unknown", result: "failure" });
  } else if (request) {
    failed = recordEvent(failed, "project_prompt_submitted", { projectId: project.id, promptLength: request.length, origin: "custom", result: "failure" });
  }
  return failed;
}

export function assertProjectInvariant(project: StudioProject) {
  if (["BUILDING", "PREVIEW", "REVISING"].includes(project.stage) && !project.approvedPlan) {
    throw new Error("An approved plan is required before building or revising.");
  }
  if (project.pageSpec) {
    const approved = new Set(project.approvedPlan?.workers.map((worker) => worker.workerId) ?? []);
    for (const section of project.pageSpec.sections) {
      if (section.type === "feature-grid") {
        for (const feature of section.features) {
          if (!approved.has(feature.requiredWorkerId)) {
            throw new Error(`Page feature requires unapproved worker ${feature.requiredWorkerId}.`);
          }
        }
      }
      if (section.type === "support-form" && !approved.has(section.requiredWorkerId)) {
        throw new Error("Support form requires the approved Customer Service Executive.");
      }
    }
  }
}
