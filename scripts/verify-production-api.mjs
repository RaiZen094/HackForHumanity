import { createHash, randomUUID } from "node:crypto";
import process from "node:process";
import { config } from "dotenv";
import sql from "mssql";

const envPath = process.argv[2] || ".env.local";
const baseUrl = process.argv[3] || "http://localhost:3001";
config({ path: envPath, quiet: true });

let cookie = "";
let projectId = "";
const projectIds = [];
let tokenHash = "";

async function call(path, method = "GET", body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json", "Idempotency-Key": randomUUID() } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";", 1)[0];
    const token = cookie.slice(cookie.indexOf("=") + 1);
    tokenHash = createHash("sha256").update(token).digest("hex");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} ${path} failed: ${JSON.stringify(result)}`);
  return result;
}

async function fetchBinary(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}.`);
  return { contentType: response.headers.get("content-type"), bytes: (await response.arrayBuffer()).byteLength };
}

const requiredEvents = new Set([
  "project_prompt_submitted", "worker_recommendation_shown", "worker_team_approved",
  "worker_selection_changed", "landing_page_build_started", "landing_page_build_completed", "revision_requested", "revision_applied",
]);

try {
  const created = await call("/api/projects", "POST", {});
  projectId = created.project.id;
  projectIds.push(projectId);
  const prompt = "Build ClimateSignal for coastal communities exposed to flooding. Provide accessible warning guidance, accept resident incident reports, and show risk trends for local volunteers. Do not send official emergency alerts or claim government integration.";
  const analyzed = await call(`/api/projects/${projectId}/analyze`, "POST", { prompt });
  const workerIds = analyzed.project.recommendations.map((item) => item.workerId);
  if (workerIds.length !== 6) throw new Error(`Expected all six available specialists, received ${workerIds.length}.`);

  await call(`/api/projects/${projectId}/approve`, "POST", { workerIds });
  await call(`/api/projects/${projectId}/build`, "POST", {});
  await call(`/api/projects/${projectId}/revise`, "POST", { request: "Set the headline to Production persistence works" });
  const visualResult = await call(`/api/projects/${projectId}/assets/generate`, "POST", { prompt: "Coastal volunteers mapping flood risks with residents, documentary style, no text or logos" });
  const visual = visualResult.project.pageSpec.media.find((item) => item.placement === "hero");
  if (!visual) throw new Error("Content Executive did not attach the generated project visual.");
  const visualFile = await fetchBinary(visual.url);
  if (visualFile.contentType !== "image/jpeg" || visualFile.bytes < 1000) throw new Error("The persisted generated visual could not be restored.");
  const support = await call(`/api/projects/${projectId}/support-classify`, "POST", { question: "Flood water is rising near our road and people cannot pass safely" });
  const workerInputs = {
    "voice-executive": "Water is rising beside the market road and two households may be cut off.",
    "customer-service-executive": "How should a resident report a blocked evacuation route?",
    "content-executive": "Create an accessible preparedness page and three concise FAQs for coastal households.",
    "digital-campaign-executive": "Plan a one-week community flood-preparedness campaign.",
    "customer-success-executive": "Create the onboarding and follow-up journey for a community volunteer.",
    "growth-analyst": "Analyze current project activity and suggest three measurable impact and scale experiments.",
  };
  for (const workerId of workerIds) await call(`/api/projects/${projectId}/workers/${workerId}/run`, "POST", { input: workerInputs[workerId] });
  const runs = await call(`/api/projects/${projectId}/worker-runs`);
  const restored = await call(`/api/projects/${projectId}`);
  const secondCreated = await call("/api/projects", "POST", {});
  projectIds.push(secondCreated.project.id);
  const secondPrompt = "Build CarePath for rural patients who need clear clinic appointment guidance and safe referral routes. Do not contact patients automatically or claim hospital integration.";
  const secondAnalyzed = await call(`/api/projects/${secondCreated.project.id}/analyze`, "POST", { prompt: secondPrompt });
  const secondWorkers = secondAnalyzed.project.recommendations.filter((item) => item.selected).map((item) => item.workerId);
  await call(`/api/projects/${secondCreated.project.id}/approve`, "POST", { workerIds: secondWorkers });
  await call(`/api/projects/${secondCreated.project.id}/build`, "POST", {});
  const secondRestored = await call(`/api/projects/${secondCreated.project.id}`);
  const listed = await call("/api/projects");
  const unauthorized = await fetch(`${baseUrl}/api/projects/${projectId}`);
  if (unauthorized.status !== 404) throw new Error(`A different guest session accessed the project (${unauthorized.status}).`);

  const eventNames = new Set(restored.project.events.map((event) => event.name));
  const missingEvents = [...requiredEvents].filter((name) => !eventNames.has(name));
  if (restored.project.stage !== "PREVIEW") throw new Error(`Unexpected stage: ${restored.project.stage}`);
  if (restored.project.pageSpec.hero.headline !== "Production persistence works") throw new Error("Revision did not persist exactly.");
  if (support.classification.externalTicketCreated !== false) throw new Error("Support response claimed an external ticket.");
  if (!listed.projects.some((project) => project.id === projectId)) throw new Error("Project list did not restore the created project.");
  if (!listed.projects.some((project) => project.id === secondCreated.project.id)) throw new Error("Project list did not restore the independent second project.");
  if (secondRestored.project.currentPrompt === restored.project.currentPrompt || secondRestored.project.pageSpec.brandName === restored.project.pageSpec.brandName) throw new Error("The two projects were not independently generated.");
  if (missingEvents.length) throw new Error(`Missing required events: ${missingEvents.join(", ")}`);
  if (new Set(runs.artifacts.map((artifact) => artifact.workerId)).size !== 6) throw new Error("Not every specialist produced a persisted result.");

  console.log(JSON.stringify({ status: "ok", projectStage: restored.project.stage, eventCount: restored.project.events.length, requiredEventsPresent: true, supportRoute: support.classification.route, liveWorkersVerified: 6, persistedWorkerRuns: runs.artifacts.length, generatedVisualRestored: true, generatedVisualBytes: visualFile.bytes, independentProjectsVerified: 2, guestIsolationVerified: true }, null, 2));
} finally {
  if (projectId && process.env.AZURE_SQL_DATABASE === "ezassist_2_0_0_2_dev") {
    const pool = await sql.connect({
      server: process.env.AZURE_SQL_SERVER,
      port: Number(process.env.AZURE_SQL_PORT || "1433"),
      database: process.env.AZURE_SQL_DATABASE,
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      options: { encrypt: process.env.AZURE_SQL_ENCRYPT !== "false", trustServerCertificate: process.env.AZURE_SQL_TRUST_SERVER_CERTIFICATE === "true", tdsVersion: "7_4" },
    });
    try {
      for (const id of projectIds) {
        const request = pool.request();
        request.input("ProjectId", sql.NVarChar(64), id);
        await request.query("DELETE FROM dbo.WorkerStudioProject WHERE Id=@ProjectId;");
      }
      const sessionRequest = pool.request();
      sessionRequest.input("TokenHash", sql.NVarChar(128), tokenHash);
      await sessionRequest.query("DELETE FROM dbo.WorkerStudioGuestSession WHERE TokenHash=@TokenHash AND NOT EXISTS (SELECT 1 FROM dbo.WorkerStudioProject WHERE GuestSessionId=dbo.WorkerStudioGuestSession.Id);");
      console.log(JSON.stringify({ cleanup: "ok", temporaryProjectsRemoved: projectIds.length }, null, 2));
    } finally {
      await pool.close();
    }
  }
}
