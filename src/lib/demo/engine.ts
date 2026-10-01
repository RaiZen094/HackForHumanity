import {
  approvedPlanSchema,
  pageSpecSchema,
  type Interpretation,
  type PageSpec,
  type PendingExpansion,
  type StudioProject,
  type WorkerId,
  type WorkerRecommendation,
} from "@/lib/domain/schemas";
import { assertProjectInvariant, recordEvent } from "@/lib/domain/project";
import { WORKERS, workerById } from "@/lib/domain/workers";

const isoNow = () => new Date().toISOString();
const message = (
  role: "participant" | "assistant" | "system",
  kind: "prompt" | "interpretation" | "clarification" | "status" | "revision",
  content: string,
) => ({ id: crypto.randomUUID(), role, kind, content, createdAt: isoNow() });

const includesAny = (text: string, values: string[]) =>
  values.some((value) => text.toLowerCase().includes(value));

export function promptNeedsClarification(prompt: string) {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  const hasAudience = includesAny(prompt, [
    "student", "farmer", "customer", "resident", "patient", "visitor", "team", "people", "users",
    "citizen", "community", "household", "worker", "commuter", "driver", "women", "children",
    "youth", "elderly", "business", "volunteer", "official", "municipality", "village", "rural", "urban", "coastal",
  ]);
  const hasIntent = includesAny(prompt, [
    "build", "create", "help", "find", "answer", "support", "route", "provide", "reduce", "prevent",
    "protect", "monitor", "predict", "report", "connect", "manage", "improve", "detect", "track", "optimize", "alert",
  ]);
  return words.length < 8 || !hasAudience || !hasIntent;
}

function extractExclusions(prompt: string) {
  const exclusions: string[] = [];
  const patterns = [
    /do not ([^.]+)/gi,
    /don't ([^.]+)/gi,
    /without ([^.]+)/gi,
    /no ([^.]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of prompt.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (value && value.length > 2) exclusions.push(value);
    }
  }
  return [...new Set(exclusions)];
}

function inferAudience(prompt: string) {
  const lower = prompt.toLowerCase();
  const audiencePatterns = [
    { match: "university students", value: "University students" },
    { match: "students", value: "Students" },
    { match: "coastal communities", value: "Coastal communities" },
    { match: "rural communities", value: "Rural communities" },
    { match: "urban residents", value: "Urban residents" },
    { match: "city residents", value: "City residents" },
    { match: "smallholder farmers", value: "Smallholder farmers" },
    { match: "farmers", value: "Farmers" },
    { match: "waste collectors", value: "Waste collectors" },
    { match: "commuters", value: "Commuters" },
    { match: "drivers", value: "Drivers" },
    { match: "households", value: "Households" },
    { match: "citizens", value: "Citizens" },
    { match: "communities", value: "Local communities" },
    { match: "women", value: "Women" },
    { match: "children", value: "Children and caregivers" },
    { match: "elderly", value: "Older adults and caregivers" },
    { match: "small businesses", value: "Small businesses" },
    { match: "customers", value: "Customers" },
    { match: "residents", value: "Residents" },
    { match: "patients", value: "Patients" },
    { match: "visitors", value: "Visitors" },
  ];
  return audiencePatterns.find((item) => lower.includes(item.match))?.value ?? "The intended users";
}

export function interpretPrompt(prompt: string): Interpretation {
  const audience = inferAudience(prompt);
  const exclusions = extractExclusions(prompt);
  return {
    audience,
    problem: prompt.trim(),
    desiredValue: `Help ${audience.toLowerCase()} address the stated problem through an accessible, measurable solution.`,
    explicitRequirements: [prompt.trim()],
    assumptions: [
      "The first release is a demonstrable web experience grounded in the stated context.",
      "External actions remain under human control.",
    ],
    exclusions,
    clarificationRequired: false,
    clarificationQuestion: null,
  };
}

