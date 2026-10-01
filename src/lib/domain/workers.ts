import type { ExecutionMode, WorkerId } from "./schemas";

export interface WorkerDefinition {
  id: WorkerId;
  name: string;
  shortName: string;
  contribution: string;
  mode: ExecutionMode;
  capabilitySignals: string[];
}

export const WORKERS: WorkerDefinition[] = [
  {
    id: "voice-executive",
    name: "Voice Executive",
    shortName: "Voice",
    contribution: "Structures spoken input for review.",
    mode: "live",
    capabilitySignals: ["voice", "spoken", "audio", "call", "hotline", "low literacy", "hands-free"],
  },
  {
    id: "customer-service-executive",
    name: "Customer Service Executive",
    shortName: "Support",
    contribution: "Classifies incoming questions and suggests the right support route.",
    mode: "live",
    capabilitySignals: ["support", "question", "help", "route", "unresolved", "report", "complaint", "request", "case", "incident"],
  },
  {
    id: "content-executive",
    name: "Content Executive",
    shortName: "Content",
    contribution: "Creates clear product content from approved facts.",
    mode: "live",
    capabilitySignals: ["content", "information", "answers", "guide", "knowledge", "awareness", "education", "advice", "recommendation", "image", "photo", "visual", "illustration"],
  },
  {
    id: "digital-campaign-executive",
    name: "Digital Campaign Executive",
    shortName: "Campaign",
    contribution: "Drafts campaign plans and channel-ready copy without sending them.",
    mode: "draft",
    capabilitySignals: ["campaign", "outreach", "promote", "workshop", "mobilize", "awareness", "community", "adoption"],
  },
  {
    id: "customer-success-executive",
    name: "Customer Success Executive",
    shortName: "Success",
    contribution: "Drafts onboarding and follow-up journeys.",
    mode: "draft",
    capabilitySignals: ["onboarding", "reminder", "follow-up", "retention", "journey", "intervention", "habit", "engagement"],
  },
  {
    id: "growth-analyst",
    name: "Growth Analyst",
    shortName: "Insights",
    contribution: "Analyzes project activity and turns it into measurable recommendations.",
    mode: "live",
    capabilitySignals: ["analytics", "metrics", "measurement", "usage", "insight", "monitor", "forecast", "predict", "data", "impact", "scalability"],
  },
];

export const workerById = (id: WorkerId) => {
  const worker = WORKERS.find((item) => item.id === id);
  if (!worker) throw new Error(`Unknown worker: ${id}`);
  return worker;
};
