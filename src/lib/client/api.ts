import type { StudioProject } from "@/lib/domain/schemas";
import type { WorkerArtifact } from "@/lib/domain/worker-artifacts";

export const serverPersistenceEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "false";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.method && init.method !== "GET" ? { "Idempotency-Key": crypto.randomUUID() } : {}), ...init?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}.`);
  return body;
}

export const projectApi = {
  list: () => request<{ projects: StudioProject[] }>("/api/projects"),
  create: () => request<{ project: StudioProject }>("/api/projects", { method: "POST" }),
  get: (id: string) => request<{ project: StudioProject }>(`/api/projects/${id}`),
  analyze: (id: string, prompt: string, correcting = false) => request<{ project: StudioProject }>(`/api/projects/${id}/analyze`, { method: "POST", body: JSON.stringify({ prompt, correcting }) }),
  approve: (id: string, workerIds: string[]) => request<{ project: StudioProject }>(`/api/projects/${id}/approve`, { method: "POST", body: JSON.stringify({ workerIds }) }),
  build: (id: string) => request<{ project: StudioProject }>(`/api/projects/${id}/build`, { method: "POST", body: "{}" }),
  revise: (id: string, revision: string, confirmed = false) => request<{ project: StudioProject }>(`/api/projects/${id}/revise`, { method: "POST", body: JSON.stringify({ request: revision, confirmed }) }),
  expansion: (id: string, approved: boolean) => request<{ project: StudioProject }>(`/api/projects/${id}/expansion-decision`, { method: "POST", body: JSON.stringify({ approved }) }),
  classify: (id: string, question: string) => request<{ classification: { category: string; priority: string; route: string; draftedAnswer?: string; externalTicketCreated: boolean } }>(`/api/projects/${id}/support-classify`, { method: "POST", body: JSON.stringify({ question }) }),
  workerRuns: (id: string) => request<{ artifacts: WorkerArtifact[] }>(`/api/projects/${id}/worker-runs`),
  runWorker: (id: string, workerId: string, input: string) => request<{ artifact: WorkerArtifact }>(`/api/projects/${id}/workers/${workerId}/run`, { method: "POST", body: JSON.stringify({ input }) }),
  generateVisual: (id: string, prompt: string) => request<{ project: StudioProject }>(`/api/projects/${id}/assets/generate`, { method: "POST", body: JSON.stringify({ prompt }) }),
};