export function recommendWorkers(prompt: string): WorkerRecommendation[] {
  const lower = prompt.toLowerCase();
  const selected = new Set<WorkerId>();

  for (const worker of WORKERS) {
    if (worker.capabilitySignals.some((signal) => lower.includes(signal))) {
      selected.add(worker.id);
    }
  }

  if (includesAny(lower, ["answer", "information", "guide", "knowledge", "clear"])) {
    selected.add("content-executive");
  }
  if (includesAny(lower, ["support", "unresolved", "urgent", "route", "question"])) {
    selected.add("customer-service-executive");
  }
  if (selected.size === 0) selected.add("content-executive");

  return WORKERS.map((worker) => ({
    workerId: worker.id,
    contribution: worker.contribution,
    reason: reasonForWorker(worker.id, prompt),
    selected: selected.has(worker.id),
    mode: worker.mode,
  }));
}

function reasonForWorker(workerId: WorkerId, prompt: string) {
  const audience = inferAudience(prompt).toLowerCase();
  const reasons: Record<WorkerId, string> = {
    "voice-executive": `Spoken input can make the service easier to use for ${audience}.`,
    "customer-service-executive": "The request needs a clear path for unresolved or urgent questions.",
    "content-executive": "The solution depends on clear answers grounded in approved information.",
    "digital-campaign-executive": "The requested outreach capability needs a campaign draft and channel plan.",
    "customer-success-executive": "The requested journey includes onboarding, reminders, or follow-up.",
    "growth-analyst": "The request calls for usage patterns or measurement to guide decisions.",
  };
  return reasons[workerId];
}

export function analyzeProject(
  project: StudioProject,
  prompt: string,
  options: { appendPromptMessage?: boolean; recordSubmission?: boolean } = {},
): StudioProject {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new Error("Describe the audience, problem, and useful outcome.");
  const appendPromptMessage = options.appendPromptMessage ?? true;
  const recordSubmission = options.recordSubmission ?? true;

  let next: StudioProject = {
    ...project,
    originalPrompt: project.originalPrompt ?? cleanPrompt,
    currentPrompt: cleanPrompt,
    pageSpec: null,
    approvedPlan: null,
    pendingExpansion: null,
    recommendations: [],
    lastError: null,
    messages: appendPromptMessage ? [...project.messages, message("participant", "prompt", cleanPrompt)] : project.messages,
    updatedAt: isoNow(),
  };

  if (recordSubmission) {
    next = recordEvent(next, "project_prompt_submitted", {
      promptLength: cleanPrompt.length,
      origin: "custom",
      projectId: project.id,
    });
  }

  if (promptNeedsClarification(cleanPrompt)) {
    const question = "Who is this for, and what should they be able to achieve?";
    return {
      ...next,
      stage: "CLARIFYING",
      interpretation: {
        audience: "Not clear yet",
        problem: cleanPrompt,
        desiredValue: "Not clear yet",
        explicitRequirements: [cleanPrompt],
        assumptions: [],
        exclusions: extractExclusions(cleanPrompt),
        clarificationRequired: true,
        clarificationQuestion: question,
      },
      messages: [...next.messages, message("assistant", "clarification", question)],
    };
  }

  const interpretation = interpretPrompt(cleanPrompt);
  const recommendations = recommendWorkers(cleanPrompt);
  next = {
    ...next,
    name: createProjectName(cleanPrompt),
    stage: "AWAITING_APPROVAL",
    interpretation,
    recommendations,
    messages: [
      ...next.messages,
      message(
        "assistant",
        "interpretation",
        `I understand this as a service for ${interpretation.audience.toLowerCase()}. ${interpretation.desiredValue}`,
      ),
      message(
        "assistant",
        "status",
        `I recommend ${recommendations.filter((item) => item.selected).map((item) => workerById(item.workerId).name).join(" and ")}. Every specialist remains available for this build.`,
      ),
    ],
  };
  return recordEvent(next, "worker_recommendation_shown", {
    projectId: project.id,
    workerIds: recommendations.filter((item) => item.selected).map((item) => item.workerId),
    reasons: recommendations.filter((item) => item.selected).map((item) => item.reason),
  });
}

export function answerClarification(
  project: StudioProject,
  answer: string,
): StudioProject {
  if (project.stage !== "CLARIFYING" || !project.currentPrompt) {
    throw new Error("This project is not waiting for clarification.");
  }
  const combined = `${project.currentPrompt} ${answer.trim()}`;
  const withAnswer: StudioProject = {
    ...project,
    messages: [...project.messages, message("participant", "clarification", answer.trim())],
  };
  return analyzeProject(withAnswer, combined, { appendPromptMessage: false, recordSubmission: false });
}

