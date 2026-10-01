import { describe, expect, it } from "vitest";
import { createProject, markProjectFailed } from "@/lib/domain/project";
import { WORKERS } from "@/lib/domain/workers";
import {
  analyzeProject,
  answerClarification,
  approveTeam,
  buildProject,
  classifySupport,
  decideExpansion,
  reviseProject,
  toggleWorker,
} from "@/lib/demo/engine";

const climatePrompt = "Build ClimateSignal for coastal communities exposed to floods. Provide early-warning guidance, accept incident reports, and show risk data for local volunteers. Do not send official emergency alerts.";

function builtClimateProject() {
  return buildProject(approveTeam(analyzeProject(createProject(), climatePrompt)));
}

describe("Worker Studio demo journey", () => {
  it("asks one focused question for an insufficient prompt and retains it", () => {
    const project = analyzeProject(createProject(), "Build me a site");
    expect(project.stage).toBe("CLARIFYING");
    expect(project.currentPrompt).toBe("Build me a site");
    expect(project.interpretation?.clarificationQuestion).toBe("Who is this for, and what should they be able to achieve?");

    const clarified = answerClarification(project, "It is for city residents who need to report local problems.");
    expect(clarified.stage).toBe("AWAITING_APPROVAL");
    expect(clarified.events.filter((event) => event.name === "project_prompt_submitted")).toHaveLength(1);
    expect(clarified.messages.filter((item) => item.role === "participant")).toHaveLength(2);
  });

  it("reanalyzes a corrected problem and invalidates the old proposed team", () => {
    const first = analyzeProject(createProject(), climatePrompt);
    const changed = toggleWorker(first, "content-executive");
    const corrected = analyzeProject(changed, "Build an accessible clinic navigation service for rural patients who need appointment guidance and safe referral routes.");
    expect(corrected.id).toBe(first.id);
    expect(corrected.currentPrompt).toContain("clinic navigation");
    expect(corrected.approvedPlan).toBeNull();
    expect(corrected.recommendations).not.toEqual(changed.recommendations);
  });

  it("creates input-dependent recommendations for a climate solution", () => {
    const project = analyzeProject(createProject(), climatePrompt);
    expect(project.name).toBe("ClimateSignal");
    expect(project.interpretation?.audience).toBe("Coastal communities");
    expect(project.recommendations.map((item) => item.workerId)).toEqual(expect.arrayContaining(["content-executive", "customer-service-executive"]));
    expect(project.interpretation?.exclusions.join(" ")).toContain("send official emergency alerts");
  });

  it("gates generated capabilities by the explicitly approved team", () => {
    let project = analyzeProject(createProject(), climatePrompt);
    project = toggleWorker(project, "customer-service-executive");
    project = buildProject(approveTeam(project));
    expect(project.pageSpec?.approvedWorkerIds).not.toContain("customer-service-executive");
    expect(project.pageSpec?.sections.some((section) => section.type === "support-form")).toBe(false);
  });

  it("requires explicit approval and at least one selected specialist", () => {
    const proposed = analyzeProject(createProject(), climatePrompt);
    expect(() => buildProject(proposed)).toThrow("Approve the worker team");
    const noneSelected = proposed.recommendations.reduce((current, worker) => worker.selected ? toggleWorker(current, worker.workerId) : current, proposed);
    expect(() => approveTeam(noneSelected)).toThrow("Select at least one specialist");
  });

  it("applies an exact headline revision", () => {
    const project = builtClimateProject();
    const outcome = reviseProject(project, 'Change the headline to "Help is closer than you think"');
    expect(outcome.type).toBe("applied");
    expect(outcome.project.pageSpec?.hero.headline).toBe("Help is closer than you think");
  });

  it("clarifies ambiguous deletion and preserves the existing page", () => {
    const project = builtClimateProject();
    const before = project.pageSpec;
    const outcome = reviseProject(project, "Remove it");
    expect(outcome.type).toBe("clarification");
    expect(outcome.project.pageSpec).toEqual(before);
  });

  it("keeps capability expansion separate and preserves the page when declined", () => {
    const project = builtClimateProject();
    const before = project.pageSpec;
    const outcome = reviseProject(project, "Create a campaign for the workshop, but do not send anything");
    expect(outcome.type).toBe("expansion");
    expect(outcome.project.pendingExpansion?.worker.workerId).toBe("digital-campaign-executive");
    expect(outcome.project.pendingExpansion?.restriction).toBe("Do not send anything");
    const declined = decideExpansion(outcome.project, false);
    expect(declined.pageSpec).toEqual(before);
    expect(declined.approvedPlan?.workers.some((item) => item.workerId === "digital-campaign-executive")).toBe(false);
  });

  it("does not add a worker for copy that only mentions a campaign", () => {
    const project = builtClimateProject();
    const outcome = reviseProject(project, "Rename the heading to Campaign results", { expansionWorker: null });
    expect(outcome.type).toBe("applied");
    expect(outcome.project.pendingExpansion).toBeNull();
  });

  it("records a separately approved expansion and keeps no-send restrictions", () => {
    const project = builtClimateProject();
    const proposed = reviseProject(project, "Create a campaign for volunteers, but do not send anything", { expansionWorker: "digital-campaign-executive" });
    expect(proposed.type).toBe("expansion");
    const accepted = decideExpansion(proposed.project, true);
    expect(accepted.approvedPlan?.workers.some((item) => item.workerId === "digital-campaign-executive")).toBe(true);
    expect(accepted.approvedPlan?.interpretation.exclusions).toContain("Do not send anything");
    expect(accepted.events.filter((event) => event.name === "worker_selection_changed").at(-1)?.properties).toMatchObject({ workerId: "digital-campaign-executive", selected: true });
    expect(accepted.events.at(-1)?.name).toBe("revision_applied");
  });

  it("keeps revisions cumulative", () => {
    let project = builtClimateProject();
    project = reviseProject(project, 'Set the headline to "First exact headline"').project;
    project = reviseProject(project, 'Set the headline to "Second exact headline"').project;
    expect(project.pageSpec?.hero.headline).toBe("Second exact headline");
    expect(project.pageSpec?.sections.some((section) => section.id === "why-it-matters")).toBe(true);
    expect(project.messages.filter((item) => item.kind === "revision" && item.role === "participant")).toHaveLength(2);
  });

  it("classifies a support request without claiming an external ticket", () => {
    expect(classifySupport("Flood water is rising and this road is unsafe")).toEqual({
      category: "Safety and incident", priority: "High", route: "Human support review", externalTicketCreated: false,
    });
  });

  it("records every required event through a complete journey", () => {
    let project = analyzeProject(createProject(), climatePrompt);
    project = toggleWorker(project, "content-executive");
    project = toggleWorker(project, "content-executive");
    project = buildProject(approveTeam(project));
    project = reviseProject(project, 'Set the headline to "Earlier warnings for safer shores"').project;
    const names = new Set(project.events.map((event) => event.name));
    expect(names).toEqual(new Set([
      "project_prompt_submitted", "worker_recommendation_shown", "worker_selection_changed",
      "worker_team_approved", "landing_page_build_started", "landing_page_build_completed",
      "revision_requested", "revision_applied",
    ]));
    const promptEvent = project.events.find((event) => event.name === "project_prompt_submitted");
    expect(promptEvent?.properties).toMatchObject({ projectId: project.id, origin: "custom", promptLength: climatePrompt.length });
    const approvalEvent = project.events.find((event) => event.name === "worker_team_approved");
    expect(approvalEvent?.properties).toEqual(expect.objectContaining({ projectId: project.id, approvedWorkerIds: expect.any(Array), approvalTimestamp: expect.any(String) }));
    const buildEvent = project.events.find((event) => event.name === "landing_page_build_completed");
    expect(buildEvent?.properties).toEqual(expect.objectContaining({ result: "success", durationMs: expect.any(Number) }));
    const revisionEvent = project.events.find((event) => event.name === "revision_applied");
    expect(revisionEvent?.properties).toEqual(expect.objectContaining({ result: "success", category: "copy", durationMs: expect.any(Number) }));
  });

  it("keeps projects independent", () => {
    const first = builtClimateProject();
    const second = buildProject(approveTeam(analyzeProject(createProject(), "Build a waste reporting service for city residents with issue routing and recurring trend analysis.")));
    expect(first.id).not.toBe(second.id);
    expect(first.currentPrompt).not.toBe(second.currentPrompt);
    expect(first.pageSpec?.brandName).not.toBe(second.pageSpec?.brandName);
  });

  it("labels external-output workers as drafts while keeping internal workers live", () => {
    expect(WORKERS.find((worker) => worker.id === "digital-campaign-executive")?.mode).toBe("draft");
    expect(WORKERS.find((worker) => worker.id === "customer-success-executive")?.mode).toBe("draft");
    expect(WORKERS.find((worker) => worker.id === "content-executive")?.mode).toBe("live");
    expect(WORKERS.find((worker) => worker.id === "customer-service-executive")?.mode).toBe("live");
  });

  it("retains accepted context in a truthful failed state that can be retried", () => {
    const built = builtClimateProject();
    const failed = markProjectFailed(built, "revise", "Model timeout", "Change the hero theme");
    expect(failed.stage).toBe("FAILED");
    expect(failed.approvedPlan).toEqual(built.approvedPlan);
    expect(failed.pageSpec).toEqual(built.pageSpec);
    expect(JSON.parse(failed.lastError!)).toMatchObject({ operation: "revise", request: "Change the hero theme" });
    expect(failed.events.at(-1)).toMatchObject({ name: "revision_requested", properties: { result: "failure" } });
  });

  it("produces distinct solutions across all hackathon challenge tracks", () => {
    const agriculture = buildProject(approveTeam(analyzeProject(createProject(), "Build crop guidance for smallholder farmers who need to report disease symptoms and monitor local risk data.")));
    const civic = buildProject(approveTeam(analyzeProject(createProject(), "Build a public service for city residents to report waste and drainage issues and track recurring incidents.")));
    expect(agriculture.name).toBe("FarmBridge");
    expect(agriculture.pageSpec?.hero.headline).toBe("Better decisions for every growing season.");
    expect(civic.name).toBe("WasteWise");
    expect(civic.pageSpec?.hero.headline).toBe("Cleaner streets start with better coordination.");
  });
});