export function toggleWorker(
  project: StudioProject,
  workerId: WorkerId,
): StudioProject {
  if (project.stage !== "AWAITING_APPROVAL") {
    throw new Error("The proposed team can only be changed before approval.");
  }
  const recommendations = project.recommendations.map((item) =>
    item.workerId === workerId ? { ...item, selected: !item.selected } : item,
  );
  const changed = recommendations.find((item) => item.workerId === workerId);
  return recordEvent(
    { ...project, recommendations, updatedAt: isoNow() },
    "worker_selection_changed",
    { projectId: project.id, workerId, selected: changed?.selected ?? false },
  );
}

export function approveTeam(project: StudioProject): StudioProject {
  if (project.stage !== "AWAITING_APPROVAL" || !project.interpretation || !project.currentPrompt) {
    throw new Error("A current interpretation and proposed team are required.");
  }
  const workers = project.recommendations.filter((item) => item.selected);
  if (workers.length === 0) throw new Error("Select at least one specialist before approval.");

  const approvedPlan = approvedPlanSchema.parse({
    prompt: project.currentPrompt,
    interpretation: project.interpretation,
    workers,
    approvedAt: isoNow(),
  });
  const next = {
    ...project,
    approvedPlan,
    stage: "BUILDING" as const,
    messages: [
      ...project.messages,
      message("assistant", "status", `Approved ${workers.length} specialist${workers.length === 1 ? "" : "s"}. Landing Page Manager can now build.`),
    ],
    updatedAt: isoNow(),
  };
  return recordEvent(next, "worker_team_approved", {
    projectId: project.id,
    approvedWorkerIds: workers.map((item) => item.workerId),
    approvalTimestamp: approvedPlan.approvedAt,
  });
}

export function buildProject(project: StudioProject): StudioProject {
  if (!project.approvedPlan) throw new Error("Approve the worker team before building.");
  const start = Date.now();
  let next = recordEvent(
    { ...project, stage: "BUILDING", lastError: null },
    "landing_page_build_started",
    {
      projectId: project.id,
      approvedWorkerIds: project.approvedPlan.workers.map((item) => item.workerId),
    },
  );
  const pageSpec = makePageSpec(project);
  next = {
    ...next,
    stage: "PREVIEW",
    pageSpec,
    messages: [
      ...next.messages,
      message("assistant", "status", "The page is ready. It includes only the capabilities in your approved plan."),
    ],
    updatedAt: isoNow(),
  };
  next = recordEvent(next, "landing_page_build_completed", {
    projectId: project.id,
    durationMs: Math.max(1, Date.now() - start),
    result: "success",
  });
  assertProjectInvariant(next);
  return next;
}

function makePageSpec(project: StudioProject): PageSpec {
  if (!project.approvedPlan) throw new Error("Approved plan missing.");
  const workerIds = project.approvedPlan.workers.map((item) => item.workerId);
  const brandName = project.name === "Untitled project" ? "Project" : project.name;
  const sections: PageSpec["sections"] = [
    {
      id: "why-it-matters",
      type: "narrative",
      heading: "Why this solution matters",
      body: project.approvedPlan.interpretation.desiredValue,
    },
    {
      id: "approved-capabilities",
      type: "feature-grid",
      heading: "How the solution works",
      features: project.approvedPlan.workers.map((item) => ({
        id: `feature-${item.workerId}`,
        title: featureTitleFor(item.workerId),
        description: item.contribution,
        requiredWorkerId: item.workerId,
        mode: item.mode,
        actionLabel: featureActionFor(item.workerId),
        supportingWorkerIds: [],
      })),
    },
  ];
  if (workerIds.includes("customer-service-executive")) {
    sections.push({
      id: "support",
      type: "support-form",
      heading: "Ask for help",
      helperText: "Describe the issue. We will classify it and suggest the right route without creating an external ticket.",
      requiredWorkerId: "customer-service-executive",
    });
  }
  return pageSpecSchema.parse({
    version: 1,
    brandName,
    theme: { accent: "#2f6b4f", surface: "#f3f1e8", ink: "#17201b" },
    hero: {
      eyebrow: `For ${project.approvedPlan.interpretation.audience}`,
      headline: headlineFor(project.approvedPlan.prompt),
      subheadline: project.approvedPlan.interpretation.desiredValue,
      primaryAction: actionFor(project.approvedPlan.prompt, workerIds),
    },
    sections,
    approvedWorkerIds: workerIds,
  });
}

function featureTitleFor(workerId: WorkerId) {
  return ({
    "voice-executive": "Voice-first field intake",
    "customer-service-executive": "Smart request routing",
    "content-executive": "Adaptive knowledge and visuals",
    "digital-campaign-executive": "Community outreach studio",
    "customer-success-executive": "Guided participant journeys",
    "growth-analyst": "Impact and adoption signals",
  } satisfies Record<WorkerId, string>)[workerId];
}

function featureActionFor(workerId: WorkerId) {
  return ({
    "voice-executive": "Structure a voice report",
    "customer-service-executive": "Route a request",
    "content-executive": "Create useful content",
    "digital-campaign-executive": "Draft outreach",
    "customer-success-executive": "Build a journey",
    "growth-analyst": "Analyze impact",
  } satisfies Record<WorkerId, string>)[workerId];
}

function createProjectName(prompt: string) {
  const names: Array<[RegExp, string]> = [
    [/flood|cyclone|disaster|climate resilience/i, "ClimateSignal"],
    [/waste|recycl|garbage|plastic/i, "WasteWise"],
    [/air quality|pollution|emission/i, "CleanAir Watch"],
    [/water|river|sanitation/i, "WaterGuard"],
    [/farmer|farm|crop|agricultur/i, "FarmBridge"],
    [/public service|civic|municipal|citizen/i, "CivicLink"],
    [/health|patient|clinic|medical/i, "CarePath"],
    [/traffic|transport|commut|mobility/i, "MoveSmart"],
    [/school|education|learning|student/i, "LearnAccess"],
    [/energy|electricity|solar/i, "EnergyWise"],
  ];
  const matched = names.find(([pattern]) => pattern.test(prompt));
  if (matched) return matched[1];
  const words = prompt.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 3).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ") || "New project";
}

function headlineFor(prompt: string) {
  const headlines: Array<[RegExp, string]> = [
    [/flood|cyclone|disaster/i, "Earlier warnings. Safer communities."],
    [/waste|recycl|garbage|plastic/i, "Cleaner streets start with better coordination."],
    [/air quality|pollution|emission/i, "Make invisible pollution visible."],
    [/water|river|sanitation/i, "Protect every community's water."],
    [/farmer|farm|crop|agricultur/i, "Better decisions for every growing season."],
    [/public service|civic|municipal|citizen/i, "Public services people can actually navigate."],
    [/health|patient|clinic|medical/i, "The right care, reached sooner."],
    [/traffic|transport|commut|mobility/i, "Move people with less uncertainty."],
    [/energy|electricity|solar/i, "Use energy where it matters most."],
  ];
  return headlines.find(([pattern]) => pattern.test(prompt))?.[1] ?? "A practical solution for a real problem.";
}

function actionFor(prompt: string, workerIds: WorkerId[]) {
  if (/report|complaint|incident/i.test(prompt)) return "Report an issue";
  if (/monitor|data|forecast|predict|analytics/i.test(prompt)) return "View the insights";
  if (/alert|warning|emergency/i.test(prompt)) return "Check current guidance";
  if (workerIds.includes("customer-service-executive")) return "Try the service";
  return "Explore the solution";
}

export type RevisionOutcome =
  | { type: "applied"; project: StudioProject }
  | { type: "clarification"; project: StudioProject; question: string }
  | { type: "confirmation"; project: StudioProject; question: string }
  | { type: "expansion"; project: StudioProject; expansion: PendingExpansion };

export function reviseProject(
  project: StudioProject,
  request: string,
  options: { confirmed?: boolean; expansionWorker?: WorkerId | null; clarificationQuestion?: string | null; destructive?: boolean } = {},
): RevisionOutcome {
  if (!project.pageSpec || !project.approvedPlan) throw new Error("Build a page before requesting revisions.");
  const clean = request.trim();
  let next = recordEvent(
    {
      ...project,
      stage: "REVISING",
      lastError: null,
      messages: [...project.messages, message("participant", "revision", clean)],
    },
    "revision_requested",
    { projectId: project.id, category: revisionCategory(clean) },
  );

  if (options.clarificationQuestion) {
    next = { ...next, stage: "PREVIEW", messages: [...next.messages, message("assistant", "clarification", options.clarificationQuestion)] };
    return { type: "clarification", project: next, question: options.clarificationQuestion };
  }

  if (/^remove it[.!]?$/i.test(clean)) {
    const question = "Which section or capability should I remove?";
    next = {
      ...next,
      stage: "PREVIEW",
      messages: [...next.messages, message("assistant", "clarification", question)],
    };
    return { type: "clarification", project: next, question };
  }

  const expansionWorker = options.expansionWorker === undefined ? detectExpansion(clean, project) : options.expansionWorker;
  if (expansionWorker) {
    const definition = workerById(expansionWorker);
    const expansion: PendingExpansion = {
      worker: {
        workerId: definition.id,
        contribution: definition.contribution,
        reason: reasonForWorker(definition.id, clean),
        selected: true,
        mode: definition.mode,
      },
      request: clean,
      restriction: /do not send|don't send|no send/i.test(clean) ? "Do not send anything" : null,
    };
    next = {
      ...next,
      stage: "PREVIEW",
      pendingExpansion: expansion,
      messages: [
        ...next.messages,
        message("assistant", "status", `${definition.name} is needed for this capability. Approve it separately before connection.`),
      ],
    };
    next = recordEvent(next, "worker_recommendation_shown", {
      projectId: project.id,
      workerIds: [definition.id],
      reasons: [expansion.worker.reason],
    });
    return { type: "expansion", project: next, expansion };
  }

  const destructiveMatch = clean.match(/remove (?:the )?(.+?)(?: section)?[.!]?$/i);
  if (options.destructive && !options.confirmed && !destructiveMatch) {
    const question = "This request may remove or replace existing work. Apply the destructive change?";
    next = { ...next, stage: "PREVIEW", messages: [...next.messages, message("assistant", "clarification", question)] };
    return { type: "confirmation", project: next, question };
  }
  if (destructiveMatch && !options.confirmed) {
    const question = `Remove ${destructiveMatch[1]}? This changes the current page and requires confirmation.`;
    next = {
      ...next,
      stage: "PREVIEW",
      messages: [...next.messages, message("assistant", "clarification", question)],
    };
    return { type: "confirmation", project: next, question };
  }

  const pageSpec = structuredClone(project.pageSpec);
  const headline = extractHeadline(clean);
  let summary = "Updated the current page.";
  if (headline) {
    pageSpec.hero.headline = headline;
    summary = `Changed the main headline to "${headline}".`;
  } else if (/move .*support.*up/i.test(clean)) {
    const index = pageSpec.sections.findIndex((section) => section.id === "support");
    if (index > 0) {
      const [section] = pageSpec.sections.splice(index, 1);
      pageSpec.sections.splice(index - 1, 0, section);
      summary = "Moved the support section earlier on the page.";
    }
  } else if (destructiveMatch && options.confirmed) {
    const target = destructiveMatch[1].toLowerCase();
    pageSpec.sections = pageSpec.sections.filter(
      (section) => !section.heading.toLowerCase().includes(target) && !section.id.includes(target.replace(/\s+/g, "-")),
    );
    summary = `Removed the confirmed ${destructiveMatch[1]} section.`;
  } else {
    pageSpec.hero.subheadline = clean;
    summary = "Updated the supporting message with the requested wording.";
  }

  next = {
    ...next,
    stage: "PREVIEW",
    pageSpec: pageSpecSchema.parse(pageSpec),
    messages: [...next.messages, message("assistant", "revision", summary)],
    updatedAt: isoNow(),
  };
  next = recordEvent(next, "revision_applied", {
    projectId: project.id,
    category: revisionCategory(clean),
    durationMs: 1,
    result: "success",
  });
  assertProjectInvariant(next);
  return { type: "applied", project: next };
}

function extractHeadline(request: string) {
  const quoted = request.match(/headline(?:\s+to|:)?\s*["“]([^"”]+)["”]/i);
  if (quoted?.[1]) return quoted[1].trim();
  const plain = request.match(/(?:change|replace|set).*headline\s+to\s+(.+)$/i);
  return plain?.[1]?.replace(/["“”]/g, "").trim() ?? null;
}

function revisionCategory(request: string) {
  if (/campaign|outreach|follow-up|analytics|voice/i.test(request)) return "capability";
  if (/remove/i.test(request)) return "destructive";
  if (/move|order|prominent/i.test(request)) return "order";
  return "copy";
}

function detectExpansion(request: string, project: StudioProject): WorkerId | null {
  const approved = new Set(project.approvedPlan?.workers.map((item) => item.workerId) ?? []);
  for (const worker of WORKERS) {
    if (approved.has(worker.id)) continue;
    if (worker.capabilitySignals.some((signal) => request.toLowerCase().includes(signal))) return worker.id;
  }
  return null;
}

export function detectExplicitExpansion(request: string, project: StudioProject): WorkerId | null {
  if (!/\b(add|create|build|enable|integrate|include|connect|introduce)\b/i.test(request)) return null;
  return detectExpansion(request, project);
}

export function decideExpansion(project: StudioProject, approved: boolean): StudioProject {
  const expansion = project.pendingExpansion;
  if (!expansion || !project.approvedPlan) throw new Error("No capability expansion is waiting for a decision.");
  if (!approved) {
    return {
      ...project,
      pendingExpansion: null,
      stage: "PREVIEW",
      messages: [...project.messages, message("assistant", "status", "Declined. The accepted team and page are unchanged.")],
      updatedAt: isoNow(),
    };
  }
  const approvedAt = isoNow();
  const updatedPlan = approvedPlanSchema.parse({
    ...project.approvedPlan,
    prompt: `${project.approvedPlan.prompt}\nExpansion request: ${expansion.request}${expansion.restriction ? ` (${expansion.restriction})` : ""}`,
    interpretation: {
      ...project.approvedPlan.interpretation,
      explicitRequirements: [...project.approvedPlan.interpretation.explicitRequirements, expansion.request],
      exclusions: expansion.restriction && !project.approvedPlan.interpretation.exclusions.includes(expansion.restriction)
        ? [...project.approvedPlan.interpretation.exclusions, expansion.restriction]
        : project.approvedPlan.interpretation.exclusions,
    },
    workers: [...project.approvedPlan.workers, expansion.worker],
    approvedAt,
  });
  let next: StudioProject = {
    ...project,
    approvedPlan: updatedPlan,
    recommendations: [...project.recommendations, expansion.worker],
    pendingExpansion: null,
    stage: "BUILDING",
    messages: [
      ...project.messages,
      message("assistant", "status", `${workerById(expansion.worker.workerId).name} was approved. External execution is still disabled.`),
    ],
    updatedAt: approvedAt,
  };
  next = recordEvent(next, "worker_selection_changed", {
    projectId: project.id,
    workerId: expansion.worker.workerId,
    selected: true,
  });
  next = recordEvent(next, "worker_team_approved", {
    projectId: project.id,
    approvedWorkerIds: updatedPlan.workers.map((worker) => worker.workerId),
    approvalTimestamp: approvedAt,
  });
  next = buildProject(next);
  next = {
    ...next,
    messages: [...next.messages, message("assistant", "revision", `${workerById(expansion.worker.workerId).name} is now connected to the same solution. External execution remains disabled.`)],
  };
  return recordEvent(next, "revision_applied", {
    projectId: project.id,
    category: "capability",
    durationMs: 1,
    result: "success",
  });
}

export function classifySupport(question: string) {
  const lower = question.toLowerCase();
  const urgent = includesAny(lower, ["urgent", "emergency", "danger", "unsafe", "flood", "fire", "blocked", "cannot", "can't"]);
  const category = includesAny(lower, ["danger", "unsafe", "flood", "fire", "accident", "emergency"])
    ? "Safety and incident"
    : includesAny(lower, ["broken", "error", "offline", "not working", "technical"])
      ? "Technical issue"
      : includesAny(lower, ["access", "eligib", "application", "service", "request"])
        ? "Service access"
        : includesAny(lower, ["fee", "payment", "cost", "fund"])
          ? "Payments and resources"
          : "Information and guidance";
  return {
    category,
    priority: urgent ? "High" : "Normal",
    route: urgent ? "Human support review" : "Approved information response",
    externalTicketCreated: false,
  };
}
